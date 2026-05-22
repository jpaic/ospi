import math
import httpx
from db.connection import get_conn
from psycopg2.extras import execute_values

WORLD_BANK_URL = (
    "https://api.worldbank.org/v2/country/all/indicator/"
    "EG.USE.ELEC.KH.PC?format=json&mrv=1&per_page=300"
)

KWH_MIN = 100
KWH_MAX = 25_000


def fetch_electricity_signals():
    try:
        response = httpx.get(WORLD_BANK_URL, timeout=30)
        response.raise_for_status()
    except httpx.HTTPError as e:
        print("Request failed:", e)
        return {}

    payload = response.json()
    if not isinstance(payload, list) or len(payload) < 2:
        print("Invalid payload")
        return {}

    _, records = payload
    results = {}

    for record in records:
        iso2 = record.get("country", {}).get("id")
        value = record.get("value")
        year = record.get("date")

        if not iso2 or len(iso2) != 2 or value is None:
            continue

        safe_value = max(min(value, KWH_MAX), KWH_MIN)
        log_val = math.log(safe_value)
        log_min = math.log(KWH_MIN)
        log_max = math.log(KWH_MAX)

        score = ((log_val - log_min) / (log_max - log_min)) * 100
        score = round(min(max(score, 0), 100), 1)

        results[iso2] = {
            "raw_kwh": round(value, 1),
            "score": score,
            "year": int(year),
        }

    print(f"Fetched {len(results)} countries")
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