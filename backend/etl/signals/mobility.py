import csv
from pathlib import Path
from db.connection import get_conn
from psycopg2.extras import execute_values

REFERENCE_YEAR = 2024
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "numbeo_traffic.csv"


def fetch_mobility_signals():
    """Read Numbeo-based traffic/mobility scores from the bundled CSV.

    The CSV is generated from Numbeo Traffic Index by Country (89 countries)
    with the remainder estimated from urbanisation % via a linear model
    fitted on the 89 known data points.

    Re-generate with:
        python -m etl.utils.generate_numbeo_traffic
    """
    if not DATA_FILE.exists():
        print(f"Mobility data not found at {DATA_FILE}")
        return []

    results = []
    skipped = 0

    with open(DATA_FILE, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            iso2 = row["iso2"]
            score = row.get("score", "").strip()
            raw = row.get("raw_traffic_index", "").strip()

            if not score or not raw:
                skipped += 1
                continue

            raw_value = float(raw)
            normalised = float(score)

            results.append({
                "iso2": iso2,
                "raw_value": raw_value,
                "score": normalised,
                "year": REFERENCE_YEAR,
            })

    print(f"Loaded {len(results)} mobility rows from CSV ({skipped} skipped)")
    return results


def store_mobility_signals(signals: list[dict]):
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
                [(iso2, "mobility", raw, score, year) for iso2, raw, score, year in rows],
            )
        conn.commit()

    print(f"Stored {len(rows)} mobility signals")
