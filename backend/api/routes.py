import logging
import math
import os

from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

from services.estimator import (
    estimate_population,
    estimate_population_bulk,
    estimate_population_history_bulk,
)
from db.connection import get_conn
from services.cache import get_cache

logger = logging.getLogger(__name__)

app = FastAPI(title="OSPI API", version="2.0.0")

_allowed_origins = (os.getenv("ALLOWED_ORIGINS") or "http://localhost:3000,http://127.0.0.1:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Retrain status store ──────────────────────────────────────────────────────

_retrain_status: dict[str, str | dict | None] = {"status": "idle", "result": None, "error": None}

# ── Helpers ───────────────────────────────────────────────────────────────────
# NOTE: `/countries/full` must be defined BEFORE `/countries/{iso2}` so FastAPI
# matches the literal "full" before trying it as an iso2 parameter.

GDP_NORM_MIN = 100
GDP_NORM_MAX = 200_000


def _normalise_gdp_signal(gdp_raw: float | None) -> float | None:
    if gdp_raw is None or gdp_raw <= 0:
        return None
    safe = max(min(gdp_raw, GDP_NORM_MAX), GDP_NORM_MIN)
    log_val = math.log(safe)
    log_min = math.log(GDP_NORM_MIN)
    log_max = math.log(GDP_NORM_MAX)
    return round(((log_val - log_min) / (log_max - log_min)) * 100, 1)


def _inject_gdp(signals_map: dict[str, dict], iso2: str, gdp_raw: float | None):
    """Inject normalised gdp_per_capita into a country's signals dict."""
    gdp_norm = _normalise_gdp_signal(gdp_raw)
    if gdp_norm is not None:
        signals_map.setdefault(iso2, {}).setdefault("gdp_per_capita", gdp_norm)


def get_signals_for_country(iso2: str) -> dict:
    """Returns {signal_type: score} for the latest year of each type."""
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
            cur.execute(
                "SELECT gdp_per_capita FROM country_metadata WHERE iso2 = %s",
                (iso2,),
            )
            gdp_row = cur.fetchone()
    result = {
        row[0]: float(row[1]) if row[1] is not None else None
        for row in rows
    }
    _inject_gdp({iso2: result}, iso2, gdp_row[0] if gdp_row else None)
    return result


def get_all_signals_bulk() -> dict[str, dict]:
    """Returns {iso2: {signal_type: score}} with gdp_per_capita injected from metadata."""
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
            cur.execute(
                "SELECT iso2, gdp_per_capita FROM country_metadata WHERE gdp_per_capita IS NOT NULL"
            )
            gdp_rows = {r[0]: float(r[1]) if r[1] is not None else None for r in cur.fetchall()}
    result: dict[str, dict] = {}
    for iso2, signal_type, score in rows:
        if iso2 not in result:
            result[iso2] = {}
        result[iso2][signal_type] = float(score) if score is not None else None
    for iso2, gdp_raw in gdp_rows.items():
        _inject_gdp(result, iso2, gdp_raw)
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
    """Annual growth rate (fraction) between the two most recent official years."""
    if len(history) < 2:
        return 0.0
    latest = history[-1]["v"]
    prev   = history[-2]["v"]
    if not prev:
        return 0.0
    return round((latest - prev) / prev * 100, 4)


def build_signals(signals: dict) -> dict:
    """Normalise signal dict to a standard shape."""
    return {
        "telecom":        signals.get("telecom"),
        "electricity":    signals.get("electricity"),
        "gdp_per_capita": signals.get("gdp_per_capita"),
        "nightlights":    signals.get("nightlights"),
        "mobility":   signals.get("mobility"),
    }


def get_latest_model_info() -> dict | None:
    """Returns the most recent model_weights row as a dict, or None."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM model_weights WHERE version = 'v3' ORDER BY trained_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cur.description]
            return dict(zip(cols, row))


# ── Details (cached via AppCache) ─────────────────────────────────────────────

def _build_details(model_id: int) -> dict:
    """Assemble the full /model/details payload.

    Steps:
      1. Check AppCache.
      2. Load model row from model_weights.
      3. Load residuals & country names.
      4. Run bulk estimation.
      5. Build scatter array, extract outliers.
      6. Compute residual histogram (numpy).
      7. Load confidence distribution from populations.
      8. Run evaluate helpers: coverage_distribution, run_cross_val_diagnostics,
         compute_feature_importance.
      9. Write to AppCache and return.
    """
    import numpy as np
    from services.estimator import estimate_population_bulk
    from etl.training.evaluate import coverage_distribution, run_cross_val_diagnostics, compute_feature_importance

    cache = get_cache()
    cache_key = f"details:{model_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM model_weights WHERE id = %s", (model_id,))
            row = cur.fetchone()
            if not row:
                return {"trained": False}
            cols = [desc[0] for desc in cur.description]
            model = dict(zip(cols, row))

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, residual FROM model_residuals WHERE model_id = %s",
                (model_id,),
            )
            residual_data = {r[0]: float(r[1]) for r in cur.fetchall()}

    training_iso2s = list(residual_data.keys())

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, name FROM country_metadata WHERE iso2 = ANY(%s)",
                (training_iso2s,),
            )
            names = {r[0]: r[1] for r in cur.fetchall()}

    estimates = estimate_population_bulk(training_iso2s)

    scatter = []
    for iso2 in training_iso2s:
        est = estimates.get(iso2, {})
        official = est.get("official")
        ospi = est.get("estimate")
        residual = residual_data.get(iso2, 0)
        name = names.get(iso2, iso2)
        if official is None or ospi is None:
            continue
        scatter.append({
            "iso2": iso2,
            "name": name,
            "official": official,
            "ospi": ospi,
            "residual": round(residual, 4),
            "residual_pct": round(abs(ospi - official) / official * 100, 2) if official else 0,
        })

    scatter.sort(key=lambda x: x["official"])
    outliers = sorted(scatter, key=lambda x: x["residual"], reverse=True)[:10]

    all_residuals = [d["residual"] for d in scatter]
    if all_residuals:
        hist_counts, hist_edges = np.histogram(all_residuals, bins=20)
        residual_mean = float(np.mean(all_residuals))
        residual_std = float(np.std(all_residuals))
        residual_p95 = float(np.percentile(all_residuals, 95))
        residual_p99 = float(np.percentile(all_residuals, 99))
    else:
        hist_counts = hist_edges = np.array([])
        residual_mean = residual_std = residual_p95 = residual_p99 = 0

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT source_confidence, COUNT(*)
                FROM populations
                WHERE source_confidence IS NOT NULL
                GROUP BY source_confidence
            """)
            conf_rows = cur.fetchall()

    conf_counts = dict(conf_rows)
    confidence = {
        "high": conf_counts.get("high", 0),
        "med": conf_counts.get("med", 0),
        "low": conf_counts.get("low", 0),
        "unknown": conf_counts.get("unknown", 0),
    }
    confidence["total"] = sum(confidence.values())

    cov = coverage_distribution()
    cv = run_cross_val_diagnostics()
    fi = compute_feature_importance(model_id)
    feature_importance = [
        {"feature": k, "coefficient": v}
        for k, v in fi.get("coefficients", {}).items()
    ]

    result = {
        "trained": True,
        "model": {
            "model_id": model["id"],
            "trained_at": str(model["trained_at"]),
            "r_squared": model.get("r_squared"),
            "cv_r_squared": model.get("cv_r_squared"),
            "n_training": model.get("n_training"),
            "intercept": model.get("intercept"),
            "coefficients": {
                k: model.get(k)
                for k in ["telecom", "electricity", "gdp_per_capita", "nightlights", "mobility", "log_area_km2", "signal_count"]
            },
            "region_coefs": model.get("region_coefs"),
        },
        "training_scatter": scatter,
        "residual_histogram": {
            "bins": hist_edges.tolist(),
            "counts": hist_counts.tolist(),
            "mean": round(residual_mean, 4),
            "std": round(residual_std, 4),
            "p95": round(residual_p95, 4),
            "p99": round(residual_p99, 4),
            "min": round(min(all_residuals), 4) if all_residuals else 0,
            "max": round(max(all_residuals), 4) if all_residuals else 0,
            "n": len(all_residuals),
        },
        "outliers": outliers,
        "confidence": confidence,
        "coverage": cov,
        "cv": cv,
        "feature_importance": feature_importance,
    }

    cache.set(cache_key, result)
    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/countries")
