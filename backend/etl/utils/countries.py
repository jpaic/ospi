import httpx

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