"""
generate_numbeo_traffic.py

Generates backend/etl/data/numbeo_traffic.csv — a per-country traffic
congestion dataset used by the mobility signal ETL.

Methodology
-----------
1. Scrape the free Numbeo Traffic Index by Country page — this gives raw
   Traffic Index values for ~89 countries (composite of commute time,
   traffic inefficiency, and CO₂ from transport).
2. For the remaining ~130 countries, estimate the score using the country's
   urban population percentage (SP.URB.TOTL.IN.ZS) from the World Bank.
   The raw Numbeo values are log-normalised to [0, 100]; for estimated
   countries the urban % is scaled through a simple linear model fitted on
   the known 89 so both groups produce scores on the same scale.
3. Output CSV is version-controlled so the ETL never depends on live API
   calls or scrapes.  Re-run periodically (e.g. annually) to refresh.

Usage
-----
    python -m etl.utils.generate_numbeo_traffic
"""

import csv
import math
import re
from pathlib import Path

import httpx
from bs4 import BeautifulSoup

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CSV_PATH = DATA_DIR / "numbeo_traffic.csv"
URBAN_YEAR = "2021"

# Numbeo page URL
NUMBEO_URL = "https://www.numbeo.com/traffic/rankings_by_country.jsp"

# Log-normalisation bounds for raw Numbeo Traffic Index
RAW_FLOOR = 10.0
RAW_CEIL = 500.0
LOG_MIN = math.log10(RAW_FLOOR)
LOG_MAX = math.log10(RAW_CEIL)

# Manual mapping from Numbeo country names → ISO2 codes.
# Numbeo uses display names that often differ from World Bank conventions.
NAME_TO_ISO2 = {
    "Nigeria": "NG", "Costa Rica": "CR", "Sri Lanka": "LK",
    "Bangladesh": "BD", "Kenya": "KE", "Egypt": "EG", "Peru": "PE",
    "Iran": "IR", "India": "IN", "Colombia": "CO", "Indonesia": "ID",
    "Jordan": "JO", "Turkey": "TR", "South Africa": "ZA",
    "Lebanon": "LB", "Philippines": "PH", "Argentina": "AR",
    "Mexico": "MX", "Russia": "RU", "Australia": "AU", "Brazil": "BR",
    "Malaysia": "MY", "United Arab Emirates": "AE", "Thailand": "TH",
    "Pakistan": "PK", "Kuwait": "KW", "Azerbaijan": "AZ",
    "Ecuador": "EC", "United States": "US", "Panama": "PA",
    "Israel": "IL", "Uruguay": "UY", "Puerto Rico": "PR",
    "Ireland": "IE", "China": "CN", "Singapore": "SG",
    "Ukraine": "UA", "Saudi Arabia": "SA", "South Korea": "KR",
    "Hong Kong (China)": "HK", "Venezuela": "VE", "Japan": "JP",
    "Canada": "CA", "New Zealand": "NZ", "Kazakhstan": "KZ",
    "Qatar": "QA", "United Kingdom": "GB", "Tunisia": "TN",
    "Morocco": "MA", "Chile": "CL", "Georgia": "GE", "Oman": "OM",
    "Belgium": "BE", "Switzerland": "CH", "France": "FR",
    "Greece": "GR", "Hungary": "HU", "Italy": "IT", "Romania": "RO",
    "Taiwan": "TW", "Poland": "PL", "Belarus": "BY", "Albania": "AL",
    "Cyprus": "CY", "Serbia": "RS", "Vietnam": "VN", "Portugal": "PT",
    "Luxembourg": "LU", "Armenia": "AM", "Slovakia": "SK",
    "Bulgaria": "BG", "Norway": "NO", "Latvia": "LV",
    "Slovenia": "SI", "Malta": "MT", "Germany": "DE", "Spain": "ES",
    "Sweden": "SE", "Croatia": "HR", "Iceland": "IS",
    "Bosnia And Herzegovina": "BA", "Denmark": "DK",
    "Czech Republic": "CZ", "North Macedonia": "MK",
    "Netherlands": "NL", "Lithuania": "LT", "Finland": "FI",
    "Austria": "AT", "Estonia": "EE",
}


