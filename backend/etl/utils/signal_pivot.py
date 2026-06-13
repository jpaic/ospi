"""
signal_pivot.py
Turns a list of (iso2, signal_type, value) rows into a dict keyed by iso2
with sub-dicts of {signal_type: value}.
"""
from collections import defaultdict

SIGNAL_KEYS = ["telecom", "electricity", "gdp_per_capita", "nightlights", "road_density"]


def pivot_signals(rows: list[dict]) -> dict[str, dict]:
    """
    Input:  [{"iso2": "DE", "signal_type": "telecom", "value": 82.3}, ...]
    Output: {"DE": {"telecom": 82.3, ...}, ...}
    """
    result = defaultdict(dict)
    for row in rows:
        result[row["iso2"]][row["signal_type"]] = row["value"]
    return dict(result)


def signal_coverage(signals: dict) -> float:
    """Returns fraction of the 5 required signals that are non-null."""
    return sum(1 for k in SIGNAL_KEYS if signals.get(k) is not None) / len(SIGNAL_KEYS)


def zero_impute(signals: dict) -> dict:
    """Returns a complete signal dict with missing keys set to 0.0."""
    return {k: signals.get(k) or 0.0 for k in SIGNAL_KEYS}
