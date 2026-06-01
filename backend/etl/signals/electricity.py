import math
from datetime import date
import httpx
from db.connection import get_conn
from etl.utils.countries import get_valid_iso2_codes
from psycopg2.extras import execute_values

START_YEAR = 2010
END_YEAR = date.today().year - 1

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    f"EG.USE.ELEC.KH.PC?format=json&date={START_YEAR}:{END_YEAR}&per_page=20000"
)

# Per-capita kWh bounds for the raw fetch (keep as-is)
KWH_MIN = 100
KWH_MAX = 25_000

# Total proxy bounds: per_capita_kwh × area_km2
# Range: ~10k (microstate × low usage) to ~5e11 (large × high usage).
ELEC_TOTAL_MIN = 10_000
ELEC_TOTAL_MAX = 500_000_000_000


def fetch_electricity_signals():
    valid_codes = get_valid_iso2_codes()
    print(f"Valid country codes loaded: {len(valid_codes)}")

    try:
        response = httpx.get(WORLD_BANK_URL, timeout=60)
        response.raise_for_status()
    except httpx.HTTPError as e:
        print("Request failed:", e)
        return {}

    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        print("Invalid payload")
        return {}

    meta, records = payload
    print(f"API returned {meta.get('total')} total records across {meta.get('pages')} page(s)")

    results = {}
    skipped_not_valid = []
    skipped_no_value = []
    skipped_duplicate_year = []

    for record in records:
        iso2 = record.get("country", {}).get("id")
        country_name = record.get("country", {}).get("value", "?")
        value = record.get("value")
        year = record.get("date")

        if not iso2:
            continue

        if value is None:
            skipped_no_value.append(f"{iso2} ({country_name}) {year}")
            continue

        if iso2 not in valid_codes:
            skipped_not_valid.append(f"{iso2} ({country_name})")
            continue

        year = int(year)

        if (iso2, year) in results:
            skipped_duplicate_year.append(f"{iso2} {year}")
            continue

        safe_value = max(min(value, KWH_MAX), KWH_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(KWH_MIN)
        log_max = math.log(KWH_MAX)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)

        results[(iso2, year)] = {
            "iso2": iso2,
            "raw_kwh": round(value, 1),
            "score": score,
            "year": year,
        }

    print(f"\n--- Skip breakdown ---")
    print(f"Kept:                  {len(results)}")
    print(f"Skipped (no value):    {len(skipped_no_value)}")
    print(f"Skipped (not valid):   {len(skipped_not_valid)}")
    print(f"Skipped (duplicate):   {len(skipped_duplicate_year)}")
    print(f"Total accounted for:   {len(results) + len(skipped_no_value) + len(skipped_not_valid) + len(skipped_duplicate_year)}")

    print(f"\nFetched {len(results)} country-year electricity rows")
    return list(results.values())


def store_electricity_signals(signals: list[dict]):
    """
    Convert per-capita kWh to a total-consumption proxy by multiplying
    with land area (km²) from country_metadata, then log-normalise.
    """
    # Collect all iso2 codes from the fetched signals
    iso2s = list({s["iso2"] for s in signals})

    # Bulk-fetch area_km2 from country_metadata
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, area_km2 FROM country_metadata WHERE iso2 = ANY(%s)",
                (iso2s,),
            )
            area_map = {r[0]: r[1] for r in cur.fetchall()}

    # Compute mean area for fallback (NULL / missing area_km2)
    valid_areas = [v for v in area_map.values() if v is not None and float(v) > 0]
    mean_area = float(sum(valid_areas)) / len(valid_areas) if valid_areas else 1.0

    log_min = math.log(ELEC_TOTAL_MIN)
    log_max = math.log(ELEC_TOTAL_MAX)

    rows = []
    for s in signals:
        iso2 = s["iso2"]
        kwh_per_capita = float(s["raw_kwh"])
        area = area_map.get(iso2)
        if area is None or float(area) <= 0:
            area = mean_area
        total_proxy = kwh_per_capita * float(area)
        safe_value = max(total_proxy, ELEC_TOTAL_MIN)
        log_val = math.log(safe_value)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)
        rows.append((iso2, "electricity", round(total_proxy, 1), score, s["year"]))

    with get_conn() as conn:
        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO signals (iso2, signal_type, raw_value, score, year)
                VALUES %s
                ON CONFLICT (iso2, signal_type, year)
                DO UPDATE SET
                    raw_value = EXCLUDED.raw_value,
                    score = EXCLUDED.score,
                    fetched_at = now()
                """,
                rows,
            )
        conn.commit()

    print(f"Stored {len(rows)} electricity signals (per-capita × area → total proxy)")
