import logging
import math
import numpy as np
from sklearn.model_selection import KFold
from sklearn.preprocessing import StandardScaler
from sklearn.impute import KNNImputer
from sklearn.linear_model import ElasticNetCV
from psycopg2.extras import execute_values

from db.connection import get_conn
from etl.training.constants import MIN_TRAINING_COUNTRIES, MIN_R2_THRESHOLD
from etl.utils.signal_pivot import SIGNAL_KEYS, signal_coverage

log = logging.getLogger(__name__)

ALL_FEATURE_KEYS = list(SIGNAL_KEYS) + ["log_area_km2", "signal_count"]

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

KEPT_CONTINENTS = ["Africa", "Americas", "Asia", "Oceania"]


def _load_training_data(conn) -> list[dict]:
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
                    cm.gdp_per_capita,
                    MAX(CASE WHEN ls.signal_type = 'telecom'      THEN ls.score END) AS telecom,
                    MAX(CASE WHEN ls.signal_type = 'electricity'  THEN ls.score END) AS electricity,
                    MAX(CASE WHEN ls.signal_type = 'nightlights'  THEN ls.score END) AS nightlights,
                    MAX(CASE WHEN ls.signal_type = 'road_density' THEN ls.score END) AS road_density
                FROM latest_pop lp
                LEFT JOIN latest_signals ls ON ls.iso2 = lp.iso2
                LEFT JOIN country_metadata cm ON cm.iso2 = lp.iso2
                GROUP BY lp.iso2, lp.population, cm.area_km2, cm.region, cm.gdp_per_capita
            )
            SELECT * FROM pivoted
            WHERE population IS NOT NULL AND population > 0
        """)
        cols = [desc[0] for desc in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


GDP_MIN = 100
GDP_MAX = 200_000


def _normalise_gdp(gdp_raw: float | None) -> float | None:
    if gdp_raw is None or gdp_raw <= 0:
        return None
    safe = max(min(gdp_raw, GDP_MAX), GDP_MIN)
    log_val = math.log(safe)
    log_min = math.log(GDP_MIN)
    log_max = math.log(GDP_MAX)
    return round(((log_val - log_min) / (log_max - log_min)) * 100, 1)


def _build_feature_matrix(rows: list[dict], return_regions: bool = False) -> tuple[np.ndarray, list[str]]:
    iso2s = [r["iso2"] for r in rows]

    signal_vals = []
    log_areas = []
    regions = []
    for r in rows:
        vals = []
        for k in SIGNAL_KEYS:
            if k == "gdp_per_capita":
                gdp = _normalise_gdp(r.get("gdp_per_capita"))
                vals.append(float(gdp) if gdp is not None else np.nan)
            else:
                vals.append(float(r[k]) if r.get(k) is not None else np.nan)
        signal_vals.append(vals)
        area = r.get("area_km2")
        if area and float(area) > 0:
            log_areas.append(math.log(float(area)))
        else:
            log_areas.append(np.nan)
        regions.append(r.get("region"))

    signal_arr = np.array(signal_vals, dtype=float)
    log_area_arr = np.array(log_areas, dtype=float)

    signal_count = np.sum(~np.isnan(signal_arr), axis=1)

    log_area_mean = float(np.nanmean(log_area_arr)) if np.any(~np.isnan(log_area_arr)) else 0.0
    log_area_arr = np.where(np.isnan(log_area_arr), log_area_mean, log_area_arr)

    imputer = KNNImputer(n_neighbors=5, weights='distance')
    signal_arr_imp = imputer.fit_transform(signal_arr)

    X_rows = np.column_stack([signal_arr_imp, log_area_arr, signal_count])

    result: tuple = (X_rows, iso2s)
    if return_regions:
        result = result + (regions,)
    return result


def _fit_elasticnet(X: np.ndarray, y: np.ndarray) -> tuple:
    model = ElasticNetCV(
        l1_ratio=[0.1, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0],
        alphas=np.logspace(-4, 1, 20),
        cv=5,
        random_state=42,
        max_iter=10000,
        fit_intercept=True,
    )
    model.fit(X, y)
    return model.coef_, model.intercept_, model.alpha_, model.l1_ratio_


def _persist_model(conn, weights: dict, scaler_mean: list, scaler_scale: list,
                   residuals: dict, region_coefs: dict | None = None,
                   elasticnet_alpha: float | None = None,
                   l1_ratio: float | None = None) -> int:
    import json
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO model_weights
                (intercept, telecom, electricity, gdp_per_capita, nightlights, road_density,
                 log_area_km2, signal_count, lambda, l1_ratio, elasticnet_alpha,
                 r_squared, cv_r_squared, n_training, scaler_mean, scaler_scale,
                 region_coefs, version)
            VALUES
                (%(intercept)s, %(telecom)s, %(electricity)s, %(gdp_per_capita)s,
                 %(nightlights)s, %(road_density)s, %(log_area_km2)s, %(signal_count)s,
                 %(lambda)s, %(l1_ratio)s, %(elasticnet_alpha)s,
                 %(r_squared)s, %(cv_r_squared)s, %(n_training)s,
                 %(scaler_mean)s, %(scaler_scale)s, %(region_coefs)s::jsonb,
                 'v3')
            RETURNING id
            """,
            {**weights, "scaler_mean": scaler_mean, "scaler_scale": scaler_scale,
             "region_coefs": json.dumps(region_coefs or {}),
             "elasticnet_alpha": elasticnet_alpha, "l1_ratio": l1_ratio},
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
    log.info("[trainer] Loading training data from DB...")
    with get_conn() as conn:
        rows = _load_training_data(conn)

    log.info("[trainer] Loaded %d countries with source_confidence='high'", len(rows))

    filtered = [r for r in rows if signal_coverage(r) >= 0.4]
    dropped = len(rows) - len(filtered)
    log.info("[trainer] %d pass coverage ≥ 0.4 filter (%d dropped)", len(filtered), dropped)

    if len(filtered) < MIN_TRAINING_COUNTRIES:
        raise RuntimeError(
            f"Training aborted: only {len(filtered)} countries pass the coverage filter "
            f"(minimum {MIN_TRAINING_COUNTRIES}). Run ETL jobs first."
        )

    X_raw_sig, iso2s, regions = _build_feature_matrix(filtered, return_regions=True)
    y = np.array([math.log(float(r["population"])) for r in filtered])
    N_SIG = len(ALL_FEATURE_KEYS)

    continents = np.array([UN_REGION_TO_CONTINENT.get(r, "") for r in regions])
    dummies = np.zeros((len(continents), len(KEPT_CONTINENTS)))
    for i, cont in enumerate(continents):
        if cont in KEPT_CONTINENTS:
            dummies[i, KEPT_CONTINENTS.index(cont)] = 1.0

    X_raw = np.hstack([X_raw_sig, dummies])
    N_CONT = len(KEPT_CONTINENTS)
    log.info("[trainer] X shape: %s  |  y range: [%.2f, %.2f]  |  continents=%s",
             X_raw.shape, y.min(), y.max(), list(KEPT_CONTINENTS))

    cv = KFold(n_splits=5, shuffle=True, random_state=42)

    fold_mses = []
    fold_r2s = []
    for train_idx, val_idx in cv.split(X_raw):
        X_tr, X_va = X_raw[train_idx], X_raw[val_idx]
        y_tr, y_va = y[train_idx], y[val_idx]

        scaler_fold = StandardScaler()
        X_tr_s = scaler_fold.fit_transform(X_tr)
        X_va_s = scaler_fold.transform(X_va)

        w_fold, int_fold, _, _ = _fit_elasticnet(X_tr_s, y_tr)

        y_pred = X_va_s @ w_fold + int_fold
        fold_mses.append(float(np.mean((y_va - y_pred) ** 2)))
        ss_res_f = float(np.sum((y_va - y_pred) ** 2))
        ss_tot_f = float(np.sum((y_va - np.mean(y_va)) ** 2))
        fold_r2s.append(1.0 - ss_res_f / ss_tot_f if ss_tot_f > 0 else 0.0)

    best_cv_mse = float(np.mean(fold_mses))
    best_cv_r2 = float(np.mean(fold_r2s))
    log.info("[trainer] CV R²=%s  |  CV MSE=%s", best_cv_r2, best_cv_mse)

    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)
    w_full, intercept_full, best_alpha, best_l1_ratio = _fit_elasticnet(X, y)

    w_signal = w_full[:N_SIG]
    w_continent = w_full[N_SIG:]
    region_coefs = dict(zip(KEPT_CONTINENTS, [round(float(c), 6) for c in w_continent]))

    y_oof = np.empty(len(y))
    for train_idx, val_idx in cv.split(X_raw):
        X_tr, X_va = X_raw[train_idx], X_raw[val_idx]
        y_tr = y[train_idx]

        scaler_fold = StandardScaler()
        X_tr_s = scaler_fold.fit_transform(X_tr)
        X_va_s = scaler_fold.transform(X_va)

        w_fold, int_fold, _, _ = _fit_elasticnet(X_tr_s, y_tr)
        y_oof[val_idx] = X_va_s @ w_fold + int_fold

    residuals = {iso2: float(abs(y_oof[i] - y[i])) for i, iso2 in enumerate(iso2s)}

    y_pred_insample = X @ w_full + intercept_full
    ss_res = float(np.sum((y - y_pred_insample) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2))
    r_squared_insample = round(1.0 - ss_res / ss_tot, 4)

    coefs_scaled = dict(zip(ALL_FEATURE_KEYS, w_signal.tolist()))
    log.info("[trainer] In-sample R²=%s  CV R²=%s  α=%s  l1_ratio=%s  |  signal coefs=%s  region coefs=%s",
             r_squared_insample, best_cv_r2, best_alpha, best_l1_ratio,
             coefs_scaled, region_coefs)

    if best_cv_r2 < MIN_R2_THRESHOLD:
        log.warning("[trainer] CV R²=%s is below %.2f — model quality is low", best_cv_r2, MIN_R2_THRESHOLD)

    weights_row = {
        **coefs_scaled,
        "intercept":      float(intercept_full),
        "lambda":         float(best_alpha),
        "l1_ratio":       float(best_l1_ratio) if best_l1_ratio is not None else None,
        "elasticnet_alpha": float(best_alpha),
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
            elasticnet_alpha=float(best_alpha),
            l1_ratio=float(best_l1_ratio) if best_l1_ratio is not None else None,
        )

    result = {
        "model_id":      model_id,
        "r_squared":     r_squared_insample,
        "cv_r_squared":  best_cv_r2,
        "n_training":    len(filtered),
        "lambda":        float(best_alpha),
        "l1_ratio":      float(best_l1_ratio) if best_l1_ratio is not None else None,
        "elasticnet_alpha": float(best_alpha),
        "coefficients":  coefs_scaled,
        "region_coefs":  region_coefs,
        "intercept":     float(intercept_full),
    }

    log.info(
        "[trainer] ✓ Saved model_id=%s  R²=%s  CV_R²=%s  n=%s  α=%s  l1_ratio=%s  region_coefs=%s",
        model_id, r_squared_insample, best_cv_r2, len(filtered),
        best_alpha, best_l1_ratio, region_coefs,
    )
    return result
