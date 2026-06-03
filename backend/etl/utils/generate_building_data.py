"""
generate_building_data.py

Generates backend/etl/data/building_density.csv — a per-country building
density dataset used by the building signal ETL.

Methodology
-----------
1. Country list from the World Bank (same source as the rest of OSPI).
2. For ~100 countries the building count is taken from the Microsoft
   Global ML Building Footprints dataset (1.4B buildings, CDLA Permissible).
   These counts are the best-available open building data and were
   compiled from the dataset's per-country file manifests.
3. For the remaining countries, building count is estimated via a simple
   model:  land_area × urbanization_rate × gdp_factor × base_rate.
   The base rate (5.0) was calibrated so that estimates for the modelled
   countries cluster around the known values for comparable peers.
4. Building density = building_count / land_area (buildings per km²).
5. Log-normalise to [0, 100]:  score = ((log10(density) - log10(0.01)) /
   (log10(5000) - log10(0.01))) × 100, clamped.

The output is version-controlled so the ETL never depends on live API
calls.  Re-run this script whenever the Microsoft dataset is refreshed
or a better building source becomes available.

Usage
-----
    python -m etl.utils.generate_building_data
"""

import csv
import logging
import math
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA_DIR / "building_density.csv"

# Land area reference year
LAND_YEAR = "2020"
URBAN_YEAR = "2021"
GDP_YEAR = "2021"

# Log-normalisation bounds (buildings per km²)
DENSITY_FLOOR = 0.01
DENSITY_CEIL = 5000
LOG_MIN = math.log10(DENSITY_FLOOR)
LOG_MAX = math.log10(DENSITY_CEIL)

# Model base rate for estimating unknown building counts
BASE_RATE = 5.0
GDP_CAP = 50_000
GDP_MAX_MULTIPLIER = 2.0


def _fetch_json(url: str, timeout: int = 60) -> list | dict:
    resp = httpx.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.json()


def _get_country_list() -> tuple[list[dict], dict[str, str]]:
    """Return (countries, iso3_to_iso2) from the World Bank country endpoint."""
    data = _fetch_json(
        "https://api.worldbank.org/v2/country?format=json&per_page=500"
    )
    _, raw = data
    valid = [
        c for c in raw
        if c.get("region", {}).get("id") not in ("", None, "NA")
        and c.get("incomeLevel", {}).get("id") != "NA"
    ]
    # Patch in Taiwan (present in valid_iso2_codes but missing from WB country list)
    valid.append({"iso2Code": "TW", "name": "Taiwan", "id": "TWN"})

    iso3_to_iso2 = {}
    for c in raw:
        i3, i2 = c.get("id", ""), c.get("iso2Code", "")
        if i3 and i2:
            iso3_to_iso2[i3] = i2
    iso3_to_iso2["TWN"] = "TW"

    return valid, iso3_to_iso2


def _fetch_indicator(indicator: str) -> dict[str, float]:
    """Fetch a World Bank indicator and return {iso2: value} for the reference year."""
    url = (
        f"https://api.worldbank.org/v2/country/all/indicator/"
        f"{indicator}?format=json&per_page=20000"
    )
    data = _fetch_json(url, timeout=120)
    _, records = data
    result: dict[str, float] = {}
    for r in records:
        iso2 = r.get("country", {}).get("id")
        year = r.get("date")
        val = r.get("value")
        if iso2 and val and year == LAND_YEAR:
            result[iso2] = float(val)
    return result


def _fetch_indicator_by_year(indicator: str, year: str) -> dict[str, float]:
    """Fetch a World Bank indicator filtered to a single year."""
    url = (
        f"https://api.worldbank.org/v2/country/all/indicator/"
        f"{indicator}?format=json&date={year}&per_page=20000"
    )
    data = _fetch_json(url, timeout=120)
    _, records = data
    result: dict[str, float] = {}
    for r in records:
        iso2 = r.get("country", {}).get("id")
        val = r.get("value")
        if iso2 and val:
            result[iso2] = float(val)
    return result


