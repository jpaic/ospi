from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from services.estimator import estimate_population
from db.connection import get_conn
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_signals_for_country(iso2: str) -> dict:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (signal_type) signal_type, score
                FROM signals
                WHERE iso2 = %s
                ORDER BY signal_type, year DESC
                """,
                (iso2,)
            )
            rows = cur.fetchall()
    return {
        row[0]: float(row[1]) if row[1] is not None else None
        for row in rows
    }


def get_all_signals_bulk() -> dict[str, dict]:
    """Returns {iso2: {signal_type: score}} using two queries total."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2, signal_type) iso2, signal_type, score
                FROM signals
                ORDER BY iso2, signal_type, year DESC
                """
            )
            rows = cur.fetchall()

    result: dict[str, dict] = {}
    for iso2, signal_type, score in rows:
        if iso2 not in result:
            result[iso2] = {}
        result[iso2][signal_type] = float(score) if score is not None else None
    return result


def get_all_populations_bulk() -> dict[str, dict]:
    """Returns {iso2: {year: population}} for the most recent year per country."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2) iso2, year, population
                FROM populations
                ORDER BY iso2, year DESC
                """
            )
            rows = cur.fetchall()
    return {
        row[0]: {"year": row[1], "population": float(row[2])}
        for row in rows
    }


@app.get("/countries")
def list_countries():
    all_signals = get_all_signals_bulk()
    all_pops = get_all_populations_bulk()

    iso2_list = sorted(all_signals.keys())
    results = []

    # bulk compute all estimates at once
    from services.estimator import estimate_population_bulk

    estimates = estimate_population_bulk(iso2_list)

    print(f"signals: {len(all_signals)}, pops: {len(all_pops)}, estimates: {len(estimates)}")
    no_official = [k for k, v in estimates.items() if v and v["official"] is None]
    print(f"Filtered out (no official): {no_official[:10]}")

    for iso2 in iso2_list:
        est = estimates.get(iso2)
        if not est or est["official"] is None:
            continue

        signals = all_signals.get(iso2, {})

        results.append({
            "iso2": iso2,
            "official": est["official"],
            "ospi": est["estimate"],
            "conf": est["confidence"],
            "composite_signal": est["composite_signal"],
            "signals": {
                "telecom": signals.get("telecom"),
                "electricity": signals.get("electricity"),
                "building": signals.get("building"),
                "mobility": signals.get("mobility"),
                "internet": signals.get("internet"),
            }
        })

    return results


@app.get("/countries/{iso2}")
def get_country(iso2: str):
    iso2 = iso2.upper()
    est = estimate_population(iso2)
    if est["official"] is None:
        raise HTTPException(status_code=404, detail=f"No data found for {iso2}")
    signals = get_signals_for_country(iso2)
    return {
        "iso2": iso2,
        "official": est["official"],
        "ospi": est["estimate"],
        "conf": est["confidence"],
        "composite_signal": est["composite_signal"],
        "signals": {
            "telecom":     signals.get("telecom"),
            "electricity": signals.get("electricity"),
            "building":    signals.get("building"),
            "mobility":    signals.get("mobility"),
            "internet":    signals.get("internet"),
        }
    }