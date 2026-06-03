import httpx
import logging
import time

logger = logging.getLogger(__name__)

BASE = "https://population.un.org/dataportalapi/api/v1"


def get_valid_iso2_codes() -> set[str]:
    return get_valid_country_codes()[0]

def get_valid_country_codes() -> tuple[set[str], set[str]]:
    resp = httpx.get(
        "https://api.worldbank.org/v2/country?format=json&per_page=500",
        timeout=30
    )
    resp.raise_for_status()
    _, countries = resp.json()

    valid = [
        c for c in countries
        if c.get("region", {}).get("id") not in ("", None, "NA")
        and c.get("incomeLevel", {}).get("id") != "NA"
    ]

    iso2 = {c["iso2Code"] for c in valid}
    iso3 = {c["id"] for c in valid}  # World Bank uses iso3 as the primary id

    iso2.add("TW")
    iso3.add("TWN")

    return iso2, iso3

def fetch_all_locations(headers: dict) -> list[dict]:
    locations   = []
    page        = 1
    total_pages = 1

    while page <= total_pages:
        url = f"{BASE}/locationsWithAggregates?pageNumber={page}&pageSize=250"
        for attempt in range(3):
            try:
                r = httpx.get(url, headers=headers, timeout=30)
                r.raise_for_status()
                data = r.json()
                break
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 502 and attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                raise
        locations.extend(data["data"])
        total_pages = data.get("pages", 1)
        logger.info("Locations page %d/%d — %d so far", page, total_pages, len(locations))
        page += 1

    return locations


def filter_locations(
    all_locations: list[dict],
    valid_iso2: set[str],
    valid_iso3: set[str],
) -> tuple[list[dict], int, list[str]]:
    skipped           = 0
    skipped_not_valid = []
    countries         = []

    for loc in all_locations:
        iso2 = loc.get("Iso2", "")
        iso3 = loc.get("Iso3", "")

        if not iso2 or len(iso2) != 2:
            skipped += 1
            continue
        if iso3 not in valid_iso3:
            skipped += 1
            continue
        if iso2 not in valid_iso2:
            skipped_not_valid.append(f"{iso2} ({loc.get('Name', '?')})")
            continue

        countries.append(loc)

    return countries, skipped, skipped_not_valid
