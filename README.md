# OpenSignal Population Index (OSPI) v3

An open-source framework for estimating population using infrastructure signals — telecom activity, electricity consumption, GDP per capita, nighttime lights, and road density — as a complement to traditional census figures.

---

## Overview

Official census data is expensive, infrequent, and not always reliable. Methodologies vary and figures can be politically motivated. OSPI addresses this by combining multiple independent infrastructure signals into an ElasticNet regression model that produces near-real-time population estimates with confidence scoring.

The system is designed to be transparent, reproducible, and deployable against publicly available data. It does not replace census data — it cross-references it.

---

## Architecture

```
ETL (Python)  →  PostgreSQL  →  FastAPI backend  →  Next.js frontend
```

- **ETL layer** fetches raw signal data per country per year, normalises to log-scale [0, 100] scores, and stores them alongside official UN population figures.
- **ElasticNet regression model** trains on high-confidence UN data using cross-validated L1+L2 regularisation: L1 prunes irrelevant signals to zero, L2 handles multicollinearity among remaining signals. Missing signal values are imputed via k-nearest neighbours before training. Continent-level bias adjustments are learned from UN sub-region metadata. Five-fold cross-validation produces out-of-fold residuals and CV R² as a guard against overfitting.
- **Estimator** applies the trained model to any country with sufficient signal coverage, returning an estimate, confidence tier (high / med / low), and signal-by-signal breakdown.
- **Frontend** renders an interactive world map with per-country detail panels, trend charts, signal breakdowns, an ML model-status dashboard, and a territory filter to exclude non-sovereign entities.

---

## Signals

| Signal | Status |
| ------ | ------ |
| Telecom (mobile subscriptions) | 🟢 Live |
| Electricity consumption | 🟢 Live |
| GDP per capita | 🔧 Planned |
| Nighttime lights (VIIRS DNB) | 🔧 Planned |
| Road density | 🔧 Planned |

---

## Data Sources

### Population baseline
**UN World Population Prospects (WPP)** via the UN Data Portal API.
Medium variant, 2010–2024. Used as the official baseline all estimates are measured against.

### Signal data

| Signal | Source | Original Indicator |
|---|---|---|
| Telecom | World Bank WDI | `IT.CEL.SETS` — total mobile cellular subscriptions |
| Electricity | World Bank WDI | `EG.USE.ELEC.KH.PC` × land area (total consumption proxy) |
| GDP per capita | World Bank WDI | `NY.GDP.PCAP.CD` — gross domestic product per capita |
| Nighttime lights | NASA Black Marble / NOAA VIIRS | Annual cloud-free VIIRS DNB composite (planned ETL) |
| Road density | World Bank WDI | `IS.ROD.DNST.K2` — km of road per 100 km² land area |

### Land area
**World Bank** (`AG.LND.TOTL.K2`) — static land area in km², pulled into `country_metadata` as a size-anchor feature for the model.

### Country metadata
World Bank country list (used to filter valid sovereign states and exclude regional aggregates), supplemented by UN location data for coordinates and sub-region classification.

---

## Model

The model is an ElasticNet (L1+L2 regularised) linear regression with cross-validated regularisation strength. Signal scores, land area, signal count, and continent dummies are all included as features:

```
log(population)  =  intercept  +  Σ wᵢ · signal_scoreᵢ  +  w_area · log(area_km²)  +  w_sig · signal_count  +  Σ w_c · continent_c
```

All features are standardised (zero mean, unit variance) during training; the scaler parameters are persisted alongside the coefficients so the estimator reproduces the exact same transform at inference time.

### Regularisation

ElasticNetCV automatically selects the optimal L1/L2 mix and regularisation strength via 5-fold cross-validation:

| Parameter | Search Range | Purpose |
|---|---|---|
| α (overall penalty) | `logspace(-4, 1, 20)` — from 0.0001 to 10 | Controls total shrinkage |
| l1_ratio | `[0.1, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0]` | Mix between L1 (lasso) and L2 (ridge) regularisation |

L1 regularisation automatically prunes irrelevant signals (coefficient → 0), while L2 handles multicollinearity among the remaining signals. This replaces the previous manual per-feature α approach.

### Missing signal imputation