def list_countries():
    all_signals = get_all_signals_bulk()
    all_pops    = get_all_populations_bulk()
    iso2_list   = sorted(all_signals.keys())
    estimates   = estimate_population_bulk(iso2_list)

    logger.info("signals=%d, pops=%d, estimates=%d", len(all_signals), len(all_pops), len(estimates))
    no_official = [k for k, v in estimates.items() if v and v.get("official") is None]
    if no_official:
        logger.debug("Filtered out (no official): %s", no_official[:10])

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


@app.get("/countries/full")
def list_countries_full():
    """Rich /countries — metadata, signals, full official/ospi histories."""
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
            "signalCoverage": est.get("signal_coverage"),
        })

    return results


@app.get("/countries/{iso2}")
def get_country(iso2: str):
    """Single-country estimate + latest signals."""
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


# ── Model endpoints ───────────────────────────────────────────────────────────

@app.get("/model/details")
def model_details():
    """Full model diagnostics: scatter, histogram, outliers, confidence, CV, feature importance."""
    model = get_latest_model_info()
    if not model:
        return {"trained": False}
    return _build_details(model["id"])


@app.get("/model/status")
def model_status():
    """Quick training-status check (no historical data)."""
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
            "intercept":      model.get("intercept"),
            "telecom":        model.get("telecom"),
            "electricity":    model.get("electricity"),
            "gdp_per_capita": model.get("gdp_per_capita"),
            "nightlights":    model.get("nightlights"),
            "mobility":   model.get("mobility"),
        },
        "mode": "v2_regression",
    }


