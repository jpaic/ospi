import os
import time
import httpx
from db.connection import get_conn
from dotenv import load_dotenv
from psycopg2.extras import execute_values

load_dotenv()

UN_API_TOKEN = os.getenv("UN_API_TOKEN")
BASE = "https://population.un.org/dataportalapi/api/v1"
INDICATOR_TOTAL_POP = 49
START_YEAR = 2018
END_YEAR = 2024

HEADERS = {"Authorization": f"Bearer {UN_API_TOKEN}"}

SOVEREIGN_COUNTRIES = {
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola",
    "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados",
    "Belarus", "Belgium", "Belize", "Benin", "Bhutan",
    "Bolivia (Plurinational State of)", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei Darussalam",
    "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
    "Cameroon", "Canada", "Central African Republic", "Chad", "Chile",
    "China", "Colombia", "Comoros", "Congo", "Costa Rica",
    "Côte d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia",
    "Dem. People's Rep. of Korea", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica",
    "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea",
    "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji",
    "Finland", "France", "Gabon", "Gambia", "Georgia",
    "Germany", "Ghana", "Greece", "Grenada", "Guatemala",
    "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras",
    "Hungary", "Iceland", "India", "Indonesia", "Iran (Islamic Republic of)",
    "Iraq", "Ireland", "Israel", "Italy", "Jamaica",
    "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
    "Kuwait", "Kyrgyzstan", "Kosovo (under UNSC res. 1244)", "Lao People's Democratic Republic", "Latvia", "Lebanon",
    "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
    "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives",
    "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
    "Mexico", "Micronesia", "Monaco", "Mongolia", "Montenegro",
    "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru",
    "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
    "Nigeria", "North Macedonia", "Norway", "Oman", "Pakistan",
    "Palau", "Panama", "Papua New Guinea", "Paraguay", "Peru",
    "Philippines", "Poland", "Portugal", "Qatar", "Republic of Korea",
    "Republic of Moldova", "Romania", "Russian Federation", "Rwanda", "Saint Kitts and Nevis",
    "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
    "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
    "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia",
    "South Africa", "South Sudan", "Spain", "Sri Lanka", "State of Palestine",
    "Sudan", "Suriname", "Sweden", "Switzerland", "Syrian Arab Republic",
    "China, Taiwan Province of China", "Tajikistan", "Thailand", "Timor-Leste", "Togo", "Tonga",
    "Trinidad and Tobago", "Tunisia", "Türkiye", "Turkmenistan", "Tuvalu",
    "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United Republic of Tanzania",
    "United States of America", "Uruguay", "Uzbekistan", "Vanuatu", "Venezuela (Bolivarian Republic of)",
    "Viet Nam", "Yemen", "Zambia", "Zimbabwe",
}


def fetch_all_locations() -> list[dict]:
    """Fetch all locations from UN API"""
    locations = []
    page = 1
    total_pages = 1

    while page <= total_pages:
        url = f"{BASE}/locationsWithAggregates?pageNumber={page}&pageSize=250"

        for attempt in range(3):
            try:
                r = httpx.get(url, headers=HEADERS, timeout=30)
                r.raise_for_status()
                data = r.json()
                break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 502 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise

        locations.extend(data["data"])
        total_pages = data.get("pages", 1)
        print(f"Locations page {page}/{total_pages} — {len(locations)} so far")
        page += 1

    return locations


def fetch_population_for_location(location_id: int, location_name: str, max_retries: int = 3) -> list[dict]:
    """Fetch population data for a specific location with retry logic.

    Mirrors the TS script logic exactly:
      1. Sort rows ascending by year
      2. Overwrite year_map[year] for each row (last value per year wins)
      3. Divide by 1_000_000 to convert to millions
    """
    url = (
        f"{BASE}/data/indicators/{INDICATOR_TOTAL_POP}"
        f"/locations/{location_id}/start/{START_YEAR}/end/{END_YEAR}"
        f"/?format=json&pageSize=100"
    )

    for attempt in range(max_retries):
        try:
            r = httpx.get(url, headers=HEADERS, timeout=30)
            r.raise_for_status()
            data = r.json()

            # Extract data array - handles both response formats
            rows = data.get("data", data if isinstance(data, list) else [])

            if not rows:
                return []

            # Sort by year ascending (mirrors TS: rows.sort((a, b) => Number(a.timeLabel) - Number(b.timeLabel)))
            rows.sort(key=lambda row: int(row["timeLabel"]))

            # Overwrite per year so last value wins (mirrors TS: history[history.length - 1] after sort)
            year_map = {}
            for row in rows:
                if row.get("value") is not None:
                    year = int(row["timeLabel"])
                    year_map[year] = row["value"] / 1_000_000

            return [{"year": year, "population": pop} for year, pop in sorted(year_map.items())]

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 502 and attempt < max_retries - 1:
                delay = 2 ** attempt
                print(f"  {location_name}: 502 error, retry {attempt + 1}/{max_retries} in {delay}s")
                time.sleep(delay)
                continue
            raise
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            raise

    return []