During training, missing signal values are imputed via **k-nearest neighbours** (k=5, distance-weighted) using the signal profiles of the 5 most similar countries. This preserves regional patterns better than mean imputation. At inference time, missing signals fall back to the training-set scaled mean (zero after standardisation).

### Continent adjustment

UN sub-regions are mapped to five continents (Africa, Americas, Asia, Europe, Oceania) and one-hot encoded with Europe dropped as the reference level. At inference, the estimator looks up the country's UN sub-region, maps it to a continent, and applies the learned continent-level bias stored in `region_coefs` (JSONB in `model_weights`).

### Signal normalisation

Raw signal values are log-transformed and min-max scaled to a [0, 100] score per country. The transformation bounds are chosen to span the realistic global range for each indicator:

| Signal | Transformation | Bounds [min, max] |
|---|---|---|
| Telecom | log(IT.CEL.SETS) | [1 000, 2 000 000 000] |
| Electricity | log(kWh × area_km²) | [10 000, 500 000 000 000] |
| GDP per capita | log(NY.GDP.PCAP.CD) | [100, 200 000] |
| Nighttime lights | log(VIIRS DNB radiance) | TBD — determined by dataset |
| Road density | log(IS.ROD.DNST.K2) | [0.1, 500] |

### Confidence tiers

A country's confidence depends on signal coverage and, when available, its out-of-fold residual:

| Coverage | With residual | Without residual |
|---|---|---|
| ≥ 0.8 | `high` if residual < 0.10, else `med` | `high` |
| ≥ 0.6 | `med` if residual < 0.25, else `low` | `med` |
| ≥ 0.4 | `low` | `low` |
| < 0.4 | `low` | `low` |

### Fallback for missing data

Countries with gaps in signal coverage impute missing features using the training-set scaled mean (zero after standardisation, which is equivalent to contributing nothing to the log estimate). On the inference side the same scaler mean is used, so missing signals produce no bias. During training, k-nearest neighbours imputation is used instead, leveraging the signal profiles of similar countries for better coefficient estimates. If all signals are missing, no estimate is returned.

---

## Known Limitations

**World Bank coverage gaps.** WDI does not carry data for Taiwan (`TW`), Palestine (`PS`), and a small number of territories. Taiwan is the most significant omission (~23M people).

**Signal availability varies by year.** Electricity and road density data tend to lag 1–2 years. Countries with fewer than two available signals fall back to a lower confidence tier.

**Nighttime lights, GDP per capita, and road density were implemented in v3.** All five signals are now live with dedicated ETL pipelines.

**6 countries have no land-area data** from the World Bank (VG, TW, GI, KP, MK, XK). Their `log(area)` falls back to the training-set mean, which reduces prediction accuracy for microstates such as Gibraltar.

**This is not a census replacement.** OSPI estimates are probabilistic. They are most useful for identifying divergence from official figures and tracking demographic trends, not as authoritative population counts.

---

## Stack

- **Backend:** Python, FastAPI, PostgreSQL, psycopg2, scikit-learn, httpx
- **ETL:** World Bank API (WDI), UN Data Portal API
- **Frontend:** Next.js, TypeScript, Chart.js, D3, Tailwind CSS
- **Deployment:** Vercel (frontend + backend serverless)

---

## Changelog

### v3 (2025)

- **Replaced signals:** building → gdp_per_capita, mobility → nightlights, internet → road_density
- **ElasticNet:** replaced per-feature Ridge with ElasticNetCV (cross-validated L1+L2)
- **kNN imputation:** missing signals during training imputed via KNNImputer (k=5, distance-weighted)
- **StandardScaler on all features:** continent dummies now scaled alongside signals
- **New ETL pipelines:** `nightlights.py` (CO₂ proxy), `road_density.py` (World Bank IS.ROD.DNST.K2)
- **GDP per capita:** fetched by `metadata.py`, log-normalised into [0, 100] score
- **Backend schema:** `model_weights` stores `elasticnet_alpha` and `l1_ratio`
- **Frontend:** signal colors/labels updated for new signals

### v2 (2024)

- Ridge regression with per-feature penalisation
- StandardScaler + log_area_km2 feature
- Continent-level adjustments via region_coefs
- Out-of-fold residuals and cv_r_squared

### v1 (2024)

- Initial release: correction-factor fallback model
- Five original signals: telecom, electricity, building, mobility, internet

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
