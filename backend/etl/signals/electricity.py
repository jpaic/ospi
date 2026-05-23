import math
import httpx
from db.connection import get_conn
from etl.utils.countries import get_valid_iso2_codes
from psycopg2.extras import execute_values

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    "EG.USE.ELEC.KH.PC?format=json&mrnev=5&per_page=1000"
)

KWH_MIN = 100
KWH_MAX = 25_000


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
    skipped_older_year = []

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

        if iso2 in results and results[iso2]["year"] >= year:
            skipped_older_year.append(f"{iso2} {year}")
            continue

        safe_value = max(min(value, KWH_MAX), KWH_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(KWH_MIN)
        log_max = math.log(KWH_MAX)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)

        results[iso2] = {"raw_kwh": round(value, 1), "score": score, "year": year}

    print(f"\n--- Skip breakdown ---")
    print(f"Kept:                  {len(results)}")
    print(f"Skipped (no value):    {len(skipped_no_value)}")
    print(f"Skipped (not valid):   {len(skipped_not_valid)}")
    print(f"Skipped (older year):  {len(skipped_older_year)}")
    print(f"Total accounted for:   {len(results) + len(skipped_no_value) + len(skipped_not_valid) + len(skipped_older_year)}")

    print(f"\nFetched {len(results)} countries")
    return results


def store_electricity_signals(signals: dict[str, dict]):
    rows = [
        (iso2, data["raw_kwh"], data["score"], data["year"])
        for iso2, data in signals.items()
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
                [(iso2, 'electricity', raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    print(f"Stored {len(rows)} electricity signals")