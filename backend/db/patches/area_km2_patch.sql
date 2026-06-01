-- area_km2_patch.sql
-- Run once against the live DB to add static land area column.
-- Idempotent: uses ADD COLUMN IF NOT EXISTS.

ALTER TABLE country_metadata
    ADD COLUMN IF NOT EXISTS area_km2 NUMERIC;
