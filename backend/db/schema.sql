
CREATE TABLE IF NOT EXISTS populations (
    id          SERIAL PRIMARY KEY,
    iso2        CHAR(2)      NOT NULL,
    year        INT          NOT NULL,
    population  NUMERIC      NOT NULL,  -- in millions, matching UN data
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