import math
from datetime import date
import httpx
from db.connection import get_conn
from etl.utils.countries import get_valid_iso2_codes
from psycopg2.extras import execute_values
import logging

logger = logging.getLogger(__name__)

START_YEAR = 2010
END_YEAR = date.today().year - 1

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    f"IT.CEL.SETS?format=json&date={START_YEAR}:{END_YEAR}&per_page=20000"
)

# Total mobile cellular subscriptions (not per 100 people).
# Range: ~1k (microstates) to ~1.8B (China).
TEL_MIN  = 1_000
TEL_MAX = 2_000_000_000


def fetch_telecom_signals():
    valid_codes = get_valid_iso2_codes()
    logger.info("Valid country codes loaded: %d", len(valid_codes))

    try:
        response = httpx.get(WORLD_BANK_URL, timeout=60)
        response.raise_for_status()
    except httpx.HTTPError as e:
        logger.error("Request failed: %s", e)
        return {}

    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        logger.warning("Invalid payload")
        return {}

    meta, records = payload
    logger.info("API returned %s total records across %s page(s)", meta.get('total'), meta.get('pages'))

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

        safe_value = max(min(value, TEL_MAX), TEL_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(TEL_MIN)
        log_max = math.log(TEL_MAX)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)

        results[(iso2, year)] = {
            "iso2": iso2,
            "raw_tel": round(value, 1),
            "score": score,
            "year": year,
        }

    logger.info("--- Skip breakdown ---")
    logger.info("Kept:                  %d", len(results))
    logger.info("Skipped (no value):    %d", len(skipped_no_value))
    logger.info("Skipped (not valid):   %d", len(skipped_not_valid))
    logger.info("Skipped (duplicate):   %d", len(skipped_duplicate_year))
    logger.info("Total accounted for:   %d", len(results) + len(skipped_no_value) + len(skipped_not_valid) + len(skipped_duplicate_year))

    logger.info("Fetched %d country-year telecom rows", len(results))
    return list(results.values())


def store_telecom_signals(signals: list[dict]):
    rows = [
        (data["iso2"], data["raw_tel"], data["score"], data["year"])
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
                [(iso2, 'telecom', raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    logger.info("Stored %d telecom signals", len(rows))