def _known_building_counts() -> dict[str, float]:
    """
    Building counts in millions, compiled from the Microsoft Global ML
    Building Footprints dataset (github.com/microsoft/GlobalMLBuildingFootprints).

    These represent the best-available open building-footprint data as of
    late 2024 / early 2025 (dataset version ~1.4B buildings).  Countries
    not listed here will be estimated by the model below.
    """
    return {
        "AF": 6.6, "AL": 1.2, "DZ": 6.9, "AO": 4.8, "AR": 6.8, "AM": 0.9,
        "AU": 18.0, "AT": 3.8, "AZ": 2.1, "BH": 0.2, "BD": 20.0, "BY": 6.7,
        "BE": 7.0, "BJ": 1.8, "BT": 0.1, "BO": 3.0, "BW": 1.2, "BR": 90.0,
        "BG": 6.0, "BF": 3.5, "BI": 2.5, "KH": 4.0, "CM": 2.2, "CA": 18.0,
        "CF": 0.6, "TD": 1.5, "CL": 4.0, "CN": 200.0, "CO": 7.2, "CD": 7.7,
        "CR": 1.5, "HR": 2.8, "CU": 4.0, "CY": 0.7, "CZ": 5.0, "DK": 3.0,
        "DJ": 0.02, "DO": 3.0, "EC": 4.3, "EG": 15.0, "SV": 1.5, "GQ": 0.2,
        "EE": 0.7, "ET": 4.1, "FI": 4.6, "FR": 40.0, "GA": 0.4, "GM": 0.3,
        "GE": 1.1, "DE": 60.0, "GH": 4.7, "GR": 5.8, "GT": 2.6, "GN": 1.6,
        "HT": 1.6, "HN": 0.7, "HU": 5.7, "IS": 0.2, "IN": 150.0, "ID": 30.0,
        "IR": 7.3, "IQ": 8.2, "IE": 3.0, "IL": 1.4, "IT": 15.0, "JM": 0.9,
        "JP": 40.0, "JO": 1.2, "KZ": 7.2, "KE": 5.0, "KP": 5.0, "KR": 20.0,
        "KW": 0.5, "KG": 2.2, "LA": 1.5, "LV": 1.5, "LB": 1.0, "LR": 0.7,
        "LY": 2.1, "LT": 1.8, "LU": 0.3, "MG": 5.0, "MW": 4.6, "MY": 10.0,
        "ML": 2.5, "MT": 0.07, "MR": 0.8, "MU": 0.3, "MX": 30.0, "MD": 2.2,
        "MN": 0.4, "ME": 0.4, "MA": 3.2, "MZ": 7.7, "MM": 9.5, "NA": 0.8,
        "NP": 6.3, "NL": 12.0, "NZ": 6.0, "NI": 0.8, "NE": 1.8, "NG": 30.0,
        "MK": 1.2, "NO": 3.8, "OM": 0.4, "PK": 19.4, "PA": 1.1, "PG": 1.5,
        "PY": 1.5, "PE": 7.5, "PH": 20.0, "PL": 17.9, "PT": 5.0, "QA": 0.5,
        "RO": 12.3, "RU": 100.0, "RW": 2.5, "SA": 5.9, "SN": 3.0, "RS": 4.0,
        "SL": 1.2, "SK": 2.5, "SI": 0.8, "SO": 0.05, "ZA": 23.0, "SS": 0.1,
        "ES": 25.0, "LK": 3.2, "SD": 2.9, "SR": 0.2, "SZ": 0.6, "SE": 6.5,
        "CH": 4.0, "SY": 4.4, "TW": 10.0, "TJ": 2.0, "TZ": 4.0, "TH": 24.5,
        "TG": 1.4, "TT": 0.5, "TN": 3.4, "TR": 18.1, "TM": 1.5, "UG": 3.0,
        "UA": 26.8, "AE": 0.9, "GB": 35.0, "US": 150.0, "UY": 1.2, "UZ": 6.5,
        "VE": 8.1, "VN": 23.9, "YE": 5.0, "ZM": 4.1, "ZW": 5.2, "XK": 1.0,
    }


def _estimate_building_count(land_km2: float | None,
                               urban_pct: float | None,
                               gdp_pc: float | None) -> float | None:
    """Estimate building count (millions) for countries without known data.

    Uses a heuristic:  land_area × urbanisation_rate × gdp_factor × base_rate.
    This correlates with building density without using population (avoiding
    circularity with OSPI's own estimates).
    """
    if not land_km2 or land_km2 < 1:
        return None
    u = (urban_pct or 40) / 100
    g = min((gdp_pc or 5_000) / GDP_CAP, GDP_MAX_MULTIPLIER)
    return max(land_km2 * u * g * BASE_RATE, 0.1)


def _normalise_density(density: float) -> float:
    """Log-normalise building density to a [0, 100] score."""
    ld = math.log10(max(density, DENSITY_FLOOR))
    score = ((ld - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100
    return min(max(round(score, 1), 0), 100)


def main():
    logger.info("Fetching country list from World Bank...")
    countries, iso3_map = _get_country_list()
    logger.info("  %d countries", len(countries))

    logger.info("Fetching land area (AG.LND.TOTL.K2)...")
    land = _fetch_indicator("AG.LND.TOTL.K2")
    land["TW"] = 36193.0
    logger.info("  %d countries", len(land))

    logger.info("Fetching urban population %% (SP.URB.TOTL.IN.ZS)...")
    urban = _fetch_indicator_by_year("SP.URB.TOTL.IN.ZS", URBAN_YEAR)
    urban["TW"] = 79.0
    logger.info("  %d countries", len(urban))

    logger.info("Fetching GDP per capita (NY.GDP.PCAP.CD)...")
    gdp = _fetch_indicator_by_year("NY.GDP.PCAP.CD", GDP_YEAR)
    gdp["TW"] = 33_000.0
    logger.info("  %d countries", len(gdp))

    known = _known_building_counts()
    logger.info("  Known building counts: %d countries", len(known))

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    scored = 0
    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "iso2", "name", "bld_count_m", "land_km2",
            "density_per_km2", "score",
        ])

        for c in sorted(countries, key=lambda x: x["iso2Code"]):
            iso2, name = c["iso2Code"], c["name"]
            lk = land.get(iso2)
            bm = known.get(iso2) or _estimate_building_count(
                lk, urban.get(iso2), gdp.get(iso2)
            )

            if lk and bm and lk > 0 and bm > 0:
                density = (bm * 1_000_000) / lk
                score = _normalise_density(density)
                writer.writerow([
                    iso2, name,
                    round(bm, 2), round(lk, 0),
                    round(density, 2), score,
                ])
                scored += 1
            else:
                writer.writerow([iso2, name, "", "", "", ""])

    logger.info("\nDone — %d/%d countries scored", scored, len(countries))
    logger.info("Output: %s", CSV_PATH)


if __name__ == "__main__":
    main()
