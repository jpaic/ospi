"""
estimator.py  (v2 — signal-only regression)

Replaces the v1 census-anchored correction factor with a log-linear
ridge regression model trained on (signals → log population).

Public API surface unchanged:
  - estimate_population(iso2)               → dict
  - estimate_population_bulk(iso2_list)     → dict[str, dict]
  - estimate_population_history_bulk(...)   → dict[str, list[dict]]

The v2 estimate is census-free at inference time: it uses only the five
infrastructure signals stored in the signals table.  If no trained model
exists yet (model_weights table is empty), the code falls back gracefully
to the v1 correction-factor logic so the API never returns empty data.

v2.1 fixes:
  - StandardScaler applied at inference using scaler_mean/scaler_scale
    persisted in model_weights. Without this, raw signal scores are fed
    into coefficients trained on scaled features → exp() explosions.
  - log_area_km2 included as a feature (derived from static area_km2 in
    country_metadata, same as trainer._build_feature_matrix).
  - area_km2 fetched from country_metadata for all inference countries
    (removes circular dependency on official population).
"""
import math
import logging
from db.connection import get_conn
from services.cache import get_cache
from etl.training.trainer import ALL_FEATURE_KEYS, UN_REGION_TO_CONTINENT

logger = logging.getLogger(__name__)

SIGNAL_KEYS = ["telecom", "electricity", "gdp_per_capita", "nightlights", "road_density"]

# ── v1 fallback constants (used only when model_weights is empty) ─────────────

_V1_WEIGHTS = {
    "telecom":        0.25,
    "electricity":    0.25,
    "gdp_per_capita": 0.20,
    "nightlights":    0.15,
    "road_density":   0.15,
}


# ── Model loading ─────────────────────────────────────────────────────────────

_MODEL_CACHE_KEY = "estimator:model"
_RESID_CACHE_KEY = "estimator:residuals"


def _load_model_and_residuals(conn) -> tuple[dict | None, dict]:
    cache = get_cache()

    cached_model = cache.get(_MODEL_CACHE_KEY)
    if cached_model is not None:
        cached_resids = cache.get(_RESID_CACHE_KEY) or {}
        return cached_model, cached_resids

    with conn.cursor() as cur:
        cur.execute(
            "SELECT * FROM model_weights WHERE version = 'v3' ORDER BY trained_at DESC LIMIT 1"
        )
        row = cur.fetchone()
        if not row:
            cache.set(_MODEL_CACHE_KEY, None)
            cache.set(_RESID_CACHE_KEY, {})
            return None, {}

        cols = [desc[0] for desc in cur.description]
        model = dict(zip(cols, row))

    with conn.cursor() as cur:
        cur.execute(
            "SELECT iso2, residual FROM model_residuals WHERE model_id = %s",
            (model["id"],),
        )
        residuals = {r[0]: float(r[1]) for r in cur.fetchall()}

    cache.set(_MODEL_CACHE_KEY, model)
    cache.set(_RESID_CACHE_KEY, residuals)
    logger.debug("Loaded model_id=%s (%d residuals)", model["id"], len(residuals))
    return model, residuals


def _invalidate_model_cache():
    """Call after a retrain so the next request picks up fresh weights."""
    get_cache().invalidate(_MODEL_CACHE_KEY)
    get_cache().invalidate(_RESID_CACHE_KEY)
    logger.info("Invalidated estimator cache")


# ── Scaler ────────────────────────────────────────────────────────────────────

def _scale_features(raw: list[float], scaler_mean: list[float], scaler_scale: list[float]) -> list[float]:
    """
    Reproduce sklearn StandardScaler.transform for a single row.
    scaler_mean and scaler_scale are stored in model_weights and follow
    the same column order as ALL_FEATURE_KEYS.
    """
    return [
        (raw[i] - scaler_mean[i]) / scaler_scale[i]
        for i in range(len(raw))
    ]


# ── normalisation helpers ─────────────────────────────────────────────────────

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


# ── log_area helper ───────────────────────────────────────────────────────────

def _log_area_static(area_km2: float | None, fallback: float) -> float:
    """
    log(area_km2) from the static land area stored in country_metadata.
    Fully census-free — no population involved.
    Falls back to the training-set mean log_area if area is missing.
    """
    if area_km2 and float(area_km2) > 0:
        return math.log(float(area_km2))
    return fallback


