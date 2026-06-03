export interface ModelInfo {
  model_id:     number
  trained_at:   string
  r_squared:    number | null
  cv_r_squared: number | null
  n_training:   number | null
  intercept:    number | null
  coefficients: Record<string, number | null>
  region_coefs: Record<string, number> | null
}

export interface ScatterPoint {
  iso2:         string
  name:         string
  official:     number
  ospi:         number
  residual:     number
  residual_pct: number
}

export interface Histogram {
  bins:   number[]
  counts: number[]
  mean:   number
  std:    number
  p95:    number
  p99:    number
  min:    number
  max:    number
  n:      number
}

export interface CoverageDist {
  total: number
  tiers: Record<string, number>
}

export interface CvResult {
  n_countries:  number
  n_splits:     number
  cv_r2_mean:   number
  cv_r2_std:    number
  cv_rmse_mean: number
  cv_rmse_std:  number
  r2_by_fold:   number[]
  rmse_by_fold: number[]
}

export interface DetailsResponse {
  trained:            boolean
  model?:             ModelInfo
  training_scatter?:  ScatterPoint[]
  residual_histogram?: Histogram
  outliers?:          ScatterPoint[]
  confidence?:        Record<string, number>
  coverage?:          CoverageDist
  cv?:                CvResult
  feature_importance?: { feature: string; coefficient: number }[]
}
