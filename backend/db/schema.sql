
CREATE TABLE IF NOT EXISTS country_metadata (
    iso2          CHAR(2)      PRIMARY KEY,
    iso3          CHAR(3),
    name          TEXT         NOT NULL,
    lat           NUMERIC,
    lng           NUMERIC,
    region        TEXT,
    urban_pct     NUMERIC      DEFAULT 0,
    density_km2   NUMERIC      DEFAULT 0,
    gdp_per_capita NUMERIC     DEFAULT 0,
    fetched_at    TIMESTAMPTZ  DEFAULT now()
);
 
CREATE INDEX IF NOT EXISTS idx_country_metadata_iso3 ON country_metadata (iso3);

CREATE TABLE IF NOT EXISTS populations (
    id          SERIAL PRIMARY KEY,
    iso2        CHAR(2)      NOT NULL,
    year        INT          NOT NULL,
    population  NUMERIC      NOT NULL,
    fetched_at  TIMESTAMPTZ  DEFAULT now(),

    UNIQUE (iso2, year)
);

CREATE INDEX idx_populations_iso2 ON populations (iso2);

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

CREATE INDEX idx_signals_iso2
ON signals (iso2);

CREATE INDEX idx_signals_type
ON signals (signal_type);

CREATE INDEX idx_signals_year
ON signals (year);

CREATE INDEX IF NOT EXISTS idx_signals_iso2_year_type
ON signals (iso2, year, signal_type);
