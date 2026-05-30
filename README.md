# OpenSignal Population Index (OSPI)

An open-source framework for estimating population using infrastructure signals ( telecom activity, electricity consumption, internet usage, building footprints, and mobility data ), as a complement to traditional census figures.

---

## Overview

Official census data is expensive, infrequent, and not always reliable. Methodologies vary and figures can be politically motivated. OSPI addresses this by combining multiple independent infrastructure signals into a unified probabilistic model that produces near-real-time population estimates with confidence scoring.

The system is designed to be transparent, reproducible, and deployable against publicly available data. It does not replace census data — it cross-references it.

---

## Architecture

```
ETL (Python)  →  PostgreSQL  →  FastAPI backend  →  Next.js frontend
```

- **ETL layer** fetches, normalizes, and scores raw signal data per country per year
- **Estimator** produces OSPI estimates and confidence tiers (high / med / low) from available signals
- **Frontend** renders a live interactive world map, per-country detail panels, trend charts, and signal breakdowns

---

## Signals

| Signal | Status |
|---|---|
| Telecom (mobile subscriptions) | 🟢 Live |
| Electricity consumption | 🟢 Live |
| Internet usage | 🟢 Live |
| Building / housing footprint | 🟡 Planned |
| Mobility / traffic activity | 🟡 Planned |

---

## Data Sources

### Population baseline
**UN World Population Prospects (WPP)** via the UN Data Portal API.
Medium variant, 2010–2024. Used as the official baseline all estimates are measured against.

### Signal data
**World Bank Development Indicators (WDI)** — open API, no authentication required.

| Signal | Indicator |
|---|---|
| Telecom | `IT.CEL.SETS.P2` — mobile subscriptions per 100 people |
| Electricity | `EG.USE.ELEC.KH.PC` — electric power consumption (kWh per capita) |
| Internet | `IT.NET.USER.ZS` — individuals using the internet (% of population) |

### Country metadata
World Bank country list (used to filter valid sovereign states and exclude regional aggregates), supplemented by UN location data for coordinates and sub-region classification.

---

## Normalization

Raw indicator values are normalized to a 0–100 score per country per year:

- **Telecom / Electricity** — log normalization to compress high-penetration outliers
- **Internet** — square-root normalization to differentiate the dense 80–99% cluster among developed countries
- All scores are clamped to [0, 100] and stored alongside the raw value

---

## Known Limitations

**World Bank coverage gaps.** WDI does not carry data for Taiwan (`TW`), Palestine (`PS`), and a small number of territories. Taiwan is the most significant omission (~23M people). These are handled via static patches where possible.

**Signal availability varies by year.** Electricity and internet data tend to lag 1–2 years. Countries with fewer than two available signals fall back to a lower confidence tier.

**Building and mobility signals are not yet implemented.** These require satellite raster processing and mobility dataset access respectively, and are tracked as planned work.

**This is not a census replacement.** OSPI estimates are probabilistic. They are most useful for identifying divergence from official figures and tracking demographic trends, not as authoritative population counts.

---

## Stack

- **Backend:** Python, FastAPI, PostgreSQL, psycopg2, httpx
- **ETL:** World Bank API, UN Data Portal API
- **Frontend:** Next.js, TypeScript, Chart.js, D3, Tailwind CSS
- **Deployment:** Vercel (frontend + backend serverless)

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
