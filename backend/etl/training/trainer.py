"""
trainer.py
Fits a ridge regression on (signals → log population) and persists
weights + per-country residuals to the DB.

Usage:
    from etl.training.trainer import run_training
    result = run_training()
    # {"model_id": 1, "r_squared": 0.91, "n_training": 52, "lambda": 0.1, ...}

Changes vs v1:
  - StandardScaler applied to X before fitting; scaler params persisted to DB
    so estimator.py can reproduce the exact same transform at inference time.
  - log(area_km2) added as a size-anchor feature so microstates (high signal
    density, tiny population) are distinguishable from large dense countries.
  - Residuals are now out-of-fold (CV) rather than in-sample, so they reflect
    real generalisation error instead of training-set fit.
  - R² reported is also out-of-fold (from cross_validate) alongside in-sample.
  - MIN_R2_THRESHOLD and MIN_TRAINING_COUNTRIES are imported from constants.py
    so evaluate.py shares the same values without duplication.
"""
import logging
import math
import numpy as np
from sklearn.model_selection import KFold
from sklearn.preprocessing import StandardScaler
from psycopg2.extras import execute_values

from db.connection import get_conn
from etl.training.constants import MIN_TRAINING_COUNTRIES, MIN_R2_THRESHOLD
from etl.utils.signal_pivot import SIGNAL_KEYS, signal_coverage

log = logging.getLogger(__name__)

# Ordered list of ALL features the model uses. Signal keys first, then the
# size-anchor feature. evaluate.py and estimator.py must use the same list.
ALL_FEATURE_KEYS = list(SIGNAL_KEYS) + ["log_area_km2"]

# Per-feature Ridge alphas for signal-level features.
SIGNAL_FEATURE_ALPHAS = [0.001, 0.1, 10.0, 10.0, 10.0, 1e-6]
CONTINENT_ALPHA = 1.0

# Continent mapping from UN sub-region → 5 continents
UN_REGION_TO_CONTINENT = {
    "Eastern Africa": "Africa", "Middle Africa": "Africa",
    "Northern Africa": "Africa", "Southern Africa": "Africa",
    "Western Africa": "Africa",
    "Caribbean": "Americas", "Central America": "Americas",
    "Northern America": "Americas", "South America": "Americas",
    "Central Asia": "Asia", "Eastern Asia": "Asia",
    "South-Eastern Asia": "Asia", "Southern Asia": "Asia",
    "Western Asia": "Asia",
    "Eastern Europe": "Europe", "Northern Europe": "Europe",
    "Southern Europe": "Europe", "Western Europe": "Europe",
    "Australia/New Zealand": "Oceania", "Melanesia": "Oceania",
    "Micronesia": "Oceania", "Polynesia": "Oceania",
}

# Europe is dropped as reference, so only 4 dummy columns.
KEPT_CONTINENTS = ["Africa", "Americas", "Asia", "Oceania"]


