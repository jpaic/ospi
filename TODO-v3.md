# OSPI v3 — Model Improvement Plan

**Tag v2** at current HEAD (`c05b3d5`).  
**Branch** `v3-dev` for all v3 work.

---

## Changes across all three work items

### Database (model_weights columns)

`backend/db/schema.sql` + `backend/db/patches/model_schema_patch.sql`

```
Replace:  building, mobility, internet
With:     gdp_per_capita, nightlights, road_density
Add:      elasticnet_alpha FLOAT, l1_ratio FLOAT
```

### Signal config (SIGNAL_KEYS)

`backend/etl/utils/signal_pivot.py:8`

```
OLD: ["telecom", "electricity", "building", "mobility", "internet"]
NEW: ["telecom", "electricity", "gdp_per_capita", "nightlights", "road_density"]
```

Also update `backend/services/estimator.py:34` to match.

---

## Step 1 — New signal ETL pipelines

### 1a. Nighttime lights (VIIRS DNB)

Create `backend/etl/signals/nightlights.py`

- Source: World Bank `EN.ATM.CO2E.KT` (CO₂ emissions, metric tons per capita) as a proven proxy for economic activity / nighttime lights
  - Same API pattern as telecom.py (World Bank API, json response, per-country per-year)
  - Alternative: NASA Black Marble if CO₂ is too noisy
- Normalisation: log(raw) → min-max to [0, 100]
- Store as signal_type = `'nightlights'`

### 1b. Road density (OSM)

Create `backend/etl/signals/road_density.py`

- Source: World Bank `IS.ROD.DNST.K2` (km of road per 100 km² land area)
  - Same API pattern as telecom.py
- Normalisation: log(raw) → min-max to [0, 100]
- Store as signal_type = `'road_density'`

### 1c. GDP per capita (already in DB)

GDP per capita is already fetched by `backend/etl/signals/metadata.py` (World Bank `NY.GDP.PCAP.CD`) and stored in `country_metadata.gdp_per_capita`. No new ETL needed — just join it from `country_metadata` in the training SQL.

---

## Step 2 — Remove old signals

### Delete these files (dead code):

| File | Reason |
|---|---|
| `backend/etl/signals/building.py` | Replaced by new signals |
| `backend/etl/signals/mobility.py` | Replaced |
| `backend/etl/signals/internet.py` | Replaced |
| `backend/etl/data/building_density.csv` | Building source data |
| `backend/etl/data/numbeo_traffic.csv` | Mobility source data |
| `backend/etl/utils/generate_building_data.py` | Building generator |
| `backend/etl/utils/generate_numbeo_traffic.py` | Mobility generator |

---

## Step 3 — ETL jobs runner

`backend/etl/jobs.py`

- Remove `run_building()`, `run_mobility()`, `run_internet()` and their clear_signal_type calls
- Add `run_nightlights()` and `run_road_density()` following the same `_run_etl` pattern
- Update `__main__` block

---

## Step 4 — Confidence scoring

`backend/etl/training/confidence.py`

- Still 5 signals (just different ones). Coverage thresholds stay the same.
- No code change needed — `SIGNAL_KEYS` drives the logic automatically

---

## Step 5 — Trainer (per-feature Ridge → ElasticNet + kNN imputation)

### 5a. Feature matrix building

`backend/etl/training/trainer.py — _build_feature_matrix`

