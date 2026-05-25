CREATE INDEX IF NOT EXISTS idx_signals_iso2_year_type
ON signals (iso2, year, signal_type);
