from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from services.estimator import (
    estimate_population,
    estimate_population_bulk,
    estimate_population_history_bulk,
)
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

app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Helpers ───────────────────────────────────────────────────────────────────

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


def get_all_population_histories() -> dict[str, list[dict]]:
    """Returns {iso2: [{y, v}, ...]} sorted by year asc."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT iso2, year, population
                FROM populations
                ORDER BY iso2, year ASC
                """
            )
            rows = cur.fetchall()
    histories: dict[str, list[dict]] = {}
    for iso2, year, population in rows:
        histories.setdefault(iso2, []).append({"y": year, "v": float(population)})
    return histories


def get_all_metadata() -> dict[str, dict]:
    """Returns {iso2: {name, lat, lng, region, urbanPct, densityKm2, gdpPerCapita}}."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT iso2, name, lat, lng, region,
                       urban_pct, density_km2, gdp_per_capita
                FROM country_metadata
                """
            )
            rows = cur.fetchall()
    return {
        row[0]: {
            "name":         row[1],
            "lat":          float(row[2]) if row[2] is not None else 0,
            "lng":          float(row[3]) if row[3] is not None else 0,
            "region":       row[4] or "Unknown",
            "urbanPct":     float(row[5]) if row[5] is not None else 0,
            "densityKm2":   float(row[6]) if row[6] is not None else 0,
            "gdpPerCapita": float(row[7]) if row[7] is not None else 0,
        }
        for row in rows
    }


def calc_growth_rate(history: list[dict]) -> float:
    if len(history) < 2:
        return 0.0
    latest = history[-1]["v"]
    prev   = history[-2]["v"]
    if not prev:
        return 0.0
    return round((latest - prev) / prev * 100, 4)


def build_signals(signals: dict) -> dict:
    return {
        "telecom":     signals.get("telecom"),
        "electricity": signals.get("electricity"),
        "building":    signals.get("building"),
        "mobility":    signals.get("mobility"),
        "internet":    signals.get("internet"),
    }


