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
    f"IT.NET.BBND?format=json&date={START_YEAR}:{END_YEAR}&per_page=20000"
)

# Fixed broadband subscriptions (total, not per 100 people).
# Range: ~10 (microstates) to ~670M (China).
BBND_MIN = 10
BBND_MAX = 1_000_000_000


def fetch_internet_signals():
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

        safe_value = max(min(value, BBND_MAX), BBND_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(BBND_MIN)
        log_max = math.log(BBND_MAX)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)

        results[(iso2, year)] = {
            "iso2": iso2,
            "raw_bbnd": round(value, 1),
            "score": score,
            "year": year,
        }

    print(f"\n--- Skip breakdown ---")
    print(f"Kept:                  {len(results)}")
    print(f"Skipped (no value):    {len(skipped_no_value)}")
    print(f"Skipped (not valid):   {len(skipped_not_valid)}")
    print(f"Skipped (duplicate):   {len(skipped_duplicate_year)}")
    print(f"Total accounted for:   {len(results) + len(skipped_no_value) + len(skipped_not_valid) + len(skipped_duplicate_year)}")

    print(f"\nFetched {len(results)} country-year internet rows")
    return list(results.values())


def store_internet_signals(signals: list[dict]):
    rows = [
        (data["iso2"], data["raw_bbnd"], data["score"], data["year"])
        for data in signals
    ]

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
                [(iso2, 'internet', raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    print(f"Stored {len(rows)} internet signals")
