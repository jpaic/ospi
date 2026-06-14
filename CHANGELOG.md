# Changelog

## v3 (2026)

### Added
- **Version switcher:** sidebar toggle loads v2 or v3 model dynamically; all UI elements (coefficient bars, signal display, model outliers chart) update per version
- **Population-weighted training:** `GridSearchCV(Ridge())` with weight proportional to population — improves global sum accuracy at the cost of higher per-country variance for small nations
- **Model outliers API:** `/model/outliers` endpoint returns top-N residuals for the selected version
- **Version-aware cache key:** localStorage key includes model version (`ospi:countries:${version}`) to prevent stale data when switching between v2 and v3
- **Dashboard screenshots:** gallery at top of README showing the dashboard and country detail panel
- **Table of contents:** navigable section links under the overview
- **CHANGELOG.md:** standalone changelog with per-version history

### Changed
- **New signals:** gdp_per_capita (log-normalised from country_metadata) and nightlights (VIIRS DNB monthly composites) replace building footprints and internet usage
- **Mobility source:** switched from Numbeo Traffic Index (89 countries) to Google Community Mobility Reports (universal coverage)
- **Ridge regularisation:** from per-feature individual alphas (v2) to population-weighted `RidgeCV` with single optimised alpha (v3)
- **Model features:** reduced from 7 (5 signals + log_area + signal_count) to 6 (5 signals + log_area) — signal_count removed
- **Confidence thresholds:** HIGH_POP_YEARS raised from 5 to 10, MED_POP_YEARS lowered from 8 to 5, fixing the inverted comparison where high was easier to reach than medium
- **Precision:** `calcDelta` and `globalStats` return raw float percentages instead of pre-rounded integers — sidebar stats now match dashboard stat cards exactly
- **Scatter chart:** reverted to original signal-vs-divergence view with `min: 0` on both axes
- **README:** simplified tagline and overview, replaced inline changelog with link to CHANGELOG.md, removed `?version=` code block mentions
- **Backend schema:** `version` column in `model_weights` for branch isolation (v2 Ridge / v3 Ridge)

### Removed
- **Signals:** building footprints, internet usage, signal_count — removed due to low coverage or zero variance
- **Retrain UI:** retrain button, handler, and `/api/retrain` proxy removed from frontend
- **Admin endpoints:** all `/admin/*` backend routes removed (retrain, retrain/status, retrain/sync, model-health, model-diagnostics, apply-patches)
- **`NEXT_PUBLIC_ADMIN_TOKEN`:** no longer shipped to client browsers (admin calls proxied server-side before being removed entirely)
- **`road_density.py`:** dead signal module, never imported anywhere
- **`_retrain_status` global dict:** replaced with DB-persisted table (then removed alongside admin endpoints)
- **`TODO-v3.md`:** removed after v3 went live
- **`job_status` table and service:** removed alongside admin endpoints

### Fixed
- **Inverted confidence thresholds:** HIGH_POP_YEARS (5) was lower than MED_POP_YEARS (8), making high confidence easier to achieve than medium — thresholds corrected
- **Background retrain logging:** orphaned `%s` format string removed from `logger.error` call so traceback renders correctly
- **SQL injection vector:** replaced f-string `DELETE FROM {table}` with static `_CLEAR_QUERIES` dispatch dict
- **Sidebar stats alignment:** `globalStats` computed on same `visibleCountries` list as dashboard stat cards — confidence breakdown bars, country count, and totals are now consistent
- **CDN fetch:** world atlas `d3.json` call wrapped in try/catch so a CDN outage doesn't crash the map

---

## v2 (2026)

