let _versionData: {
  etl_year: number
  model_run: string | null
  r_squared: number | null
  n_countries: number | null
  n_signals: number
  model_id: number | null
} | null = null

let _versionPromise: Promise<{
  etl_year: number
  model_run: string | null
  r_squared: number | null
  n_countries: number | null
  n_signals: number
  model_id: number | null
} | null> | null = null

export async function fetchVersion() {
  if (_versionData) return _versionData
  if (_versionPromise) return _versionPromise
  const base = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '').replace(/\/+$/, '')
  if (!base) return null
  const { getModelVersion } = await import('./modelVersion')
  const version = getModelVersion()
  const qs = version === 'v3' ? '' : `?version=${version}`
  _versionPromise = fetch(`${base}/model/version${qs}`)
    .then(r => { if (!r.ok) throw new Error(); return r.json() })
    .then(d => { _versionData = d; return d })
    .catch(() => null)
  return _versionPromise
}
