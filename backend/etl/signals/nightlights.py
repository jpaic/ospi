import csv
import io
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
import httpx
from db.connection import get_conn
from etl.utils.countries import get_valid_iso2_codes
from psycopg2.extras import execute_values
import logging

logger = logging.getLogger(__name__)

NTL_MIN = 0.1
NTL_MAX = 200.0

MAX_WORKERS = 20

EOATLAS_TEMPLATE = "https://eoatlas-nightlight.s3.amazonaws.com/eoatlas-monthly-nightlight-{:05d}.csv"

START_YEAR = 2012
END_YEAR = date.today().year - 1


def _fetch_adm0_csv(file_id: int) -> tuple[str | None, dict[int, float]]:
    url = EOATLAS_TEMPLATE.format(file_id)
    try:
        resp = httpx.get(url, timeout=30)
        resp.raise_for_status()
    except httpx.HTTPError:
        return None, {}

    reader = csv.DictReader(io.StringIO(resp.text))

    iso3 = None
    yearly_values: dict[int, list[float]] = {}

    for row in reader:
        if row.get("shapeType") != "ADM0":
            return None, {}

        if iso3 is None:
            iso3 = (row.get("shapeGroup") or "").strip()
            if not iso3 or len(iso3) != 3:
                return None, {}

        year_str = row.get("year")
        mean_str = (row.get("mean") or "").strip()
        if not year_str or not mean_str:
            continue

        try:
            mean = float(mean_str)
        except (ValueError, TypeError):
            continue

        year = int(year_str)
        if year < START_YEAR or year > END_YEAR:
            continue

        yearly_values.setdefault(year, []).append(mean)

    if not yearly_values:
        return iso3, {}

    annual: dict[int, float] = {}
    for year, vals in yearly_values.items():
        annual[year] = sum(vals) / len(vals)

    return iso3, annual


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


def fetch_nightlights_signals() -> list[dict]:
    iso3_to_iso2 = _build_iso3_to_iso2()
    valid_iso2 = get_valid_iso2_codes()
    logger.info("Valid ISO3 codes: %d, valid ISO2 codes: %d", len(iso3_to_iso2), len(valid_iso2))

    file_ids = range(218)
    results: dict[tuple[str, int], dict] = {}

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        fut_map = {pool.submit(_fetch_adm0_csv, fid): fid for fid in file_ids}
        for fut in as_completed(fut_map):
            file_id = fut_map[fut]
            try:
                iso3, annual = fut.result()
            except Exception as e:
                logger.debug("File ID %05d raised: %s", file_id, e)
                continue

            if iso3 is None or not annual:
                continue

            iso2 = iso3_to_iso2.get(iso3)
            if iso2 is None or iso2 not in valid_iso2:
                logger.debug("Skipped ISO3=%s (file %05d): not in valid set", iso3, file_id)
                continue

            for year, annual_mean in annual.items():
                safe_val = max(min(annual_mean, NTL_MAX), NTL_MIN)
                log_val = math.log(safe_val)
                log_min = math.log(NTL_MIN)
                log_max = math.log(NTL_MAX)
                score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
                score = min(max(score, 0), 100)

                key = (iso2, year)
                if key in results:
                    continue

                results[key] = {
                    "iso2": iso2,
                    "raw_ntl": round(annual_mean, 4),
                    "score": score,
                    "year": year,
                }

    logger.info("Fetched %d country-year nightlights rows", len(results))
    return list(results.values())


def store_nightlights_signals(signals: list[dict]):
    rows = [
        (data["iso2"], data["raw_ntl"], data["score"], data["year"])
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
                [(iso2, 'nightlights', raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    logger.info("Stored %d nightlights signals", len(rows))