# ── v2 confidence scoring ─────────────────────────────────────────────────────

def _confidence_v2(coverage: float, residual: float | None) -> str:
    if coverage < 0.4:
        return "low"
    if residual is None:
        if coverage >= 0.8:
            return "high"
        if coverage >= 0.6:
            return "med"
        return "low"
    if coverage >= 0.8 and residual < 0.10:
        return "high"
    if coverage >= 0.6 and residual < 0.25:
        return "med"
    return "low"


# ── v2 core estimate ──────────────────────────────────────────────────────────

def _compute_estimate_v2(
    signals: dict,
    model: dict,
    residuals: dict,
    iso2: str,
    official_pop: float | None = None,
    area_km2: float | None = None,
    region: str | None = None,
) -> dict:
    """
    Log-linear ridge regression estimate with continent-level adjustment.

    signals:     {signal_type: score_0_100}
    model:       row from model_weights (includes scaler_mean, scaler_scale,
                 region_coefs JSONB)
    residuals:   {iso2: abs_log_residual}
    area_km2:    static land area from country_metadata
    region:      UN sub-region for continent adjustment lookup
    """
    available = {k: signals[k] for k in SIGNAL_KEYS if signals.get(k) is not None}
    coverage  = len(available) / len(SIGNAL_KEYS)

    scaler_mean  = model.get("scaler_mean") or []
    scaler_scale = model.get("scaler_scale") or []

    log_area_idx = ALL_FEATURE_KEYS.index("log_area_km2")
    log_area_fallback = float(scaler_mean[log_area_idx]) if scaler_mean else 0.0

    signal_vals = [
        float(available.get(k, scaler_mean[i]))
        for i, k in enumerate(SIGNAL_KEYS)
    ]
    log_area    = _log_area_static(area_km2, log_area_fallback)
    signal_count = len(available)
    raw_features = signal_vals + [log_area, signal_count]

    if scaler_mean and scaler_scale and len(scaler_mean) == len(raw_features):
        features = _scale_features(raw_features, scaler_mean, scaler_scale)
    else:
        features = raw_features

    coefs    = [float(model[k]) for k in ALL_FEATURE_KEYS]
    log_est  = float(model["intercept"]) + sum(c * f for c, f in zip(coefs, features))

    # Continent-level adjustment. Europe is reference (coef absorbed into intercept).
    region_coefs = model.get("region_coefs")
    if region_coefs and region:
        continent = UN_REGION_TO_CONTINENT.get(region)
        if continent:
            log_est += float(region_coefs.get(continent, 0.0))

    estimate = round(math.exp(log_est), 4)

    composite  = sum(float(available.get(k, 0.0)) for k in SIGNAL_KEYS) / len(SIGNAL_KEYS)
    confidence = _confidence_v2(coverage, residuals.get(iso2))

    return {
        "official":         official_pop,
        "estimate":         estimate,
        "composite_signal": round(composite, 2),
        "signal_coverage":  round(coverage, 2),
        "confidence":       confidence,
    }


# ── v1 fallback ───────────────────────────────────────────────────────────────

def _compute_estimate_v1(official_pop: float, signals: dict) -> dict:
    available = {
        k: signals[k]
        for k in _V1_WEIGHTS
        if k in signals and signals[k] is not None
    }
    if not available:
        return {
            "official":         official_pop,
            "estimate":         official_pop,
            "confidence":       "low",
            "composite_signal": None,
            "signal_coverage":  0.0,
        }
    total_weight   = sum(_V1_WEIGHTS[k] for k in available)
    composite      = sum(available[k] * (_V1_WEIGHTS[k] / total_weight) for k in available)
    composite      = round(composite, 1)
    correction     = 0.8 + (composite / 100) * 0.4
    estimate       = round(official_pop * correction, 4)
    coverage       = len(available) / len(SIGNAL_KEYS)
    confidence     = "high" if composite > 75 else "med" if composite > 50 else "low"
    return {
        "official":         official_pop,
        "estimate":         estimate,
        "confidence":       confidence,
        "composite_signal": composite,
        "signal_coverage":  round(coverage, 2),
    }


