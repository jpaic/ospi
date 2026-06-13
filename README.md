# OpenSignal Population Index (OSPI) v3

An open-source framework for estimating population using infrastructure signals — telecom activity, electricity consumption, GDP per capita, nighttime lights, and mobility — as a complement to traditional census figures.

---

## Overview

Official census data is expensive, infrequent, and not always reliable. Methodologies vary and figures can be politically motivated. OSPI addresses this by combining multiple independent infrastructure signals into a Ridge regression model that produces near-real-time population estimates with confidence scoring.

The system is designed to be transparent, reproducible, and deployable against publicly available data. It does not replace census data — it cross-references it.

---

## Architecture

```
ETL (Python)  →  PostgreSQL  →  FastAPI backend  →  Next.js frontend
```

- **ETL layer** fetches raw signal data per country per year, normalises to log-scale [0, 100] scores, and stores them alongside official UN population figures.
- **Ridge regression model** trains on high-confidence UN data using cross-validated L2 regularisation (RidgeCV). Missing signal values are imputed via k-nearest neighbours before training. Continent-level bias adjustments are learned from UN sub-region metadata. Population-weighted training prioritises accuracy for larger countries. Five-fold cross-validation produces out-of-fold residuals and CV R² as a guard against overfitting.
- **Estimator** applies the trained model to any country with sufficient signal coverage, returning an estimate, confidence tier (high / med / low), and signal-by-signal breakdown.
- **Frontend** renders an interactive world map with per-country detail panels, trend charts, signal breakdowns, an ML model-status dashboard, and a territory filter to exclude non-sovereign entities.

---

## Signals

| Signal | Status |
| ------ | ------ |
| Telecom (mobile subscriptions) | 🟢 Live |
| Electricity consumption | 🟢 Live |
| GDP per capita (log-normalised) | 🟢 Live |
| Nighttime lights (VIIRS DNB) | 🟢 Live |
| Mobility | 🟢 Live |

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
| Nighttime lights | EOAtlas / NASA VIIRS | Monthly VIIRS DNB composite radiance averaged per country |
| Mobility | Google Community Mobility Reports | Percentage change in mobility relative to baseline (2020-02-15) |

### Land area
**World Bank** (`AG.LND.TOTL.K2`) — static land area in km², pulled into `country_metadata` as a size-anchor feature for the model.

### Country metadata
World Bank country list (used to filter valid sovereign states and exclude regional aggregates), supplemented by UN location data for coordinates and sub-region classification.

---

## Model

The model is a Ridge (L2-regularised) linear regression with cross-validated regularisation strength. Signal scores and land area are included as features, plus continent-level bias adjustments:

```
log(population)  =  intercept  +  Σ wᵢ · signal_scoreᵢ  +  w_area · log(area_km²)  +  w_continent
```

All features are standardised (zero mean, unit variance) during training; the scaler parameters are persisted alongside the coefficients so the estimator reproduces the exact same transform at inference time.

### Regularisation

RidgeCV automatically selects the optimal L2 regularisation strength via population-weighted 5-fold cross-validation:

| Parameter | Search Range | Purpose |
|---|---|---|
| α (L2 penalty) | `logspace(-4, 2, 30)` — from 0.0001 to 100 | Controls coefficient shrinkage |

Population-weighted training (weight ∝ population) ensures the model prioritises accuracy for larger countries, which dominate the global total. This trades per-country accuracy for a better world-sum estimate.

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
| Nighttime lights | log(VIIRS DNB radiance + 1) | [0.001, 10 000] |
| Mobility | Google mobility index %-change (re-baselined) | [0, 100] |

### Confidence tiers

A country's confidence depends on signal coverage and, when available, its out-of-fold residual:

| Coverage | With residual | Without residual |
|---|---|---|
| ≥ 0.8 | `high` if residual < 0.10, else `med` | `high` |
| ≥ 0.6 | `med` if residual < 0.25, else `low` | `med` |
| ≥ 0.2 | `low` | `low` |
| < 0.2 | `low` | `low` |

### Fallback for missing data

Countries with gaps in signal coverage impute missing features using the training-set scaled mean (zero after standardisation, which is equivalent to contributing nothing to the log estimate). On the inference side the same scaler mean is used, so missing signals produce no bias. During training, k-nearest neighbours imputation is used instead, leveraging the signal profiles of similar countries for better coefficient estimates. If all signals are missing, the model falls back to the log-area feature plus continent adjustment alone.

---

## Known Limitations

**World Bank coverage gaps.** WDI does not carry data for Taiwan (`TW`), Palestine (`PS`), and a small number of territories. Taiwan is the most significant omission (~23M people).

**Signal availability varies by year.** Electricity and mobility data tend to lag 1–2 years. Countries with fewer than one available signal fall back to log-area-only prediction.

**Nighttime lights, GDP per capita, and mobility were implemented in v3.** All five signals are now live. Road density was removed in v3 (only 52/218 countries had data).

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

### v3 (2026)

- **Signals (final set):** telecom, electricity, gdp_per_capita, nightlights, mobility — five live signals
- **Ridge regression:** replaced ElasticNet (L1 was zeroing out features) with RidgeCV + population-weighted training
- **Road density removed:** only 52/218 countries had data (latest 2010); replaced with mobility (universal coverage)
- **GDP per capita:** fetched from `country_metadata`, log-normalised into [0, 100] score (not stored in signals table)
- **kNN imputation:** missing signals during training imputed via KNNImputer (k=5, distance-weighted)
- **StandardScaler fix:** only signal features stored in DB — continent dummies excluded at inference
- **Signal count fix:** removed as a feature — was adding a universal -1.7% penalty when always set to 5 at inference
- **New ETL pipelines:** `nightlights.py` (EOAtlas/NPP VIIRS DNB monthly radiance), `mobility.py` (Google Community Mobility Reports)
- **Backend schema:** `version` column in `model_weights` for branch isolation (v2 Ridge / v3 Ridge)
- **Frontend:** signal colors/labels updated for new signals

### v2 (2026)

- Ridge regression with per-feature penalisation
- StandardScaler + log_area_km2 feature
- Continent-level adjustments via region_coefs
- Out-of-fold residuals and cv_r_squared

### v1 (2025)

- Initial release: correction-factor fallback model
- Five original signals: telecom, electricity, building, mobility, internet

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
