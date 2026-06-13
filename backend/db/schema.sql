
CREATE TABLE IF NOT EXISTS country_metadata (
    iso2          CHAR(2)      PRIMARY KEY,
    iso3          CHAR(3),
    name          TEXT         NOT NULL,
    lat           NUMERIC,
    lng           NUMERIC,
    region        TEXT,
    urban_pct     NUMERIC      DEFAULT 0,
    density_km2   NUMERIC      DEFAULT 0,
    area_km2      NUMERIC,
    gdp_per_capita NUMERIC     DEFAULT 0,
    fetched_at    TIMESTAMPTZ  DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_country_metadata_iso3 ON country_metadata (iso3);

CREATE TABLE IF NOT EXISTS populations (
    id                SERIAL PRIMARY KEY,
    iso2              CHAR(2)      NOT NULL,
    year              INT          NOT NULL,
    population        NUMERIC      NOT NULL,
    source_confidence TEXT         DEFAULT 'unknown'
                      CHECK (source_confidence IN ('high', 'med', 'low', 'unknown')),
    fetched_at        TIMESTAMPTZ  DEFAULT now(),

    UNIQUE (iso2, year)
);

CREATE INDEX IF NOT EXISTS idx_populations_iso2 ON populations (iso2);

CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,

    iso2 CHAR(2) NOT NULL,

    signal_type TEXT NOT NULL,

    raw_value NUMERIC,

    score NUMERIC,

    year INT,

    fetched_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE (iso2, signal_type, year)
);

CREATE INDEX IF NOT EXISTS idx_signals_iso2
ON signals (iso2);

CREATE INDEX IF NOT EXISTS idx_signals_type
ON signals (signal_type);

CREATE INDEX IF NOT EXISTS idx_signals_year
ON signals (year);

CREATE INDEX IF NOT EXISTS idx_signals_iso2_year_type
ON signals (iso2, year, signal_type);

-- ── ML model persistence ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_weights (
    id                SERIAL PRIMARY KEY,
    trained_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    intercept         FLOAT NOT NULL,
    telecom           FLOAT NOT NULL DEFAULT 0,
    electricity       FLOAT NOT NULL DEFAULT 0,
    gdp_per_capita    FLOAT NOT NULL DEFAULT 0,
    nightlights       FLOAT NOT NULL DEFAULT 0,
    road_density      FLOAT NOT NULL DEFAULT 0,
    signal_count      FLOAT NOT NULL DEFAULT 0,
    lambda            FLOAT NOT NULL,          -- regularisation strength used
    l1_ratio          FLOAT,                   -- ElasticNet L1 mix ratio
    elasticnet_alpha  FLOAT,                   -- ElasticNet best alpha
    r_squared         FLOAT,                   -- goodness of fit on training set
    n_training        INT,                     -- number of countries used
    region_coefs      JSONB,                   -- continent-level bias adjustments
    version           TEXT                     -- 'v2' (Ridge) or 'v3' (ElasticNet)
);

CREATE TABLE IF NOT EXISTS model_residuals (
    iso2         CHAR(2)      NOT NULL,
    model_id     INT          NOT NULL REFERENCES model_weights(id) ON DELETE CASCADE,
    residual     FLOAT        NOT NULL,   -- |log(pred) - log(actual)|
    PRIMARY KEY (iso2, model_id)
);
