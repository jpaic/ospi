import csv
import logging
import math
from pathlib import Path
from db.connection import get_conn
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)

REFERENCE_YEAR = 2024
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "building_density.csv"

# Total building count (not density): bld_count_m * 1_000_000
# Range: ~50k (Somalia) to ~200M (China).
BLDG_MIN = 10_000
BLDG_MAX = 500_000_000


def fetch_building_signals():
    """Read building footprint counts from the bundled CSV and convert
    from density (per km²) to total building count per country.

    The CSV contains Microsoft Global ML Building Footprints data with
    bld_count_m (millions of buildings) and land_km2 columns.

    Total = bld_count_m × 1_000_000, then log-normalised to [0, 100].

    Re-generate with:
        python backend/etl/data/generate_building_data.py
    """
    if not DATA_FILE.exists():
        logger.error("Building density data not found at %s", DATA_FILE)
        return []

    results = []
    skipped = 0

    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            iso2 = row["iso2"]
            bld_str = row.get("bld_count_m", "").strip()

            if not bld_str:
                skipped += 1
                continue

            total = float(bld_str) * 1_000_000
            safe_value = max(total, BLDG_MIN)
            log_val = math.log(safe_value)
            log_min = math.log(BLDG_MIN)
            log_max = math.log(BLDG_MAX)
            score = round(((log_val - log_min) / (log_max - log_min)) * 100, 1)
            score = min(max(score, 0), 100)

            results.append({
                "iso2": iso2,
                "raw_value": round(total, 1),
                "score": score,
                "year": REFERENCE_YEAR,
            })

    logger.info("Loaded %d building-total rows from CSV (%d skipped)", len(results), skipped)
    return results


def store_building_signals(signals: list[dict]):
    rows = [
        (s["iso2"], s["raw_value"], s["score"], s["year"])
        for s in signals
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
                [(iso2, "building", raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    logger.info("Stored %d building-density signals", len(rows))
