from db.connection import get_conn

WEIGHTS = {
    "telecom":     0.25,
    "electricity": 0.25,
    "building":    0.20,
    "mobility":    0.15,
    "internet":    0.15,
}


def get_official_populations(iso2_list: list[str]) -> dict[str, float]:
    """Returns latest population per country (bulk)."""
    if isinstance(iso2_list, str):
        iso2_list = [iso2_list]

    if not iso2_list:
        return {}

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2)
                    iso2,
                    population
                FROM populations
                WHERE iso2 = ANY(%s)
                ORDER BY iso2, year DESC
                """,
                (iso2_list,),
            )
            rows = cur.fetchall()

    return {iso2: float(pop) for iso2, pop in rows}



def get_signals_bulk(iso2_list: list[str]) -> dict[str, dict]:
    """Returns latest signal per type for each country (bulk)."""
    if isinstance(iso2_list, str):
        iso2_list = [iso2_list]

    if not iso2_list:
        return {}

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (iso2, signal_type)
                    iso2,
                    signal_type,
                    score
                FROM signals
                WHERE iso2 = ANY(%s)
                ORDER BY iso2, signal_type, year DESC
                """,
                (iso2_list,),
            )
            rows = cur.fetchall()

    result: dict[str, dict] = {}
    for iso2, signal_type, score in rows:
        result.setdefault(iso2, {})[signal_type] = float(score)

    return result


def _compute_estimate(official_pop: float, signals: dict) -> dict:
    available = {
        k: signals[k]
        for k in WEIGHTS
        if k in signals and signals[k] is not None
    }

    if not available:
        return {
            "official": official_pop,
            "estimate": official_pop,
            "confidence": "low",
            "composite_signal": None,
        }

    total_weight = sum(WEIGHTS[k] for k in available)

    composite = sum(
        available[k] * (WEIGHTS[k] / total_weight)
        for k in available
    )

    composite = round(composite, 1)
    correction = 0.8 + (composite / 100) * 0.4
    estimate = round(official_pop * correction, 1)
    confidence = "high" if composite > 75 else "med" if composite > 50 else "low"

    return {
        "official": official_pop,
        "estimate": estimate,
        "confidence": confidence,
        "composite_signal": composite,
    }


def estimate_population_bulk(iso2_list: list[str]) -> dict[str, dict]:
    """Main bulk function."""
    if isinstance(iso2_list, str):
        iso2_list = [iso2_list]

    official_pops = get_official_populations(iso2_list)
    signals_map = get_signals_bulk(iso2_list)

    results = {}

    for iso2 in iso2_list:
        official = official_pops.get(iso2)

        if official is None:
            results[iso2] = {
                "official": None,
                "estimate": None,
                "confidence": "low",
                "composite_signal": None,
            }
            continue

        results[iso2] = _compute_estimate(
            official,
            signals_map.get(iso2, {})
        )

    return results


# -----------------------------
# BACKWARD COMPATIBILITY (IMPORTANT)
# -----------------------------
def estimate_population(iso2: str) -> dict:
    """Keeps old API working safely."""
    return estimate_population_bulk([iso2])[iso2]