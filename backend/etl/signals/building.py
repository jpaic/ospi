import csv
from pathlib import Path
from db.connection import get_conn
from psycopg2.extras import execute_values

REFERENCE_YEAR = 2024
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "building_density.csv"


def fetch_building_signals():
    """Read pre-computed building density scores from the bundled CSV.

    The CSV is generated from Microsoft Global ML Building Footprints
    and OpenStreetMap data. Each country's building count is divided by
    land area, then log-normalised to [0, 100].

    Re-generate with:
        python backend/etl/data/generate_building_data.py
    """
    if not DATA_FILE.exists():
        print(f"Building density data not found at {DATA_FILE}")
        return []

    results = []
    skipped = 0

    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            iso2 = row["iso2"]
            score = row.get("score", "").strip()
            density = row.get("density_per_km2", "").strip()

            if not score or not density:
                skipped += 1
                continue

            raw_value = round(float(density), 2)
            normalised = float(score)

            results.append({
                "iso2": iso2,
                "raw_value": raw_value,
                "score": normalised,
                "year": REFERENCE_YEAR,
            })

    print(f"Loaded {len(results)} building-density rows from CSV ({skipped} skipped)")
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

    print(f"Stored {len(rows)} building-density signals")