def _fetch_numbeo_data() -> dict[str, float]:
    """Scrape the Numbeo country rankings page; return {iso2: raw_traffic_index}."""
    resp = httpx.get(NUMBEO_URL, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    table = soup.find("table", id="t2")
    if not table:
        # fallback: look for any table with ranking-like structure
        table = soup.find("table", class_="stripe")
    if not table:
        raise RuntimeError("Could not find Numbeo ranking table on the page")

    results: dict[str, float] = {}
    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 4:
            continue
        rank_cell = cells[1].get_text(strip=True)
        index_cell = cells[2].get_text(strip=True)

        name = re.sub(r"\s+", " ", rank_cell).strip()
        iso2 = NAME_TO_ISO2.get(name)
        if not iso2:
            print(f"  WARNING: unmapped country '{name}' — skipping")
            continue

        try:
            raw = float(index_cell.replace(",", ""))
        except ValueError:
            print(f"  WARNING: bad number for '{name}': '{index_cell}'")
            continue

        results[iso2] = raw

    print(f"  Scraped {len(results)} countries from Numbeo")
    return results


def _get_valid_countries() -> list[dict]:
    """Fetch the World Bank country list (same source as other OSPI ETLs)."""
    resp = httpx.get(
        "https://api.worldbank.org/v2/country?format=json&per_page=500",
        timeout=30,
    )
    resp.raise_for_status()
    _, raw = resp.json()
    valid = [
        c for c in raw
        if c.get("region", {}).get("id") not in ("", None, "NA")
        and c.get("incomeLevel", {}).get("id") != "NA"
    ]
    # Patch countries the World Bank omits
    existing = {c["iso2Code"] for c in valid}
    if "TW" not in existing:
        valid.append({"iso2Code": "TW", "name": "Taiwan", "id": "TWN"})
    if "XK" not in existing:
        valid.append({"iso2Code": "XK", "name": "Kosovo", "id": "XKX"})
    return valid


def _fetch_urbanization(countries: list[dict]) -> dict[str, float]:
    """Fetch urban population % from World Bank; return {iso2: urban_pct}."""
    url = (
        f"https://api.worldbank.org/v2/country/all/indicator/"
        f"SP.URB.TOTL.IN.ZS?format=json&date={URBAN_YEAR}&per_page=20000"
    )
    resp = httpx.get(url, timeout=120)
    resp.raise_for_status()
    _, records = resp.json()
    urban: dict[str, float] = {}
    for r in records:
        iso2 = r.get("country", {}).get("id")
        val = r.get("value")
        if iso2 and val:
            urban[iso2] = float(val)
    # Patch missing
    urban["TW"] = 79.0
    urban["XK"] = 55.0
    print(f"  Urbanization data: {len(urban)} countries")
    return urban


def _normalise(raw: float) -> float:
    """Log-normalise to [0, 100]."""
    ld = math.log10(max(raw, RAW_FLOOR))
    s = ((ld - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100
    return min(max(round(s, 1), 0), 100)


def main():
    print("Step 1 — scraping Numbeo Traffic Index by Country...")
    numbeo = _fetch_numbeo_data()

    print("Step 2 — fetching country list from World Bank...")
    countries = _get_valid_countries()
    print(f"  {len(countries)} countries")

    print("Step 3 — fetching urbanisation % from World Bank...")
    urban = _fetch_urbanization(countries)

    print("Step 4 — fitting estimate model & writing CSV...")

    # Build a linear model:  Numbeo_log_score ~ urban_pct
    known_x, known_y = [], []
    for c in countries:
        iso2 = c["iso2Code"]
        if iso2 in numbeo and iso2 in urban:
            known_x.append(urban[iso2])
            known_y.append(_normalise(numbeo[iso2]))

    n = len(known_x)
    if n < 2:
        raise RuntimeError(f"Too few overlapping countries to fit model ({n})")

    # Simple linear regression: y = a * x + b
    mean_x = sum(known_x) / n
    mean_y = sum(known_y) / n
    num_xy = sum((known_x[i] - mean_x) * (known_y[i] - mean_y) for i in range(n))
    den_xx = sum((known_x[i] - mean_x) ** 2 for i in range(n))
    slope = num_xy / den_xx if den_xx else 0
    intercept = mean_y - slope * mean_x
    print(f"  Model: score = {slope:.4f} × urban% + {intercept:.2f}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    scored = 0
    estimated = 0
    with open(CSV_PATH, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "iso2", "name", "raw_traffic_index", "urban_pct",
            "score", "source",
        ])

        for c in sorted(countries, key=lambda x: x["iso2Code"]):
            iso2 = c["iso2Code"]
            name = c["name"]

            if iso2 in numbeo:
                raw = numbeo[iso2]
                score = _normalise(raw)
                src = "numbeo"
            elif iso2 in urban:
                raw = round(urban[iso2], 1)
                score = max(0, min(100, round(slope * urban[iso2] + intercept, 1)))
                src = "estimated_urban"
                estimated += 1
            else:
                writer.writerow([iso2, name, "", "", "", ""])
                continue

            writer.writerow([iso2, name, raw, round(urban.get(iso2, 0), 1), score, src])
            scored += 1

    print(f"\nDone — {scored} countries scored ({len(numbeo)} from Numbeo, {estimated} estimated via urban%)")
    print(f"Output: {CSV_PATH}")


if __name__ == "__main__":
    main()
