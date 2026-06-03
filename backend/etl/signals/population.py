import logging
import os
import time
import httpx
from db.connection import get_conn
from dotenv import load_dotenv
from etl.utils.countries import get_valid_country_codes, fetch_all_locations, filter_locations
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

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
                logger.info("  %s: 502 error, retry %d/%d", location_name, attempt + 1, max_retries)
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
    logger.info("Valid country codes loaded: %d", len(valid_iso2))

    logger.info("Fetching all locations from UN Data Portal...")
    all_locations = fetch_all_locations(HEADERS)
    logger.info("Total locations from UN API: %d", len(all_locations))

    countries, skipped, skipped_not_valid = filter_locations(all_locations, valid_iso2, valid_iso3)

    logger.info("--- Location filter breakdown ---")
    logger.info("Matched valid countries:  %d", len(countries))
    logger.info("Skipped (invalid):        %d", skipped)
    logger.info("Skipped (not valid):      %d", len(skipped_not_valid))

    if not countries:
        logger.warning("No countries found!")
        return {}

    logger.info("Fetching population data for all countries...")
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
            logger.info("  Progress: %d/%d — %d successful, %d no data, %d failed", i, len(countries), success_count, no_data_count, fail_count)

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

    logger.info("--- Population fetch breakdown ---")
    logger.info("Successfully fetched: %d", success_count)
    logger.info("No data available:    %d", no_data_count)
    logger.info("Failed:               %d", fail_count)
    logger.info("Total in dataset:     %d", len(results))

    if no_data_countries:
        logger.info("Countries with no data (%d):", len(no_data_countries))
        for c in no_data_countries:
            logger.info("  %s", c)

    if fail_countries:
        logger.warning("Failed countries (%d):", len(fail_countries))
        for c in fail_countries:
            logger.warning("  %s", c)

    missing = valid_iso2 - set(results.keys())
    if missing:
        logger.warning("Valid countries with NO population data (%d):", len(missing))
        for code in sorted(missing):
            logger.warning("  %s", code)

    return results


def store_population_signals(signals: dict[str, list[dict]]):
    unique_rows = {
        (iso2, row["year"]): row["population"]
        for iso2, data_rows in signals.items()
        for row in data_rows
    }
    rows = [(iso2, year, population) for (iso2, year), population in unique_rows.items()]

    if not rows:
        logger.info("No data to store")
        return

    logger.info("Preparing to store %d unique population rows for %d countries...", len(rows), len(signals))

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
                    logger.info("  Stored batch %d/%d (%d rows)", i//batch_size + 1, (len(rows)-1)//batch_size + 1, len(batch))
                except Exception as e:
                    logger.error("  Error storing batch %d: %s", i//batch_size + 1, e)
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
                            logger.error("    Failed to insert %s-%s: %s", row[0], row[1], row_error)
                            conn.rollback()

    logger.info("Successfully stored %d population rows for %d countries", total_stored, len(signals))


def main():
    logger.info("Starting UN population data fetch...")

    try:
        signals = fetch_population_signals()

        if signals:
            store_population_signals(signals)

            logger.info("Top 20 most populous countries:")
            country_populations = sorted(
                [(iso2, max(rows, key=lambda r: r["year"])["population"]) for iso2, rows in signals.items()],
                key=lambda x: x[1],
                reverse=True,
            )
            for i, (iso2, pop) in enumerate(country_populations[:20], 1):
                logger.info("  %d. %s: %.2fM", i, iso2, pop)
        else:
            logger.warning("No population data was fetched")

    except Exception as e:
        logger.error("Fatal error: %s", e)
        raise


if __name__ == "__main__":
    main()
