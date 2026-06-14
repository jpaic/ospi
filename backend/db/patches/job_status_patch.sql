-- job_status_patch.sql
-- Idempotent: uses IF NOT EXISTS / OR REPLACE so safe to re-run.

CREATE TABLE IF NOT EXISTS job_status (
    job_id      TEXT PRIMARY KEY,
    status      TEXT NOT NULL DEFAULT 'idle',
    result      JSONB,
    error       TEXT,
    started_at  TIMESTAMPTZ DEFAULT now(),
    finished_at TIMESTAMPTZ,
    CHECK (status IN ('idle', 'running', 'completed', 'failed'))
);