def get_latest_model_info() -> dict | None:
    """Returns the most recent model_weights row as a dict, or None."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM model_weights ORDER BY trained_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cur.description]
            return dict(zip(cols, row))


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/countries")
def list_countries():
    all_signals = get_all_signals_bulk()
    all_pops    = get_all_populations_bulk()
    iso2_list   = sorted(all_signals.keys())
    estimates   = estimate_population_bulk(iso2_list)

    print(f"signals: {len(all_signals)}, pops: {len(all_pops)}, estimates: {len(estimates)}")
    no_official = [k for k, v in estimates.items() if v and v.get("official") is None]
    print(f"Filtered out (no official): {no_official[:10]}")

    results = []
    for iso2 in iso2_list:
        est = estimates.get(iso2)
        if not est or est.get("official") is None:
            continue
        results.append({
            "iso2":             iso2,
            "official":         est["official"],
            "ospi":             est["estimate"],
            "conf":             est["confidence"],
            "composite_signal": est.get("composite_signal"),
            "signals":          build_signals(all_signals.get(iso2, {})),
        })
    return results


# NOTE: /countries/full must be defined before /countries/{iso2} — FastAPI
# matches routes in definition order and would treat "full" as an iso2 value.
@app.get("/countries/full")
def list_countries_full():
    """
    Returns the complete Country shape the frontend needs —
    history, metadata, signals, and OSPI estimates in one call.
    Replaces the static unData.json baseline entirely.
    """
    all_signals   = get_all_signals_bulk()
    all_histories = get_all_population_histories()
    all_metadata  = get_all_metadata()
    iso2_list     = sorted(all_metadata.keys())
    estimates     = estimate_population_bulk(iso2_list)
    ospi_histories = estimate_population_history_bulk(iso2_list)

    results = []
    for iso2 in iso2_list:
        meta    = all_metadata[iso2]
        est     = estimates.get(iso2, {})
        history = all_histories.get(iso2, [])

        official = est.get("official") if est else None
        if official is None and history:
            official = history[-1]["v"]
        if official is None:
            continue

        # v2 estimate is census-free; fall back to official if model not ready
        ospi_estimate = est.get("estimate") or official

        results.append({
            "name":         meta["name"],
            "iso":          iso2,
            "lat":          meta["lat"],
            "lng":          meta["lng"],
            "region":       meta["region"],
            "official":     official,
            "ospi":         ospi_estimate,
            "conf":         est.get("confidence") or "low",
            "signals":      build_signals(all_signals.get(iso2, {})),
            "history":      history,
            "ospiHistory":  ospi_histories.get(iso2, []),
            "urbanPct":     meta["urbanPct"],
            "densityKm2":   meta["densityKm2"],
            "gdpPerCapita": meta["gdpPerCapita"],
            "growthRate":   calc_growth_rate(history),
            "regions":      [],
            # v2 extras (consumed by frontend if it wants them)
            "signalCoverage": est.get("signal_coverage"),
        })

    return results


@app.get("/countries/{iso2}")
def get_country(iso2: str):
    iso2 = iso2.upper()
    est  = estimate_population(iso2)
    if not est or est.get("official") is None:
        raise HTTPException(status_code=404, detail=f"No data found for {iso2}")
    signals = get_signals_for_country(iso2)
    return {
        "iso2":             iso2,
        "official":         est["official"],
        "ospi":             est["estimate"],
        "conf":             est["confidence"],
        "composite_signal": est.get("composite_signal"),
        "signal_coverage":  est.get("signal_coverage"),
        "signals":          build_signals(signals),
    }


# ── Model status ──────────────────────────────────────────────────────────────

@app.get("/model/status")
def model_status():
    """
    Returns info about the currently active model.
    Consumed by the frontend ModelStatus panel.
    """
    model = get_latest_model_info()
    if not model:
        return {
            "trained":    False,
            "model_id":   None,
            "trained_at": None,
            "r_squared":  None,
            "n_training": None,
            "lambda":     None,
            "mode":       "v1_fallback",
        }

    return {
        "trained":    True,
        "model_id":   model["id"],
        "trained_at": str(model["trained_at"]),
        "r_squared":  model.get("r_squared"),
        "n_training": model.get("n_training"),
        "lambda":     model.get("lambda"),
        "coefficients": {
            "intercept":   model.get("intercept"),
            "telecom":     model.get("telecom"),
            "electricity": model.get("electricity"),
            "building":    model.get("building"),
            "mobility":    model.get("mobility"),
            "internet":    model.get("internet"),
        },
        "mode": "v2_regression",
    }


# ── Admin endpoints ───────────────────────────────────────────────────────────

@app.post("/admin/retrain")
async def admin_retrain(request: Request, background_tasks: BackgroundTasks):
    """
    Triggers a full model retrain.
    Protected by X-Admin-Token header (shared secret from ADMIN_TOKEN env var).

    Runs in the background so the HTTP response returns immediately.
    Poll GET /model/status to check when the new model is live.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    def _do_retrain():
        from etl.jobs import run_model_training
        try:
            result = run_model_training()
            print(f"[retrain] Background job completed: {result}")
        except Exception as e:
            print(f"[retrain] Background job failed: {e}")

    background_tasks.add_task(_do_retrain)
    return {"status": "accepted", "message": "Retrain job queued. Poll /model/status for progress."}


@app.post("/admin/retrain/sync")
async def admin_retrain_sync(request: Request):
    """
    Synchronous retrain — waits for completion and returns full results.
    Useful for CLI / CI pipelines. Protected by X-Admin-Token.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        from etl.jobs import run_model_training
        result = run_model_training()
        return {"status": "ok", **result}
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Training failed: {e}")


@app.get("/admin/model-health")
async def admin_model_health(request: Request):
    """
    Detailed model health report.  Protected by X-Admin-Token.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    from etl.training.evaluate import model_health_report
    return model_health_report()


@app.get("/admin/model-diagnostics")
async def admin_model_diagnostics(request: Request):
    """
    Cross-validation diagnostics and feature importance.  Protected by X-Admin-Token.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    from etl.training.evaluate import run_cross_val_diagnostics, compute_feature_importance, coverage_distribution
    return {
        "cross_validation": run_cross_val_diagnostics(),
        "feature_importance": compute_feature_importance(),
        "coverage": coverage_distribution(),
    }


@app.post("/admin/apply-patches")
async def admin_apply_patches(request: Request):
    """
    Applies the model_schema_patch.sql and source_confidence_patch.sql.
    Idempotent — safe to call multiple times.  Protected by X-Admin-Token.
    """
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    from etl.jobs import apply_schema_patches
    apply_schema_patches()
    return {"status": "ok", "message": "Schema patches applied"}