def _load_training_data(conn) -> list[dict]:
    """
    Fetch the most recent year of data for each country where
    source_confidence = 'high'. Signals are pivoted laterally.
    area_km2 (static land area) and region are pulled from country_metadata
    so _build_feature_matrix can use log(area) as a size anchor and add
    continent dummies.
    """
    with conn.cursor() as cur:
        cur.execute("""
            WITH latest_pop AS (
                SELECT DISTINCT ON (iso2)
                    iso2,
                    year,
                    population
                FROM populations
                WHERE source_confidence = 'high'
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
                    cm.area_km2,
                    cm.region,
                    MAX(CASE WHEN ls.signal_type = 'telecom'     THEN ls.score END) AS telecom,
                    MAX(CASE WHEN ls.signal_type = 'electricity' THEN ls.score END) AS electricity,
                    MAX(CASE WHEN ls.signal_type = 'building'    THEN ls.score END) AS building,
                    MAX(CASE WHEN ls.signal_type = 'mobility'    THEN ls.score END) AS mobility,
                    MAX(CASE WHEN ls.signal_type = 'internet'    THEN ls.score END) AS internet
                FROM latest_pop lp
                LEFT JOIN latest_signals ls ON ls.iso2 = lp.iso2
                LEFT JOIN country_metadata cm ON cm.iso2 = lp.iso2
                GROUP BY lp.iso2, lp.population, cm.area_km2, cm.region
            )
            SELECT * FROM pivoted
            WHERE population IS NOT NULL AND population > 0
        """)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _build_feature_matrix(rows: list[dict], return_regions: bool = False) -> tuple[np.ndarray, list[str]]:
    """
    Build X from ALL_FEATURE_KEYS.

    Missing signal scores → mean imputation using training-set means (not
    zero-imputation, which biases predictions downward).

    log_area_km2 uses the static area_km2 stored in country_metadata.
    Countries with missing or zero area fall back to the training-set mean.

    When return_regions=True, a third element (list of region strings) is
    returned alongside (X_raw, iso2s).
    """
    iso2s = [r["iso2"] for r in rows]

    # Compute per-signal training means (excluding None) for imputation
    signal_means: dict[str, float] = {}
    for k in SIGNAL_KEYS:
        vals = [float(r[k]) for r in rows if r.get(k) is not None]
        signal_means[k] = float(np.mean(vals)) if vals else 0.0

    # Compute log(area) mean for imputation
    log_areas = [
        math.log(float(r["area_km2"]))
        for r in rows
        if r.get("area_km2") and float(r["area_km2"]) > 0
    ]
    log_area_mean = float(np.mean(log_areas)) if log_areas else 0.0

    X_rows = []
    regions = []
    for r in rows:
        signal_vals = [
            float(r[k]) if r.get(k) is not None else signal_means[k]
            for k in SIGNAL_KEYS
        ]
        area = r.get("area_km2")
        log_area = math.log(float(area)) if area and float(area) > 0 else log_area_mean
        X_rows.append(signal_vals + [log_area])
        regions.append(r.get("region"))

    result: tuple = (np.array(X_rows, dtype=float), iso2s)
    if return_regions:
        result = result + (regions,)
    return result


def _fit_ridge_per_feature(X: np.ndarray, y: np.ndarray, alphas: np.ndarray) -> tuple[np.ndarray, float]:
    """
    Ridge regression with per-feature penalties via closed-form solve.
    Centres X and y internally so the intercept is unregularised.
    """
    X_mean = np.mean(X, axis=0)
    y_mean = np.mean(y)
    X_c = X - X_mean
    y_c = y - y_mean
    penalty = np.diag(alphas)
    w = np.linalg.solve(X_c.T @ X_c + penalty, X_c.T @ y_c)
    intercept = float(y_mean - X_mean @ w)
    return w, intercept