- Build raw signal matrix with `NaN` for missing values (instead of immediate mean imputation)
- Compute `signal_count` from pre-imputation NaN mask
- Apply `sklearn.impute.KNNImputer(n_neighbors=5, weights='distance')` to fill missing signal scores
- Keep mean-imputation for `log_area_km2` (only 1-dim — kNN doesn't apply)

### 5b. Model fitting

`backend/etl/training/trainer.py — _fit_ridge_per_feature` → `_fit_elasticnet`

- Replace the closed-form ridge solve with `sklearn.linear_model.ElasticNetCV`
  - `l1_ratio=[0.1, 0.5, 0.7, 0.9, 0.95, 0.99, 1.0]`
  - `alphas=np.logspace(-4, 1, 20)` (CV searches best α from 0.0001 to 10)
  - `cv=5`, `random_state=42`, `max_iter=10000`
- Remove `SIGNAL_FEATURE_ALPHAS` and `CONTINENT_ALPHA` — no more per-feature penalties
- Continent dummies included directly in the feature matrix (same scaling as signals)

### 5c. Trainer pipeline

`backend/etl/training/trainer.py — run_training`

- Apply `StandardScaler` to ALL columns (signals + continent dummies), not just signals
- CV loop uses `_fit_elasticnet` instead of `_fit_ridge_per_feature`
- Store `elasticnet_alpha` (= `model.alpha_`) and `l1_ratio` (= `model.l1_ratio_`) in weights

### 5d. Model persistence

`backend/etl/training/trainer.py — _persist_model`

- Add `elasticnet_alpha` and `l1_ratio` to the INSERT

---

## Step 6 — Evaluation

`backend/etl/training/evaluate.py`

- Same SQL pivot update for new signals
- Same ElasticNet replacement in CV diagnostics
- Same kNN imputation in `load_all_training_data`

---

## Step 7 — Estimator (inference)

`backend/services/estimator.py`

- Update `SIGNAL_KEYS` to match new signals (line 34)
- Update v1 fallback weights (lines 38-44)
- Update v1 fallback SQL VALUES (lines 433-439)
- For inference imputation: keep mean imputation (simpler for single-row inference; training gets kNN)
- GDP per capita (log-normalised) needs to be read from `country_metadata` — add it to the inference data fetch

---

## Step 8 — API routes

`backend/api/routes.py`

- `build_signals()` (line 155-163) — update signal keys
- `_build_details()` (line 305) — update coefficient key list
- `model_status()` (lines 465-467) — update returned signal keys
- `n_signals` stays 5 (lines 484, 502) — still 5 signals

---

## Step 9 — Tests

`backend/tests/test_routes.py`

- Update mock signal data in test assertions (lines 113-115)

---

## Step 10 — Frontend

### 10a. Types

`frontend/lib/types.ts:1-7` — Update `SignalScores` interface

### 10b. Colors & labels

`frontend/components/ModelPage/charts.tsx:7-25`
`frontend/components/ModelStatus.tsx:33-39`

Replace building/mobility/internet with gdp_per_capita/nightlights/road_density in both `SIGNAL_COLORS` and `SIGNAL_LABELS`.

Suggested colors:
| Signal | Color |
|---|---|
| `gdp_per_capita` | `#8B5CF6` (purple) |
| `nightlights` | `#FBBF24` (amber) |
| `road_density` | `#EC4899` (pink) |

Suggested labels:
| Signal | Label |
|---|---|
| `gdp_per_capita` | 'GDP pc' |
| `nightlights` | 'Nightlights' |
| `road_density` | 'Road Density' |

### 10c. Country detail

`frontend/components/CountryDetail.tsx:14-20` — Update `SIGNALS` array with new keys and labels

### 10d. Landing page

`frontend/app/page.tsx:133` — Update text mentioning "5 signals"

---

## Step 11 — Documentation

`README.md`

- Update signal table (lines 28-37)
- Update model equation (lines 65-74)
- Update signal normalisation table (lines 108-117)
- Update performance metrics (lines 101-105)
- Add v3 changelog section

---

## Step 12 — Commit & push

```
git add -A
git commit -m "v3: replace building/mobility/internet with GDP pc, nightlights, road density + ElasticNet + kNN imputation"
git push origin v3-dev
```

---

## Merge notes

Neither branch has `vercel.json` lockdown files — both auto-deploy (main → production, v3-dev → preview) with no conflict. Merge is a simple fast-forward:

```bash
git checkout main
git merge v3-dev
git push origin main
```
