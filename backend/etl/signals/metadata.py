import asyncio
import os
import httpx
from db.connection import get_conn
from dotenv import load_dotenv
from etl.utils.countries import get_valid_country_codes, fetch_all_locations, filter_locations
from psycopg2.extras import execute_values

load_dotenv()

UN_API_TOKEN        = os.getenv("UN_API_TOKEN")
BASE                = "https://population.un.org/dataportalapi/api/v1"
WORLDBANK_BASE      = "https://api.worldbank.org/v2"

INDICATOR_URBAN_PCT = 2   # UN WPP: urban population percentage
MEDIUM_VARIANT_ID   = 4   # UN WPP: 4=Medium, 5=High, 6=Low
SEX_BOTH            = 3   # 1=Male, 2=Female, 3=Both sexes
REFERENCE_YEAR      = 2024

CONCURRENCY         = 3  # max simultaneous in-flight requests

UN_HEADERS = {"Authorization": f"Bearer {UN_API_TOKEN}"}


# ---------------------------------------------------------------------------
# DB helper — population already stored by population.py
# ---------------------------------------------------------------------------

def get_latest_population_from_db() -> dict[str, float]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT ON (iso2) iso2, population
                FROM populations
                ORDER BY iso2, year DESC
            """)
            return {row[0]: float(row[1]) * 1_000_000 for row in cur.fetchall()}


# ---------------------------------------------------------------------------
# Async fetch helpers
# ---------------------------------------------------------------------------

async def _get_with_retry(
    client: httpx.AsyncClient,
    url: str,
    label: str,
    headers: dict | None = None,
    max_retries: int = 3,
) -> dict | list | None:
    """GET with exponential backoff on 502. Returns parsed JSON or None on failure."""
    for attempt in range(max_retries):
        try:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            return r.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 502 and attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                print(f"  {label}: 502 retry {attempt + 1}/{max_retries}")
                continue
            print(f"  {label}: HTTP {e.response.status_code}")
            return None
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429:
                retry_after = int(e.response.headers.get("Retry-After", 5))
                print(f"  {label}: rate limited, waiting {retry_after}s")
                await asyncio.sleep(retry_after)
                continue  # retry this attempt
            if e.response.status_code == 502 and attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)
                continue
            print(f"  {label}: HTTP {e.response.status_code}")
            return None
        except Exception as e:
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
                continue
            print(f"  {label}: {e}")
            return None
    return None


async def fetch_urban_pct_async(
    client: httpx.AsyncClient,
    location_id: int,
    location_name: str,
) -> float | None:
    url = (
        f"{BASE}/data/indicators/{INDICATOR_URBAN_PCT}"
        f"/locations/{location_id}"
        f"/start/{REFERENCE_YEAR}/end/{REFERENCE_YEAR}"
        f"/?format=json&pageSize=100"
    )
    data = await _get_with_retry(client, url, location_name, headers=UN_HEADERS)
    if not data:
        return None

    rows = data.get("data", data if isinstance(data, list) else [])
    for row in rows:
        if row.get("variantId") != MEDIUM_VARIANT_ID:
            continue
        if row.get("sexId") != SEX_BOTH:
            continue
        value = row.get("value")
        if value is not None:
            return round(float(value), 4)
    return None


async def fetch_land_area_async(
    client: httpx.AsyncClient,
    iso2: str,
) -> float | None:
    url = f"{WORLDBANK_BASE}/country/{iso2}/indicator/AG.LND.TOTL.K2?format=json&mrv=1"
    data = await _get_with_retry(client, url, f"{iso2} land area")
    if not data:
        return None

    entries = data[1] if isinstance(data, list) and len(data) > 1 else []
    for entry in entries:
        value = entry.get("value")
        if value is not None:
            return float(value)
    return None


async def fetch_gdp_async(
    client: httpx.AsyncClient,
    iso2: str,
) -> float | None:
    url = f"{WORLDBANK_BASE}/country/{iso2}/indicator/NY.GDP.PCAP.CD?format=json&mrv=5"
    data = await _get_with_retry(client, url, f"{iso2} GDP")
    if not data:
        return None

    entries = data[1] if isinstance(data, list) and len(data) > 1 else []
    for entry in entries:
        value = entry.get("value")
        if value is not None:
            return round(float(value), 2)
    return None


def compute_density(population_abs: float | None, land_area_km2: float | None) -> float | None:
    if population_abs and land_area_km2 and land_area_km2 > 0:
        return round(population_abs / land_area_km2, 4)
    return None


# ---------------------------------------------------------------------------
# Per-country coroutine
# ---------------------------------------------------------------------------

async def fetch_country_metadata(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    country: dict,
    pop_from_db: dict[str, float],
) -> tuple[str, dict]:
    iso2   = country["Iso2"]
    loc_id = country["Id"]
    name   = country["Name"]

    async with sem:
        urban, land_area, gdp = await asyncio.gather(
            fetch_urban_pct_async(client, loc_id, name),
            fetch_land_area_async(client, iso2),
            fetch_gdp_async(client, iso2),
        )
    await asyncio.sleep(0.3 + (hash(iso2) % 10) * 0.05)  # 0.3–0.8s jitter

    return iso2, {
        "iso3":           country.get("Iso3") or None,
        "name":           name,
        "lat":            country.get("Latitude"),
        "lng":            country.get("Longitude"),
        "region":         country.get("SubRegion") or "Unknown",
        "urban_pct":      urban,
        "density_km2":    compute_density(pop_from_db.get(iso2), land_area),
        "gdp_per_capita": gdp,
    }


# ---------------------------------------------------------------------------
# Main fetch / store
# ---------------------------------------------------------------------------

async def _fetch_all_async(countries: list[dict], pop_from_db: dict[str, float]) -> dict[str, dict]:
    sem     = asyncio.Semaphore(CONCURRENCY)
    results = {}
    fail_countries = []

    async with httpx.AsyncClient(timeout=30) as client:
        tasks   = [fetch_country_metadata(client, sem, c, pop_from_db) for c in countries]
        outcomes = await asyncio.gather(*tasks, return_exceptions=True)

    success_count = 0
    fail_count    = 0

    for outcome in outcomes:
        if isinstance(outcome, Exception):
            fail_count += 1
            fail_countries.append(str(outcome))
            continue
        iso2, record = outcome
        results[iso2] = record
        success_count += 1

    print(f"\n--- Metadata fetch breakdown ---")
    print(f"Successfully fetched: {success_count}")
    print(f"Failed:               {fail_count}")
    print(f"Total in dataset:     {len(results)}")

    if fail_countries:
        print(f"\nFailed countries ({len(fail_countries)}):")
        for c in fail_countries:
            print(f"  {c}")

    return results


def fetch_metadata_signals() -> dict[str, dict]:
    """
    Returns:
        {
            iso2: {
                "iso3":           str | None,
                "name":           str,
                "lat":            float | None,
                "lng":            float | None,
                "region":         str,
                "urban_pct":      float | None,
                "density_km2":    float | None,
                "gdp_per_capita": float | None,
            },
            ...
        }
    """
    valid_iso2, valid_iso3 = get_valid_country_codes()
    print(f"Valid country codes loaded: {len(valid_iso2)}")

    print("\nFetching all locations from UN Data Portal...\n")
    all_locations = fetch_all_locations(UN_HEADERS)
    print(f"\nTotal locations from UN API: {len(all_locations)}")

    countries, skipped, skipped_not_valid = filter_locations(all_locations, valid_iso2, valid_iso3)

    print(f"\n--- Location filter breakdown ---")
    print(f"Matched valid countries:  {len(countries)}")
    print(f"Skipped (invalid):        {skipped}")
    print(f"Skipped (not valid):      {len(skipped_not_valid)}")

    if not countries:
        print("No countries found!")
        return {}

    print("\nLoading population totals from DB...\n")
    pop_from_db = get_latest_population_from_db()
    print(f"  Loaded population for {len(pop_from_db)} countries")

    print("\nFetching metadata signals (async)...\n")
    results = asyncio.run(_fetch_all_async(countries, pop_from_db))

    missing = valid_iso2 - set(results.keys())
    if missing:
        print(f"\nValid countries with NO metadata ({len(missing)}):")
        for code in sorted(missing):
            print(f"  {code}")

    return results


def store_metadata_signals(signals: dict[str, dict]):
    """Upsert all country_metadata fields including urban_pct, density_km2, gdp_per_capita."""
    rows = [
        (
            iso2,
            rec["iso3"],
            rec["name"],
            rec["lat"],
            rec["lng"],
            rec["region"],
            rec["urban_pct"]      or 0,
            rec["density_km2"]    or 0,
            rec["gdp_per_capita"] or 0,
        )
        for iso2, rec in signals.items()
    ]

    if not rows:
        print("No metadata to store")
        return

    print(f"\nPreparing to store metadata for {len(rows)} countries...")

    with get_conn() as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO country_metadata
                    (iso2, iso3, name, lat, lng, region, urban_pct, density_km2, gdp_per_capita)
                VALUES %s
                ON CONFLICT (iso2) DO UPDATE SET
                    iso3           = EXCLUDED.iso3,
                    name           = EXCLUDED.name,
                    lat            = EXCLUDED.lat,
                    lng            = EXCLUDED.lng,
                    region         = EXCLUDED.region,
                    urban_pct      = EXCLUDED.urban_pct,
                    density_km2    = EXCLUDED.density_km2,
                    gdp_per_capita = EXCLUDED.gdp_per_capita,
                    fetched_at     = now()
                """,
                rows,
            )
        conn.commit()

    print(f"\nSuccessfully stored metadata for {len(rows)} countries")


def main():
    print("Starting metadata fetch...\n")

    try:
        signals = fetch_metadata_signals()

        if signals:
            store_metadata_signals(signals)

            print("\nTop 10 by GDP per capita:")
            by_gdp = sorted(
                [(iso2, rec["gdp_per_capita"]) for iso2, rec in signals.items() if rec["gdp_per_capita"]],
                key=lambda x: x[1],
                reverse=True,
            )
            for i, (iso2, gdp) in enumerate(by_gdp[:10], 1):
                print(f"  {i}. {iso2}: ${gdp:,.0f}")
        else:
            print("No metadata was fetched")

    except Exception as e:
        print(f"Fatal error: {e}")
        raise


if __name__ == "__main__":
    main()