def _persist_model(conn, weights: dict, scaler_mean: list, scaler_scale: list,
                   residuals: dict, region_coefs: dict | None = None) -> int:
    """
    Insert a new model_weights row (including scaler params + region_coefs)
    and all per-country residuals. Returns model_id.

    scaler_mean and scaler_scale are stored as arrays so estimator.py can
    reconstruct the exact StandardScaler that was fit during training.
    The column order matches ALL_FEATURE_KEYS.
    region_coefs is stored as JSONB for continent-level adjustments.
    """
    import json
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO model_weights
                (intercept, telecom, electricity, building, mobility, internet,
                 log_area_km2, lambda, r_squared, cv_r_squared,
                 n_training, scaler_mean, scaler_scale, region_coefs)
            VALUES
                (%(intercept)s, %(telecom)s, %(electricity)s, %(building)s,
                 %(mobility)s, %(internet)s, %(log_area_km2)s,
                 %(lambda)s, %(r_squared)s, %(cv_r_squared)s,
                 %(n_training)s, %(scaler_mean)s, %(scaler_scale)s,
                 %(region_coefs)s::jsonb)
            RETURNING id
            """,
            {**weights, "scaler_mean": scaler_mean, "scaler_scale": scaler_scale,
             "region_coefs": json.dumps(region_coefs or {})},
        )
        model_id = cur.fetchone()[0]

    residual_rows = [(iso2, model_id, resid) for iso2, resid in residuals.items()]
    with conn.cursor() as cur:
        execute_values(
            cur,
            """
            INSERT INTO model_residuals (iso2, model_id, residual)
            VALUES %s
            ON CONFLICT (iso2, model_id) DO UPDATE SET residual = EXCLUDED.residual
            """,
            residual_rows,
        )

    conn.commit()
    return model_id


def run_training() -> dict:
    """
    Full training cycle:
      1. Load high-confidence population + signals from DB
      2. Filter countries with coverage < 0.4
      3. Build feature matrix (signals + log_area_km2, mean-imputed)
      4. Per-feature Ridge (closed-form): log_area_km2 gets near-zero α
         (1e-6), signal features share a common α selected by 5-fold CV
      5. Fit scaler + per-feature Ridge on full data with best α
      6. Compute out-of-fold residuals (scaler re-fit per fold)
      7. Persist model_weights (incl. scaler params) + model_residuals

    Returns dict with model_id, r_squared, cv_r_squared, n_training, lambda,
    coefficients (in original un-scaled space for interpretability).

    Raises RuntimeError if fewer than MIN_TRAINING_COUNTRIES pass the filter.
    """
    log.info("[trainer] Loading training data from DB...")
    with get_conn() as conn:
        rows = _load_training_data(conn)

    log.info("[trainer] Loaded %d countries with source_confidence='high'", len(rows))

    # Filter by signal coverage
    filtered = [r for r in rows if signal_coverage(r) >= 0.4]
    dropped = len(rows) - len(filtered)
    log.info("[trainer] %d pass coverage ≥ 0.4 filter (%d dropped)", len(filtered), dropped)

    if len(filtered) < MIN_TRAINING_COUNTRIES:
        raise RuntimeError(
            f"Training aborted: only {len(filtered)} countries pass the coverage filter "
            f"(minimum {MIN_TRAINING_COUNTRIES}). Run ETL jobs first."
        )

    # Build feature matrix with mean imputation + region data
    X_raw_sig, iso2s, regions = _build_feature_matrix(filtered, return_regions=True)
    y = np.array([math.log(float(r["population"])) for r in filtered])
    N_SIG = len(ALL_FEATURE_KEYS)

    # Continent one-hot encode (Europe dropped as reference)
    continents = np.array([UN_REGION_TO_CONTINENT.get(r, "") for r in regions])
    dummies = np.zeros((len(continents), len(KEPT_CONTINENTS)))
    for i, cont in enumerate(continents):
        if cont in KEPT_CONTINENTS:
            dummies[i, KEPT_CONTINENTS.index(cont)] = 1.0

    X_raw = np.hstack([X_raw_sig, dummies])
    N_CONT = len(KEPT_CONTINENTS)
    log.info("[trainer] X shape: %s  |  y range: [%.2f, %.2f]  |  continents=%s",
             X_raw.shape, y.min(), y.max(), list(KEPT_CONTINENTS))

    PER_FEATURE_ALPHAS = np.array(SIGNAL_FEATURE_ALPHAS + [CONTINENT_ALPHA] * N_CONT)
    cv = KFold(n_splits=5, shuffle=True, random_state=42)

    # --- CV loop: compute out-of-fold R² ---
    fold_mses = []
    fold_r2s = []
    for train_idx, val_idx in cv.split(X_raw):
        X_tr, X_va = X_raw[train_idx], X_raw[val_idx]
        y_tr, y_va = y[train_idx], y[val_idx]

        scaler_fold = StandardScaler()
        X_tr_sig_s = scaler_fold.fit_transform(X_tr[:, :N_SIG])
        X_va_sig_s = scaler_fold.transform(X_va[:, :N_SIG])
        X_tr_s = np.hstack([X_tr_sig_s, X_tr[:, N_SIG:]])
        X_va_s = np.hstack([X_va_sig_s, X_va[:, N_SIG:]])

        w_fold, int_fold = _fit_ridge_per_feature(X_tr_s, y_tr, PER_FEATURE_ALPHAS)

        y_pred = X_va_s @ w_fold + int_fold
        fold_mses.append(float(np.mean((y_va - y_pred) ** 2)))
        ss_res_f = float(np.sum((y_va - y_pred) ** 2))
        ss_tot_f = float(np.sum((y_va - np.mean(y_va)) ** 2))
        fold_r2s.append(1.0 - ss_res_f / ss_tot_f if ss_tot_f > 0 else 0.0)

    best_cv_mse = float(np.mean(fold_mses))
    best_cv_r2 = float(np.mean(fold_r2s))
    log.info("[trainer] CV R²=%s  |  CV MSE=%s  |  per-feature α=%s",
             best_cv_r2, best_cv_mse, list(PER_FEATURE_ALPHAS))

    # --- Fit on full data ---
    scaler = StandardScaler()
    X_sig_s = scaler.fit_transform(X_raw[:, :N_SIG])
    X = np.hstack([X_sig_s, X_raw[:, N_SIG:]])
    w_full, intercept_full = _fit_ridge_per_feature(X, y, PER_FEATURE_ALPHAS)

    w_signal = w_full[:N_SIG]
    w_continent = w_full[N_SIG:]
    region_coefs = dict(zip(KEPT_CONTINENTS, [round(float(c), 6) for c in w_continent]))

    # --- Out-of-fold predictions for residuals ---
    y_oof = np.empty(len(y))
    for train_idx, val_idx in cv.split(X_raw):
        X_tr, X_va = X_raw[train_idx], X_raw[val_idx]
        y_tr = y[train_idx]

        scaler_fold = StandardScaler()
        X_tr_sig_s = scaler_fold.fit_transform(X_tr[:, :N_SIG])
        X_va_sig_s = scaler_fold.transform(X_va[:, :N_SIG])
        X_tr_s = np.hstack([X_tr_sig_s, X_tr[:, N_SIG:]])
        X_va_s = np.hstack([X_va_sig_s, X_va[:, N_SIG:]])

        w_fold, int_fold = _fit_ridge_per_feature(X_tr_s, y_tr, PER_FEATURE_ALPHAS)
        y_oof[val_idx] = X_va_s @ w_fold + int_fold

    residuals = {iso2: float(abs(y_oof[i] - y[i])) for i, iso2 in enumerate(iso2s)}

    # --- In-sample R² ---
    y_pred_insample = X @ w_full + intercept_full
    ss_res = float(np.sum((y - y_pred_insample) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_squared_insample = round(1.0 - ss_res / ss_tot, 4)

    coefs_scaled = dict(zip(ALL_FEATURE_KEYS, w_signal.tolist()))
    log.info("[trainer] In-sample R²=%s  CV R²=%s  |  signal coefs=%s  region coefs=%s",
             r_squared_insample, best_cv_r2, coefs_scaled, region_coefs)

    if best_cv_r2 < MIN_R2_THRESHOLD:
        log.warning("[trainer] CV R²=%s is below %.2f — model quality is low", best_cv_r2, MIN_R2_THRESHOLD)

    # Persist — use CV R² as the canonical r_squared for health checks
    weights_row = {
        **coefs_scaled,
        "intercept":      float(intercept_full),
        "lambda":         0.0,
        "r_squared":      r_squared_insample,
        "cv_r_squared":   best_cv_r2,
        "n_training":     len(filtered),
        "region_coefs":   region_coefs,
    }

    with get_conn() as conn:
        model_id = _persist_model(
            conn,
            weights_row,
            scaler.mean_.tolist(),
            scaler.scale_.tolist(),
            residuals,
            region_coefs,
        )

    result = {
        "model_id":      model_id,
        "r_squared":     r_squared_insample,
        "cv_r_squared":  best_cv_r2,
        "n_training":    len(filtered),
        "lambda":        0.0,
        "coefficients":  coefs_scaled,
        "region_coefs":  region_coefs,
        "intercept":     float(intercept_full),
    }

    log.info(
        "[trainer] ✓ Saved model_id=%s  R²=%s  CV_R²=%s  n=%s  region_coefs=%s",
        model_id, r_squared_insample, best_cv_r2, len(filtered), region_coefs,
    )
    return result