import math
from datetime import date
import httpx
from db.connection import get_conn
from etl.utils.countries import get_valid_country_codes
from psycopg2.extras import execute_values
import logging

logger = logging.getLogger(__name__)

START_YEAR = 2000
END_YEAR = date.today().year - 1

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    f"IS.ROD.DNST.K2?format=json&date={START_YEAR}:{END_YEAR}&per_page=20000"
)

ROAD_MIN = 0.1
ROAD_MAX = 500


def _build_iso3_to_iso2() -> dict[str, str]:
    resp = httpx.get(
        "https://api.worldbank.org/v2/country?format=json&per_page=500",
        timeout=30,
    )
    resp.raise_for_status()
    _, countries = resp.json()
    mapping = {}
    for c in countries:
        iso3 = c.get("id")
        iso2 = c.get("iso2Code")
        region_id = c.get("region", {}).get("id")
        income_id = c.get("incomeLevel", {}).get("id")
        if iso3 and iso2 and region_id not in ("", None, "NA") and income_id != "NA":
            mapping[iso3] = iso2
    mapping["TWN"] = "TW"
    return mapping


def fetch_road_density_signals():
    valid_iso2, valid_iso3 = get_valid_country_codes()
    iso3_to_iso2 = _build_iso3_to_iso2()
    logger.info("Valid ISO3 codes: %d", len(valid_iso3))

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
        iso3 = record.get("country", {}).get("id")
        country_name = record.get("country", {}).get("value", "?")
        value = record.get("value")
        year = record.get("date")

        if not iso3:
            continue

        if value is None:
            skipped_no_value.append(f"{iso3} ({country_name}) {year}")
            continue

        if iso3 not in valid_iso3:
            skipped_not_valid.append(f"{iso3} ({country_name})")
            continue

        iso2 = iso3_to_iso2.get(iso3)
        if iso2 is None or iso2 not in valid_iso2:
            skipped_not_valid.append(f"{iso3} -> {iso2} (no ISO2)")
            continue

        year = int(year)

        if (iso2, year) in results:
            skipped_duplicate_year.append(f"{iso2} {year}")
            continue

        safe_value = max(min(value, ROAD_MAX), ROAD_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(ROAD_MIN)
        log_max = math.log(ROAD_MAX)
        score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
        score = min(max(score, 0), 100)

        results[(iso2, year)] = {
            "iso2": iso2,
            "raw_road": round(value, 1),
            "score": score,
            "year": year,
        }

    logger.info("--- Skip breakdown ---")
    logger.info("Kept:                  %d", len(results))
    logger.info("Skipped (no value):    %d", len(skipped_no_value))
    logger.info("Skipped (not valid):   %d", len(skipped_not_valid))
    logger.info("Skipped (duplicate):   %d", len(skipped_duplicate_year))
    logger.info("Total accounted for:   %d", len(results) + len(skipped_no_value) + len(skipped_not_valid) + len(skipped_duplicate_year))

    logger.info("Fetched %d country-year road_density rows", len(results))
    return list(results.values())


def store_road_density_signals(signals: list[dict]):
    rows = [
        (data["iso2"], data["raw_road"], data["score"], data["year"])
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
                [(iso2, 'road_density', raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    logger.info("Stored %d road_density signals", len(rows))
