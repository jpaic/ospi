-- model_schema_patch.sql
-- Run once against the live DB to add model persistence tables.
-- Idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- NOTE: this is additive only — never DROP old columns — so both
-- main (v2) and develop (v3) branches work against the same DB.

-- ── Core tables ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS model_weights (
    id           SERIAL PRIMARY KEY,
    trained_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    intercept    FLOAT NOT NULL,
    telecom      FLOAT NOT NULL DEFAULT 0,
    electricity  FLOAT NOT NULL DEFAULT 0,
    building     FLOAT NOT NULL DEFAULT 0,
    mobility     FLOAT NOT NULL DEFAULT 0,
    internet     FLOAT NOT NULL DEFAULT 0,
    lambda       FLOAT NOT NULL,
    r_squared    FLOAT,
    n_training   INT
);

CREATE TABLE IF NOT EXISTS model_residuals (
    iso2         CHAR(2)  NOT NULL,
    model_id     INT      NOT NULL REFERENCES model_weights(id) ON DELETE CASCADE,
    residual     FLOAT    NOT NULL,   -- |log(pred) - log(actual)|
    PRIMARY KEY (iso2, model_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'populations'
        AND column_name = 'source_confidence'
    ) THEN
        ALTER TABLE populations
            ADD COLUMN source_confidence TEXT DEFAULT 'unknown'
            CHECK (source_confidence IN ('high', 'med', 'low', 'unknown'));
    END IF;
END $$;

-- ── v2 additions ───────────────────────────────────────────────────────────────

ALTER TABLE model_weights
    ADD COLUMN IF NOT EXISTS l1_ratio         FLOAT,
    ADD COLUMN IF NOT EXISTS elasticnet_alpha FLOAT;

ALTER TABLE model_weights
    ADD COLUMN IF NOT EXISTS version TEXT;

-- Backfill: models with elasticnet_alpha are v3, all others are v2
UPDATE model_weights SET version = 'v3' WHERE version IS NULL AND elasticnet_alpha IS NOT NULL;
UPDATE model_weights SET version = 'v2' WHERE version IS NULL;