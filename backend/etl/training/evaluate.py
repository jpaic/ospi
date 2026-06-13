"""
evaluate.py
Cross-validation diagnostics, residual analysis, and model health checks.

Standalone — can be run directly for offline inspection:
    python -m etl.training.evaluate

Changes vs v1:
  - run_cross_val_diagnostics now uses a single cross_validate() call for R²
    and RMSE so both metrics come from identical folds (previously two separate
    cross_val_score calls, giving inconsistent alpha selection per fold).
  - The Pipeline (StandardScaler + RidgeCV) is used so the scaler is re-fit
    inside each fold, preventing data leakage from the scaler fit.
  - top_outliers raises ValueError when a non-existent model_id is requested
    instead of silently falling back to the latest model.
  - MIN_R2_THRESHOLD imported from constants.py (no more duplicated magic number).
  - Logging added throughout (was completely silent before).
  - ALL_FEATURE_KEYS imported from trainer to guarantee the feature list stays
    in sync between training and evaluation.
"""
import logging
import math
import numpy as np
from sklearn.model_selection import KFold
from sklearn.preprocessing import StandardScaler

from db.connection import get_conn
from etl.training.constants import MIN_R2_THRESHOLD, MIN_TRAINING_COUNTRIES
from etl.training.trainer import ALL_FEATURE_KEYS, UN_REGION_TO_CONTINENT, KEPT_CONTINENTS, _build_feature_matrix, _fit_ridge
from etl.utils.signal_pivot import SIGNAL_KEYS, signal_coverage

log = logging.getLogger(__name__)


