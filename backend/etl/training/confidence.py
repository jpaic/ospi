"""
confidence.py
Automatically computes and updates source_confidence for all countries
based on actual data quality — signal coverage and population time-series
completeness — rather than a manual allowlist.

Logic
-----
A country's confidence is determined by two factors:

1. Signal coverage  — what fraction of the 5 signals (telecom, electricity,
   building, mobility, internet) are non-null in the most recent year.

2. Population years — how many distinct years of population data exist
   for that country (out of the possible 2010–2024 window = 15 years).
   More years = more stable time-series = more trustworthy anchor.

Thresholds (tunable via constants.py):

    HIGH:   signal_coverage >= 0.8  AND  pop_years >= 10
    MED:    signal_coverage >= 0.4  AND  pop_years >= 5
    LOW:    everything else with at least 1 signal or 1 pop year
    (countries with no data at all stay 'unknown')

This replaces source_confidence_patch.sql entirely. Run it as part of
the ETL pipeline after signals and populations have been loaded.

Usage
-----
    from etl.training.confidence import update_confidence
    update_confidence()   # updates populations.source_confidence in-place
"""
import logging
from db.connection import get_conn
from etl.utils.signal_pivot import SIGNAL_KEYS

log = logging.getLogger(__name__)

# Thresholds — edit here, nowhere else
HIGH_COVERAGE  = 1.0   # all 5 signals present
HIGH_POP_YEARS = 5    # at least 5 of 15 possible years
MED_COVERAGE   = 0.6
MED_POP_YEARS  = 8


def _compute_confidence(signal_coverage: float, pop_years: int) -> str:
    if signal_coverage >= HIGH_COVERAGE and pop_years >= HIGH_POP_YEARS:
        return "high"
    if signal_coverage >= MED_COVERAGE and pop_years >= MED_POP_YEARS:
        return "med"
    if signal_coverage > 0 or pop_years > 0:
        return "low"
    return "unknown"


def update_confidence() -> dict[str, int]:
    """
    Recompute source_confidence for every iso2 in populations and update
    the column in-place. Returns a summary dict of counts per tier.
    """
    log.info("[confidence] Computing signal coverage and population completeness...")

    with get_conn() as conn:
        with conn.cursor() as cur:

            # Latest signal score per (iso2, signal_type)
            cur.execute("""
                SELECT DISTINCT ON (iso2, signal_type)
                    iso2,
                    signal_type,
                    score
                FROM signals
                ORDER BY iso2, signal_type, year DESC
            """)
            signal_rows = cur.fetchall()

            # Count distinct population years per iso2
            cur.execute("""
                SELECT iso2, COUNT(DISTINCT year) AS pop_years
                FROM populations
                GROUP BY iso2
            """)
            pop_year_counts = {row[0]: int(row[1]) for row in cur.fetchall()}

            # All iso2s that have any population data
            cur.execute("SELECT DISTINCT iso2 FROM populations")
            all_iso2s = {row[0] for row in cur.fetchall()}

        # Build signal coverage per iso2
        signals_by_iso2: dict[str, dict] = {}
        for iso2, signal_type, score in signal_rows:
            if iso2 not in signals_by_iso2:
                signals_by_iso2[iso2] = {}
            if score is not None:
                signals_by_iso2[iso2][signal_type] = score

        def _coverage(iso2: str) -> float:
            sigs = signals_by_iso2.get(iso2, {})
            return sum(1 for k in SIGNAL_KEYS if sigs.get(k) is not None) / len(SIGNAL_KEYS)

        # Compute confidence for every iso2
        assignments: dict[str, str] = {}
        for iso2 in all_iso2s:
            cov       = _coverage(iso2)
            pop_years = pop_year_counts.get(iso2, 0)
            assignments[iso2] = _compute_confidence(cov, pop_years)

        # Bulk update
        with conn.cursor() as cur:
            for iso2, confidence in assignments.items():
                cur.execute(
                    "UPDATE populations SET source_confidence = %s WHERE iso2 = %s",
                    (confidence, iso2),
                )
        conn.commit()

    # Summary
    counts: dict[str, int] = {"high": 0, "med": 0, "low": 0, "unknown": 0}
    for c in assignments.values():
        counts[c] = counts.get(c, 0) + 1

    log.info(
        "[confidence] Updated %d countries — high=%d  med=%d  low=%d  unknown=%d",
        len(assignments), counts["high"], counts["med"], counts["low"], counts["unknown"],
    )
    return counts


if __name__ == "__main__":
    import json
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    result = update_confidence()
    log.info(json.dumps(result, indent=2))