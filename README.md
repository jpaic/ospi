# OpenSignal Population Index (OSPI)

An open-source framework for estimating population using infrastructure signals — telecom activity, electricity consumption, building footprints, internet usage, and mobility data — as a complement to traditional census figures.

---

## Overview

Official census data is expensive, infrequent, and not always reliable. Methodologies vary and figures can be politically motivated. OSPI addresses this by combining multiple independent infrastructure signals into a per-feature Ridge regression model that produces near-real-time population estimates with confidence scoring.

The system is designed to be transparent, reproducible, and deployable against publicly available data. It does not replace census data — it cross-references it.

---

## Architecture

```
ETL (Python)  →  PostgreSQL  →  FastAPI backend  →  Next.js frontend
```

- **ETL layer** fetches raw signal data per country per year, normalises to log-scale [0, 100] scores, and stores them alongside official UN population figures.
- **Ridge regression model** trains on high-confidence UN data using per-feature penalties: strong signals (telecom, land area) carry the prediction, weak signals (building, mobility, internet) are regularised toward zero. Continent-level bias adjustments are learned from UN sub-region metadata. Five-fold cross-validation produces out-of-fold residuals and CV R² as a guard against overfitting.
- **Estimator** applies the trained model to any country with sufficient signal coverage, returning an estimate, confidence tier (high / med / low), and signal-by-signal breakdown.
- **Frontend** renders an interactive world map with per-country detail panels, trend charts, signal breakdowns, an ML model-status dashboard, and a territory filter to exclude non-sovereign entities.

---

## Signals

| Signal | Status |
|---|---|
| Telecom (mobile subscriptions) | 🟢 Live |
| Electricity consumption | 🟢 Live |
| Internet usage | 🟢 Live |
| Building / housing footprint | 🟢 Live |
| Mobility / traffic activity | 🟢 Live |

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
| Internet | World Bank WDI | `IT.NET.BBND` — total fixed broadband subscriptions |
| Building | Microsoft Global ML Building Footprints | Total building count per country |
| Mobility | Numbeo Traffic Index | Composite congestion score per country |

### Land area
**World Bank** (`AG.LND.TOTL.K2`) — static land area in km², pulled into `country_metadata` as a size-anchor feature for the model.

### Country metadata
World Bank country list (used to filter valid sovereign states and exclude regional aggregates), supplemented by UN location data for coordinates and sub-region classification.

---

## Model

The model is a Ridge (L2-regularised) linear regression with per-feature penalty. Signal scores, land area, signal count, and continent dummies are all included as features:

```
log(population)  =  intercept  +  Σ wᵢ · signal_scoreᵢ  +  w_area · log(area_km²)  +  w_sig · signal_count  +  Σ w_c · continent_c
```

All features are standardised (zero mean, unit variance) during training; the scaler parameters are persisted alongside the coefficients so the estimator reproduces the exact same transform at inference time.

### Regularisation

Each feature receives its own penalty α to reflect its predictive strength:

| Feature | α | Role |
|---|---|---|
| Telecom | 0.001 | Near-OLS — strongest signal (r ≈ 0.98 with log-population) |
| Electricity | 0.1 | Mild shrinkage — moderate contribution |
| Building | 10.0 | Heavy shrinkage — effectively pruned |
| Mobility | 10.0 | Heavy shrinkage — effectively pruned |
| Internet | 10.0 | Heavy shrinkage — effectively pruned |
| log(area_km²) | 1e-6 | Effectively unregularised — size anchor |
| signal_count | 0.1 | Mild shrinkage — useful when coverage varies |
| Continent dummies (4) | 1.0 | Mild regularisation — Europe is the reference level |

The closed-form solution penalises each feature independently:

```
ŵ = (XᵀX + diag(α))⁻¹ Xᵀy
```

### Continent adjustment

UN sub-regions are mapped to five continents (Africa, Americas, Asia, Europe, Oceania) and one-hot encoded with Europe dropped as the reference level. At inference, the estimator looks up the country's UN sub-region, maps it to a continent, and applies the learned continent-level bias stored in `region_coefs` (JSONB in `model_weights`).

### Performance

| Metric | Value |
|---|---|
| In-sample R² | 0.9801 |
| 5-fold CV R² | 0.9756 |
| Training countries | 148 |

### Signal normalisation

Raw signal values are log-transformed and min-max scaled to a [0, 100] score per country. The transformation bounds are chosen to span the realistic global range for each indicator:

| Signal | Transformation | Bounds [min, max] |
|---|---|---|
| Telecom | log(IT.CEL.SETS) | [1 000, 2 000 000 000] |
| Electricity | log(kWh × area_km²) | [10 000, 500 000 000 000] |
| Building | log(bld_count × 1 000 000) | [10 000, 500 000 000] |
| Mobility | log(Numbeo score) | [10, 100] |
| Internet | log(IT.NET.BBND) | [10, 1 000 000 000] |

### Confidence tiers

A country's confidence depends on signal coverage and, when available, its out-of-fold residual:

| Coverage | With residual | Without residual |
|---|---|---|
| ≥ 0.8 | `high` if residual < 0.10, else `med` | `high` |
| ≥ 0.6 | `med` if residual < 0.25, else `low` | `med` |
| ≥ 0.4 | `low` | `low` |
| < 0.4 | `low` | `low` |

### Fallback for missing data

Countries with gaps in signal coverage impute missing features using the training-set scaled mean (zero after standardisation, which is equivalent to contributing nothing to the log estimate). On the inference side the same scaler mean is used, so missing signals produce no bias. If all signals are missing, no estimate is returned.

---

## Known Limitations

**World Bank coverage gaps.** WDI does not carry data for Taiwan (`TW`), Palestine (`PS`), and a small number of territories. Taiwan is the most significant omission (~23M people).

**Signal availability varies by year.** Electricity and internet data tend to lag 1–2 years. Countries with fewer than two available signals fall back to a lower confidence tier.

**Building signal** uses the Microsoft Global ML Building Footprints dataset (~200 countries). The raw building count is used directly (not density). Countries with missing, zero, or corrupted footprint data are imputed from land area, urbanisation, and GDP.

**Mobility signal** scrapes the Numbeo Traffic Index by Country page (89 countries of direct data); the remaining countries are estimated via a linear regression on urbanisation percentage.

**6 countries have no land-area data** from the World Bank (VG, TW, GI, KP, MK, XK). Their `log(area)` falls back to the training-set mean, which reduces prediction accuracy for microstates such as Gibraltar.

**This is not a census replacement.** OSPI estimates are probabilistic. They are most useful for identifying divergence from official figures and tracking demographic trends, not as authoritative population counts.

---

## Stack

- **Backend:** Python, FastAPI, PostgreSQL, psycopg2, scikit-learn, httpx
- **ETL:** World Bank API (WDI), UN Data Portal API, Numbeo
- **Frontend:** Next.js, TypeScript, Chart.js, D3, Tailwind CSS
- **Deployment:** Vercel (frontend + backend serverless)

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.