@app.get("/model/version")
def model_version():
    """Model-run label (e.g. 2024-Q3) and metadata for the landing page."""
    model = get_latest_model_info()
    if not model:
        return {
            "etl_year": 2024,
            "model_run": None,
            "model_id": None,
            "r_squared": None,
            "n_countries": None,
            "n_signals": 5,
        }

    trained_at = model["trained_at"]
    quarter = (trained_at.month - 1) // 3 + 1
    model_run = f"{trained_at.year}-Q{quarter}"

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(DISTINCT iso2) FROM signals")
            n_countries = cur.fetchone()[0]

    return {
        "etl_year": 2024,
        "model_run": model_run,
        "model_id": model["id"],
        "r_squared": model.get("r_squared"),
        "n_countries": n_countries,
        "n_signals": 5,
    }


# ── Admin endpoints ───────────────────────────────────────────────────────────

@app.post("/admin/retrain")
async def admin_retrain(request: Request, background_tasks: BackgroundTasks):
    """Kick off a background retrain. Poll /admin/retrain/status for completion."""
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    def _do_retrain():
        """Synchronous wrapper — BackgroundTasks silently drops coroutines."""
        global _retrain_status
        _retrain_status = {"status": "running", "result": None, "error": None}
        from etl.jobs import run_model_training
        try:
            get_cache().invalidate_prefix("details:")
            result = run_model_training()
            _retrain_status = {"status": "completed", "result": result, "error": None}
            logger.info("Background retrain completed: model_id=%s", result.get("model_id"))
        except Exception as e:
            _retrain_status = {"status": "failed", "result": None, "error": str(e)}
            logger.error("Background retrain failed: %s", exc_info=True)

    background_tasks.add_task(_do_retrain)
    return {"status": "accepted", "message": "Retrain job queued. Poll /admin/retrain/status for progress."}


@app.get("/admin/retrain/status")
async def admin_retrain_status(request: Request):
    """Poll retrain progress — status is idle | running | completed | failed."""
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")
    return _retrain_status


@app.post("/admin/retrain/sync")
async def admin_retrain_sync(request: Request):
    """Synchronous retrain — blocks the request until training finishes."""
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    get_cache().invalidate_prefix("details:")
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
    """Health summary: R², residual stats, confidence tiers, coverage count."""
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    from etl.training.evaluate import model_health_report
    return model_health_report()


@app.get("/admin/model-diagnostics")
async def admin_model_diagnostics(request: Request):
    """Cross-val diagnostics, feature importance, coverage distribution."""
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
    """Apply database schema patches from etl/jobs.py."""
    token = request.headers.get("X-Admin-Token", "")
    if token != os.environ.get("ADMIN_TOKEN", ""):
        raise HTTPException(status_code=403, detail="Forbidden")

    from etl.jobs import apply_schema_patches
    apply_schema_patches()
    return {"status": "ok", "message": "Schema patches applied"}
