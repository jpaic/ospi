import httpx

def get_valid_iso2_codes() -> set[str]:
    resp = httpx.get(
        "https://api.worldbank.org/v2/country?format=json&per_page=500",
        timeout=30
    )
    resp.raise_for_status()
    _, countries = resp.json()

    # Aggregates/regions have incomeLevel.id == "NA" and no region.id
    # Real countries have a region and an income level
    codes = {
        c["iso2Code"] for c in countries
        if c.get("region", {}).get("id") not in ("", None, "NA")
        and c.get("incomeLevel", {}).get("id") != "NA"
    }
    codes.add("TW")
    return codes