def fetch_population_signals() -> dict[str, list[dict]]:
    """Returns {iso2: [{year, population}, ...]}"""
    print("Fetching all locations from UN Data Portal...\n")
    all_locations = fetch_all_locations()

    countries = []
    for loc in all_locations:
        # Must have Iso2 code (basic validation)
        if not loc.get("Iso2") or len(loc["Iso2"]) != 2:
            continue

        # Check if it's a sovereign country by name
        if loc["Name"] in SOVEREIGN_COUNTRIES:
            countries.append(loc)

    print(f"\n{len(countries)} sovereign countries identified out of {len(all_locations)} total locations\n")

    if not countries:
        print("No countries found!")
        return {}

    print("Sample countries:")
    for country in countries[:10]:
        print(f"  - {country['Name']} ({country['Iso2']})")
    print("")

    print("Fetching population data for all countries...\n")
    results = {}
    success_count = 0
    no_data_count = 0
    fail_count = 0

    for i, country in enumerate(countries):
        iso2 = country["Iso2"]
        name = country["Name"]

        # Show progress every 10 countries
        if i % 10 == 0 and i > 0:
            print(f"  Progress: {i}/{len(countries)} countries processed ({success_count} successful, {no_data_count} no data, {fail_count} failed)")

        try:
            rows = fetch_population_for_location(country["Id"], name)

            if not rows:
                no_data_count += 1
                continue

            # Get latest year for validation
            latest = rows[-1]

            # Skip if population is 0 (likely no data)
            if latest["population"] == 0:
                no_data_count += 1
                continue

            results[iso2] = rows
            success_count += 1

            # Log first 20 successes
            if success_count <= 20:
                print(f"{name} — {latest['population']:.2f}M")

            # Add delay to be nice to the API
            time.sleep(0.2)

        except Exception as e:
            fail_count += 1
            if fail_count <= 10:
                print(f"{name}: {str(e)}")

    print(f"\n  Done!")
    print(f"  • Successfully fetched: {success_count} countries")
    print(f"  • No data available: {no_data_count} countries")
    print(f"  • Failed: {fail_count} countries")
    print(f"  • Total countries in dataset: {len(results)}")

    return results


def store_population_signals(signals: dict[str, list[dict]]):
    """Store population data in database without duplicates"""
    # Use a dictionary to ensure unique (iso2, year) pairs
    unique_rows = {}

    for iso2, data_rows in signals.items():
        for row in data_rows:
            key = (iso2, row["year"])
            if key not in unique_rows:
                unique_rows[key] = row["population"]

    # Convert to list of tuples for insertion
    rows = [(iso2, year, population) for (iso2, year), population in unique_rows.items()]

    if not rows:
        print("No data to store")
        return

    print(f"\nPreparing to store {len(rows)} unique population rows...")

    # Store in batches to avoid overwhelming the database
    batch_size = 1000
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

                    # Try inserting rows one by one to isolate problematic ones
                    print(f"  Attempting individual inserts for this batch...")
                    for row in batch:
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
                                [row],
                            )
                            conn.commit()
                            total_stored += 1
                        except Exception as row_error:
                            print(f"    Failed to insert {row[0]}-{row[1]}: {row_error}")
                            conn.rollback()

    print(f"\n✓ Successfully stored {total_stored} population rows for {len(signals)} countries")


def main():
    """Main execution function"""
    print("Starting UN population data fetch...\n")

    try:
        # Fetch all population data
        signals = fetch_population_signals()

        if signals:
            # Store in database
            store_population_signals(signals)

            # Show top 20 most populous countries
            print("\nTop 20 most populous countries:")
            country_populations = []
            for iso2, data_rows in signals.items():
                latest = max(data_rows, key=lambda r: r["year"])
                country_populations.append((iso2, latest["population"]))

            # Sort by population (largest first) and show top 20
            country_populations.sort(key=lambda x: x[1], reverse=True)
            for i, (iso2, pop) in enumerate(country_populations[:20], 1):
                print(f"  {i}. {iso2}: {pop:.2f}M")
        else:
            print("No population data was fetched")

    except Exception as e:
        print(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()