### Added
- **Ridge regression pipeline:** per-feature regularisation with individual alpha penalties — strong signals (telecom, land area) are near-OLS, weak signals (building, mobility, internet) are heavily shrunk toward zero
- **StandardScaler:** signal scores standardised to zero mean, unit variance before training and inference
- **Continent-level bias adjustments:** UN sub-regions mapped to five continents (Africa, Americas, Asia, Europe, Oceania) with one-hot encoding and learned region coefficients stored as JSONB
- **Out-of-fold residuals:** five-fold cross-validation produces per-country residuals and CV R-squared as a guard against overfitting
- **Model diagnostics API:** `/model/details` endpoint returns scatter data, residual histogram, confidence distribution, coverage distribution, and feature importance
- **Model status API:** `/model/status` and `/model/version` endpoints for quick health checks
- **Model status dashboard:** frontend panel showing R-squared, training count, coefficients, lambda, and training timestamp with expandable details
- **Model showcase page:** scatter plot (linear/log-log toggle), residual histogram (absolute/signed + CDF toggles), CV fold metrics (R²/RMSE toggle), cross-validation diagnostics, feature importance bars, confidence distribution
- **Interactive world map:** D3 `geoNaturalEarth1` projection with scroll zoom, drag pan, rotation, and animated country focus
- **Per-country detail panel:** signal breakdown bars, OSPI vs official history chart, growth rate, density, GDP per capita, and urbanisation quick stats
- **Landing page:** animated signal bars with background country data preloading
- **Territory filter:** sidebar toggle to exclude non-sovereign entities from the dashboard
- **Responsive layout:** sidebar drawer with collapsible panels, proper resize reflow without overlapping
- **Data source merging:** UN baseline populations merged with backend signal scores via shared module-level cache with 24-hour localStorage TTL
- **Number formatting utilities:** shared `fmt`, `fmtPct`, `fmtDensity`, `fmtUsd` helpers applied across all UI components
- **Column sorting:** per-column asc/desc/reset cycle on the all-countries table
- **Loading overlay:** frosted-glass overlay with animated signal bars that fades out on data hydration (injected as raw HTML/CSS to prevent flicker)
- **Navigation:** shared `NavHeader` component, `/dashboard` and `/model` routes, navigation overlay system
- **OSPI history:** 2010+ yearly estimates with optimised payload structure
- **Error boundary:** catches cascading re-render failures gracefully
- **Test infrastructure:** pytest for backend, Vitest/Testing Library for frontend
- **Admin endpoints:** `/admin/retrain`, `/admin/retrain/status`, `/admin/retrain/sync`, `/admin/model-health`, `/admin/model-diagnostics`, `/admin/apply-patches`
- **Logging framework:** structured Python logging replacing scattered `print()` calls

### Changed
- **Data pipeline:** migrated from client-side mock data and UN fetch scripts to full backend ETL pipeline with PostgreSQL storage
- **Dashboard layout:** moved from monolithic page to `/dashboard` route with dedicated stat cards, scatter chart, outliers panel
- **Signal indicators:** migrated from per-capita to absolute-volume signal values for better correlation with total population
- **Country filtering:** non-countries filtered using UN member states list and World Bank ISO3 validation instead of ad-hoc allowlists
- **Topojson resolution:** switched from 110m to 50m for better microstate rendering
- **Copyright:** updated to current year and owner

### Removed
- **Mock data:** entire `mock-data.ts` dataset and `DataSourceToggle` component removed after backend migration
- **UN fetch script:** `fetchUnData.ts` removed after backend DB/ETL took over UN data ingestion
- **Data source toggle:** UN vs mock toggle removed, always fetches from backend

### Fixed
- **Missing coordinates:** lat/lng for XK, MF, BL, GG, JE auto-applied via coords schema patch after metadata store
- **Loading flicker:** overlay injected in `layout.tsx` before JS hydration to eliminate flash-of-content
- **OSPI chart alignment:** trend marker, dashed connector, tooltip labels, and dashboard sort order corrected
- **Trend chart:** shows only the latest OSPI estimate point (not a separate line) for clarity
- **World Map bounds:** zoom bounds corrected for small countries and microstates; 180° pan wraparound fixed
- **Territories:** dependencies hidden by default with usage note, renamed for clarity

---

## v1 (2025)

### Added
- **Project scaffold:** Next.js 14 App Router frontend (TypeScript), FastAPI backend (Python), PostgreSQL database
- **Correction-factor model:** simple proportional adjustment based on signal composites — fallback when Ridge coefficients are unavailable
- **Signal ETL pipeline:** per-signal Python modules for telecom, electricity, building, internet, and mobility — each fetching raw data from World Bank WDI, normalising to log-scale [0, 100] scores, and storing alongside UN population figures
- **Population ETL:** UN World Population Prospects (WPP) medium variant data ingestion via UN Data Portal API, 2010–2024
- **Country metadata ETL:** World Bank country list with UN location data for coordinates, sub-region classification, and land area
- **World map:** D3-based interactive map with country markers coloured by confidence tier
- **Dashboard:** country list with basic stat cards, alphabetical sort, and scatter insight strip
- **Confidence tiers:** binary high/low classification based on signal availability
- **Shared types:** `Country`, `SignalScores`, and related types extracted into shared module
- **README and LICENSE:** project documentation and Apache 2.0 license

### Infrastructure
- **Backend:** FastAPI with `psycopg2`, `httpx`, PostgreSQL — deployed on Vercel serverless
- **Frontend:** Next.js 14 App Router with D3, Chart.js, Tailwind CSS — deployed on Vercel
- **Database schema:** tables for `signals`, `populations`, `country_metadata` with Postgres connection pooling
- **ETL tools:** World Bank WDI API (JSON), UN Data Portal API, Numbeo Traffic Index for mobility, Microsoft Global ML Building Footprints