# ── Data fetchers ─────────────────────────────────────────────────────────────

def get_official_populations(iso2_list: list[str]) -> dict[str, float]:
    if not iso2_list:
        return {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2) iso2, population
                FROM populations
                WHERE iso2 = ANY(%s)
                ORDER BY iso2, year DESC
                """,
                (iso2_list,),
            )
            return {r[0]: float(r[1]) for r in cur.fetchall()}


def get_signals_bulk(iso2_list: list[str]) -> dict[str, dict]:
    if not iso2_list:
        return {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2, signal_type)
                    iso2, signal_type, score
                FROM signals
                WHERE iso2 = ANY(%s)
                ORDER BY iso2, signal_type, year DESC
                """,
                (iso2_list,),
            )
            result: dict[str, dict] = {}
            for iso2, signal_type, score in cur.fetchall():
                result.setdefault(iso2, {})[signal_type] = float(score) if score is not None else None
            return result


def get_area_bulk(iso2_list: list[str]) -> dict[str, float]:
    """Fetch static area_km2 from country_metadata (census-free size anchor)."""
    if not iso2_list:
        return {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, area_km2 FROM country_metadata WHERE iso2 = ANY(%s)",
                (iso2_list,),
            )
            return {
                r[0]: float(r[1])
                for r in cur.fetchall()
                if r[1] is not None and float(r[1]) > 0
            }


def get_region_bulk(iso2_list: list[str]) -> dict[str, str | None]:
    """Fetch UN sub-region for continent adjustment."""
    if not iso2_list:
        return {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, region FROM country_metadata WHERE iso2 = ANY(%s)",
                (iso2_list,),
            )
            return {r[0]: r[1] for r in cur.fetchall()}


def get_gdp_bulk(iso2_list: list[str]) -> dict[str, float | None]:
    """Fetch GDP per capita from country_metadata."""
    if not iso2_list:
        return {}
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT iso2, gdp_per_capita FROM country_metadata WHERE iso2 = ANY(%s)",
                (iso2_list,),
            )
            return {r[0]: float(r[1]) if r[1] is not None else None for r in cur.fetchall()}


# ── Public API ────────────────────────────────────────────────────────────────

def estimate_population_bulk(iso2_list: list[str]) -> dict[str, dict]:
    if isinstance(iso2_list, str):
        iso2_list = [iso2_list]
    if not iso2_list:
        return {}

    official_pops = get_official_populations(iso2_list)
    signals_map   = get_signals_bulk(iso2_list)
    area_map      = get_area_bulk(iso2_list)
    region_map    = get_region_bulk(iso2_list)
    gdp_map       = get_gdp_bulk(iso2_list)

    # Inject gdp_per_capita into signals (log-normalised)
    for iso2 in iso2_list:
        gdp_raw = gdp_map.get(iso2)
        gdp_norm = _normalise_gdp(gdp_raw)
        if gdp_norm is not None:
            signals_map.setdefault(iso2, {})["gdp_per_capita"] = gdp_norm

    with get_conn() as conn:
        model, residuals = _load_model_and_residuals(conn)

    results = {}
    for iso2 in iso2_list:
        official = official_pops.get(iso2)
        signals  = signals_map.get(iso2, {})
        area     = area_map.get(iso2)
        region   = region_map.get(iso2)

        if model:
            est = _compute_estimate_v2(signals, model, residuals, iso2, official, area, region)
        else:
            if official is None:
                results[iso2] = {
                    "official":         None,
                    "estimate":         None,
                    "confidence":       "low",
                    "composite_signal": None,
                    "signal_coverage":  0.0,
                }
                continue
            est = _compute_estimate_v1(official, signals)

        results[iso2] = est

    return results


def estimate_population_history_bulk(iso2_list: list[str]) -> dict[str, list[dict]]:
    if isinstance(iso2_list, str):
        iso2_list = [iso2_list]
    if not iso2_list:
        return {}

    with get_conn() as conn:
        model, residuals = _load_model_and_residuals(conn)
        if model:
            return _estimate_history_v2(iso2_list, model, residuals, conn)
        else:
            return _estimate_history_v1(iso2_list, conn)


