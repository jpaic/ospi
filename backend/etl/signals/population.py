import os
import time
import httpx
from db.connection import get_conn
from dotenv import load_dotenv
from etl.utils.countries import get_valid_country_codes, fetch_all_locations, filter_locations
from psycopg2.extras import execute_values

load_dotenv()

UN_API_TOKEN        = os.getenv("UN_API_TOKEN")
BASE                = "https://population.un.org/dataportalapi/api/v1"
INDICATOR_TOTAL_POP = 49
MEDIUM_VARIANT_ID   = 4   # UN WPP: 4=Medium, 5=High, 6=Low
SEX_BOTH            = 3   # 1=Male, 2=Female, 3=Both sexes — required to avoid half-population rows
START_YEAR          = 2010
END_YEAR            = 2024

HEADERS = {"Authorization": f"Bearer {UN_API_TOKEN}"}


def fetch_population_for_location(location_id: int, location_name: str, max_retries: int = 3) -> list[dict]:
    url = (
        f"{BASE}/data/indicators/{INDICATOR_TOTAL_POP}"
        f"/locations/{location_id}/start/{START_YEAR}/end/{END_YEAR}"
        f"/?format=json&pageSize=200"
    )

    for attempt in range(max_retries):
        try:
            r = httpx.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
            data = r.json()

            rows = data.get("data", data if isinstance(data, list) else [])
            if not rows:
                return []

            year_map = {}
            for row in rows:
                if row.get("variantId") != MEDIUM_VARIANT_ID:
                    continue
                if row.get("sexId") != SEX_BOTH:        # exclude male/female splits
                    continue
                if row.get("value") is None:
                    continue

                year = int(row["timeLabel"])
                if year not in year_map:                 # first matching row per year wins
                    year_map[year] = round(row["value"] / 1_000_000, 4)

            return [{"year": year, "population": pop} for year, pop in sorted(year_map.items())]

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 502 and attempt < max_retries - 1:
                time.sleep(2 ** attempt)
                print(f"  {location_name}: 502 error, retry {attempt + 1}/{max_retries}")
                continue
            raise
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            raise

    return []


def fetch_population_signals() -> dict[str, list[dict]]:
    """Returns {iso2: [{year, population}, ...]}"""
    valid_iso2, valid_iso3 = get_valid_country_codes()
    print(f"Valid country codes loaded: {len(valid_iso2)}")

    print("\nFetching all locations from UN Data Portal...\n")
    all_locations = fetch_all_locations(HEADERS)
    print(f"\nTotal locations from UN API: {len(all_locations)}")

    countries, skipped, skipped_not_valid = filter_locations(all_locations, valid_iso2, valid_iso3)

    print(f"\n--- Location filter breakdown ---")
    print(f"Matched valid countries:  {len(countries)}")
    print(f"Skipped (invalid):        {skipped}")
    print(f"Skipped (not valid):      {len(skipped_not_valid)}")

    if not countries:
        print("No countries found!")
        return {}

    print("\nFetching population data for all countries...\n")
    results = {}
    success_count   = 0
    no_data_count   = 0
    no_data_countries = []
    fail_count      = 0
    fail_countries  = []

    for i, country in enumerate(countries):
        iso2 = country["Iso2"]
        name = country["Name"]

        if i % 10 == 0 and i > 0:
            print(f"  Progress: {i}/{len(countries)} — {success_count} successful, {no_data_count} no data, {fail_count} failed")

        try:
            rows = fetch_population_for_location(country["Id"], name)

            if not rows:
                no_data_count += 1
                no_data_countries.append(f"{iso2} ({name})")
                continue

            if rows[-1]["population"] == 0:
                no_data_count += 1
                no_data_countries.append(f"{iso2} ({name}) — zero population")
                continue

            results[iso2] = rows
            success_count += 1
            time.sleep(0.2)

        except Exception as e:
            fail_count += 1
            fail_countries.append(f"{iso2} ({name}): {str(e)}")

    print(f"\n--- Population fetch breakdown ---")
    print(f"Successfully fetched: {success_count}")
    print(f"No data available:    {no_data_count}")
    print(f"Failed:               {fail_count}")
    print(f"Total in dataset:     {len(results)}")

    if no_data_countries:
        print(f"\nCountries with no data ({len(no_data_countries)}):")
        for c in no_data_countries:
            print(f"  {c}")

    if fail_countries:
        print(f"\nFailed countries ({len(fail_countries)}):")
        for c in fail_countries:
            print(f"  {c}")

    missing = valid_iso2 - set(results.keys())
    if missing:
        print(f"\nValid countries with NO population data ({len(missing)}):")
        for code in sorted(missing):
            print(f"  {code}")

    return results


def store_population_signals(signals: dict[str, list[dict]]):
    unique_rows = {
        (iso2, row["year"]): row["population"]
        for iso2, data_rows in signals.items()
        for row in data_rows
    }
    rows = [(iso2, year, population) for (iso2, year), population in unique_rows.items()]

    if not rows:
        print("No data to store")
        return

    print(f"\nPreparing to store {len(rows)} unique population rows for {len(signals)} countries...")

    batch_size  = 1000
    total_stored = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            for i in range(0, len(rows), batch_size):
                batch = rows[i:i + batch_size]
                try:
                    execute_values(
                        cur,
                        """
                        INSERT INTO populations (iso2, year, population)
                        VALUES %s
                        ON CONFLICT (iso2, year)
                        DO UPDATE SET
                            population = EXCLUDED.population,
                            fetched_at = now()
                        """,
                        batch,
                    )
                    conn.commit()
                    total_stored += len(batch)
                    print(f"  Stored batch {i//batch_size + 1}/{(len(rows)-1)//batch_size + 1} ({len(batch)} rows)")
                except Exception as e:
                    print(f"  Error storing batch {i//batch_size + 1}: {e}")
                    conn.rollback()
                    for row in batch:
                        try:
                            execute_values(cur, """
                                INSERT INTO populations (iso2, year, population)
                                VALUES %s
                                ON CONFLICT (iso2, year)
                                DO UPDATE SET
                                    population = EXCLUDED.population,
                                    fetched_at = now()
                            """, [row])
                            conn.commit()
                            total_stored += 1
                        except Exception as row_error:
                            print(f"    Failed to insert {row[0]}-{row[1]}: {row_error}")
                            conn.rollback()

    print(f"\n✓ Successfully stored {total_stored} population rows for {len(signals)} countries")


def main():
    print("Starting UN population data fetch...\n")

    try:
        signals = fetch_population_signals()

        if signals:
            store_population_signals(signals)

            print("\nTop 20 most populous countries:")
            country_populations = sorted(
                [(iso2, max(rows, key=lambda r: r["year"])["population"]) for iso2, rows in signals.items()],
                key=lambda x: x[1],
                reverse=True,
            )
            for i, (iso2, pop) in enumerate(country_populations[:20], 1):
                print(f"  {i}. {iso2}: {pop:.2f}M")
        else:
            print("No population data was fetched")

    except Exception as e:
        print(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()