def load_all_training_data() -> list[dict]:
    """Load ALL countries (not just high-confidence) for diagnostic purposes."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH latest_pop AS (
                    SELECT DISTINCT ON (iso2)
                        iso2,
                        year,
                        population,
                        source_confidence
                    FROM populations
                    ORDER BY iso2, year DESC
                ),
                latest_signals AS (
                    SELECT DISTINCT ON (iso2, signal_type)
                        iso2,
                        signal_type,
                        score
                    FROM signals
                    ORDER BY iso2, signal_type, year DESC
                ),
                pivoted AS (
                    SELECT
                        lp.iso2,
                        lp.population,
                        lp.source_confidence,
                        cm.area_km2,
                        cm.region,
                        cm.gdp_per_capita,
                        MAX(CASE WHEN ls.signal_type = 'telecom'      THEN ls.score END) AS telecom,
                        MAX(CASE WHEN ls.signal_type = 'electricity'  THEN ls.score END) AS electricity,
                        MAX(CASE WHEN ls.signal_type = 'nightlights'  THEN ls.score END) AS nightlights,
                        MAX(CASE WHEN ls.signal_type = 'road_density' THEN ls.score END) AS road_density
                    FROM latest_pop lp
                    LEFT JOIN latest_signals ls ON ls.iso2 = lp.iso2
                    LEFT JOIN country_metadata cm ON cm.iso2 = lp.iso2
                    GROUP BY lp.iso2, lp.population, lp.source_confidence, cm.area_km2, cm.region, cm.gdp_per_capita
                )
                SELECT * FROM pivoted
                WHERE population IS NOT NULL AND population > 0
            """)
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def load_model_history() -> list[dict]:
    """Fetch all trained model versions ordered newest first."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM model_weights ORDER BY trained_at DESC"
            )
            cols = [desc[0] for desc in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]


def load_residuals(model_id: int) -> dict[str, float]:
    """Fetch per-country residuals for a given model."""
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, residual FROM model_residuals WHERE model_id = %s",
                (model_id,),
            )
            return {row[0]: row[1] for row in cur.fetchall()}


def run_cross_val_diagnostics(n_splits: int = 5) -> dict:
    """
    Runs k-fold cross-validation on the full dataset (all source_confidence
    levels) and returns fold-level RMSE and R² in log space.

    Uses ElasticNet (same methodology as trainer): cross-validated L1+L2
    regularisation with kNN imputation.  Scaler is re-fit inside each fold.
    """
    log.info("[evaluate] Loading all training data for CV diagnostics...")
    rows = load_all_training_data()
    filtered = [r for r in rows if signal_coverage(r) >= 0.4 and r["population"] > 0]
    log.info("[evaluate] %d countries pass coverage filter", len(filtered))

    X_raw_sig, _, regions = _build_feature_matrix(filtered, return_regions=True)
    y = np.array([math.log(float(r["population"])) for r in filtered])

    continents = np.array([UN_REGION_TO_CONTINENT.get(r, "") for r in regions])
    dummies = np.zeros((len(continents), len(KEPT_CONTINENTS)))
    for i, cont in enumerate(continents):
        if cont in KEPT_CONTINENTS:
            dummies[i, KEPT_CONTINENTS.index(cont)] = 1.0
    X_raw = np.hstack([X_raw_sig, dummies])

    cv = KFold(n_splits=n_splits, shuffle=True, random_state=42)

    log.info("[evaluate] Running %d-fold CV with ElasticNet + continent features...", n_splits)

    all_fold_r2s = []
    all_fold_rmses = []
    for train_idx, val_idx in cv.split(X_raw):
        X_tr, X_va = X_raw[train_idx], X_raw[val_idx]
        y_tr, y_va = y[train_idx], y[val_idx]

        scaler_fold = StandardScaler()
        X_tr_s = scaler_fold.fit_transform(X_tr)
        X_va_s = scaler_fold.transform(X_va)

        w_fold, int_fold, _ = _fit_ridge(X_tr_s, y_tr)

        y_pred = X_va_s @ w_fold + int_fold
        mse = float(np.mean((y_va - y_pred) ** 2))
        ss_res_f = float(np.sum((y_va - y_pred) ** 2))
        ss_tot_f = float(np.sum((y_va - np.mean(y_va)) ** 2))
        r2 = 1.0 - ss_res_f / ss_tot_f if ss_tot_f > 0 else 0.0
        all_fold_r2s.append(r2)
        all_fold_rmses.append(np.sqrt(mse))

    r2_scores = np.array(all_fold_r2s)
    rmse_scores = np.array(all_fold_rmses)
    log.info("[evaluate] CV R²=%.4f±%.4f  RMSE=%.4f±%.4f",
             r2_scores.mean(), r2_scores.std(), rmse_scores.mean(), rmse_scores.std())

    return {
        "n_countries":  len(filtered),
        "n_splits":     n_splits,
        "cv_r2_mean":   round(float(r2_scores.mean()), 4),
        "cv_r2_std":    round(float(r2_scores.std()), 4),
        "cv_rmse_mean": round(float(rmse_scores.mean()), 4),
        "cv_rmse_std":  round(float(rmse_scores.std()), 4),
        "best_alpha":   0.0,
        "r2_by_fold":   [round(v, 4) for v in r2_scores.tolist()],
        "rmse_by_fold": [round(v, 4) for v in rmse_scores.tolist()],
    }


def compute_feature_importance(model_id: int | None = None) -> dict:
    """
    Returns coefficient magnitudes for the most recent (or specified) model,
    sorted by absolute value descending.

    Coefficients are in standardised (scaled) space — they are directly
    comparable as measures of relative feature importance.
    """
    with get_conn() as conn:
        with conn.cursor() as cur:
            if model_id:
                cur.execute("SELECT * FROM model_weights WHERE id = %s", (model_id,))
            else:
                cur.execute("SELECT * FROM model_weights WHERE version = 'v3' ORDER BY trained_at DESC LIMIT 1")
            row = cur.fetchone()
            if not row:
                return {}
            cols = [desc[0] for desc in cur.description]
            model = dict(zip(cols, row))

    coefs = {k: model[k] for k in ALL_FEATURE_KEYS if k in model}
    sorted_coefs = sorted(coefs.items(), key=lambda x: abs(x[1]), reverse=True)
    region_coefs = model.get("region_coefs") or {}

    return {
        "model_id":      model["id"],
        "trained_at":    str(model["trained_at"]),
        "r_squared":     model["r_squared"],
        "cv_r_squared":  model.get("cv_r_squared"),
        "n_training":    model["n_training"],
        "intercept":     model["intercept"],
        "lambda":        model["lambda"],
        "coefficients":  dict(sorted_coefs),
        "region_coefs":  region_coefs,
    }


def coverage_distribution() -> dict:
    """
    Summarises signal coverage across all countries in the DB.
    Useful for monitoring how many countries would be affected by coverage thresholds.
    """
    rows = load_all_training_data()
    tiers = {"full": 0, "high": 0, "med": 0, "low": 0, "insufficient": 0}
    by_country = {}

    for r in rows:
        cov = signal_coverage(r)
        by_country[r["iso2"]] = round(cov, 2)
        if cov >= 1.0:
            tiers["full"] += 1
        elif cov >= 0.8:
            tiers["high"] += 1
        elif cov >= 0.6:
            tiers["med"] += 1
        elif cov >= 0.4:
            tiers["low"] += 1
        else:
            tiers["insufficient"] += 1

    return {
        "total":     len(rows),
        "tiers":     tiers,
        "countries": by_country,
    }


def top_outliers(model_id: int | None = None, n: int = 20) -> list[dict]:
    """
    Returns the N countries with the largest out-of-fold residuals
    for the given (or most recent) model.

    Raises ValueError if a specific model_id is requested but not found,
    rather than silently falling back to the latest model.
    """
    models = load_model_history()
    if not models:
        return []

    if model_id is not None:
        target_model = next((m for m in models if m["id"] == model_id), None)
        if target_model is None:
            raise ValueError(
                f"model_id={model_id} not found in model_weights. "
                f"Available IDs: {[m['id'] for m in models]}"
            )
    else:
        target_model = models[0]

    residuals = load_residuals(target_model["id"])
    sorted_residuals = sorted(residuals.items(), key=lambda x: x[1], reverse=True)

    return [
        {"iso2": iso2, "residual": round(resid, 4), "model_id": target_model["id"]}
        for iso2, resid in sorted_residuals[:n]
    ]


def model_health_report() -> dict:
    """
    Returns a structured health report for the latest model.
    Intended for the /api/admin/model-health endpoint.

    Uses cv_r_squared (out-of-fold) for the health threshold check if
    available, falling back to in-sample r_squared for older model rows
    that pre-date the cv_r_squared column.
    """
    models = load_model_history()
    if not models:
        return {"status": "no_model", "message": "No trained model found"}

    latest = models[0]
    # Prefer out-of-fold CV R² for health checks; fall back to in-sample
    cv_r2 = latest.get("cv_r_squared")
    r2    = latest.get("r_squared") or 0.0
    health_r2 = cv_r2 if cv_r2 is not None else r2
    n = latest.get("n_training") or 0

    warnings = []
    if health_r2 < MIN_R2_THRESHOLD:
        label = "CV R²" if cv_r2 is not None else "R²"
        warnings.append(f"{label} = {health_r2} is below the {MIN_R2_THRESHOLD} health threshold")
    if n < MIN_TRAINING_COUNTRIES:
        warnings.append(f"n_training = {n} is below the minimum of {MIN_TRAINING_COUNTRIES}")

    residuals = load_residuals(latest["id"])
    high_resid = {iso2: r for iso2, r in residuals.items() if r > 0.25}

    return {
        "status":                    "ok" if not warnings else "warning",
        "model_id":                  latest["id"],
        "trained_at":                str(latest["trained_at"]),
        "r_squared":                 r2,
        "cv_r_squared":              cv_r2,
        "n_training":                n,
        "lambda":                    latest.get("lambda"),
        "n_versions":                len(models),
        "warnings":                  warnings,
        "high_residual_countries":   len(high_resid),
        "top_outliers":              top_outliers(latest["id"], n=10),
    }


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    log.info("=== Coverage Distribution ===")
    cov = coverage_distribution()
    log.info("  Total countries: %d", cov['total'])
    log.info("  Tier breakdown:  %s", cov['tiers'])

    log.info("=== Cross-Validation Diagnostics ===")
    diag = run_cross_val_diagnostics()
    log.info(json.dumps(diag, indent=2))

    log.info("=== Latest Model Feature Importance ===")
    fi = compute_feature_importance()
    log.info(json.dumps(fi, indent=2))

    log.info("=== Model Health Report ===")
    report = model_health_report()
    log.info(json.dumps(report, indent=2, default=str))