def _estimate_history_v2(
    iso2_list: list[str],
    model: dict,
    residuals: dict,
    conn,
) -> dict[str, list[dict]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT iso2, year, population
            FROM populations
            WHERE iso2 = ANY(%s)
            ORDER BY iso2, year ASC
            """,
            (iso2_list,),
        )
        pop_rows = cur.fetchall()

        cur.execute(
            """
            SELECT DISTINCT ON (iso2, signal_type, year)
                iso2, signal_type, year, score
            FROM signals
            WHERE iso2 = ANY(%s)
            ORDER BY iso2, signal_type, year DESC
            """,
            (iso2_list,),
        )
        sig_rows = cur.fetchall()

        cur.execute(
            "SELECT iso2, area_km2, region, gdp_per_capita FROM country_metadata WHERE iso2 = ANY(%s)",
            (iso2_list,),
        )
        metadata = {r[0]: (r[1], r[2], r[3]) for r in cur.fetchall()}

    sig_by_country_year: dict[str, dict[int, dict]] = {}
    for iso2, signal_type, year, score in sig_rows:
        sig_by_country_year.setdefault(iso2, {}).setdefault(year, {})[signal_type] = (
            float(score) if score is not None else None
        )

    # Inject gdp_per_capita into signals for each country (same for all years)
    for iso2 in iso2_list:
        meta = metadata.get(iso2)
        if meta:
            _, _, gdp_raw = meta
            gdp_norm = _normalise_gdp(gdp_raw)
            if gdp_norm is not None:
                for year_sigs in sig_by_country_year.get(iso2, {}).values():
                    year_sigs["gdp_per_capita"] = gdp_norm

    results: dict[str, list[dict]] = {iso2: [] for iso2 in iso2_list}

    for iso2, year, population in pop_rows:
        year_sigs = sig_by_country_year.get(iso2, {})
        signals   = year_sigs.get(year)
        if signals is None and year_sigs:
            earlier = [y for y in sorted(year_sigs.keys()) if y <= year]
            if earlier:
                signals = year_sigs[earlier[-1]]
        if signals is None:
            signals = {}

        area, region, _ = metadata.get(iso2, (None, None, None))
        est = _compute_estimate_v2(signals, model, residuals, iso2,
                                    float(population), area, region)
        results.setdefault(iso2, []).append({
            "y": int(year),
            "v": round(est["estimate"], 4),
        })

    return results


def _estimate_history_v1(iso2_list: list[str], conn) -> dict[str, list[dict]]:
    with conn.cursor() as cur:
        cur.execute(
            """
            WITH weights(signal_type, weight) AS (
                VALUES
                    ('telecom', 0.25::numeric),
                    ('electricity', 0.25::numeric),
                    ('gdp_per_capita', 0.20::numeric),
                    ('nightlights', 0.15::numeric),
                    ('road_density', 0.15::numeric)
            ),
            yearly AS (
                SELECT
                    p.iso2,
                    p.year,
                    p.population,
                    ROUND(
                        (SUM(s.score * w.weight) / NULLIF(SUM(w.weight), 0))::numeric,
                        1
                    ) AS composite
                FROM populations p
                LEFT JOIN signals s
                    ON s.iso2 = p.iso2 AND s.year = p.year AND s.score IS NOT NULL
                LEFT JOIN weights w ON w.signal_type = s.signal_type
                WHERE p.iso2 = ANY(%s)
                GROUP BY p.iso2, p.year, p.population
            )
            SELECT
                iso2,
                year,
                CASE
                    WHEN composite IS NULL THEN population
                    ELSE ROUND((population * (0.8 + (composite / 100) * 0.4))::numeric, 1)
                END AS estimate
            FROM yearly
            ORDER BY iso2, year ASC
            """,
            (iso2_list,),
        )
        rows = cur.fetchall()

    results: dict[str, list[dict]] = {iso2: [] for iso2 in iso2_list}
    for iso2, year, estimate in rows:
        results.setdefault(iso2, []).append({"y": int(year), "v": float(estimate)})
    return results


# ── Backward-compatible single-country wrapper ────────────────────────────────

def estimate_population(iso2: str) -> dict:
    return estimate_population_bulk([iso2]).get(iso2, {
        "official": None, "estimate": None,
        "confidence": "low", "composite_signal": None, "signal_coverage": 0.0,
    })