const STORAGE_KEY = 'ospi:modelVersion'

export function getModelVersion(): string {
  if (typeof window === 'undefined') return 'v3'
  try {
    return localStorage.getItem(STORAGE_KEY) || 'v3'
  } catch {
    return 'v3'
  }
}

export function setModelVersion(v: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, v)
  } catch {
    // noop
  }
}

export function versionParam(): string {
  const v = getModelVersion()
  return v === 'v3' ? '' : `?version=${v}`
}
