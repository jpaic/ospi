export interface CacheEntry<T> {
  data: T
  ts: number
}

const _store = new Map<string, CacheEntry<unknown>>()
const DEFAULT_TTL = 300_000

export function cacheGet<T>(key: string): T | null {
  const entry = _store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > DEFAULT_TTL) {
    _store.delete(key)
    return null
  }
  return entry.data as T
}

export function cacheSet<T>(key: string, data: T): void {
  _store.set(key, { data, ts: Date.now() })
}

export function cacheInvalidate(key?: string): void {
  if (key) _store.delete(key)
  else _store.clear()
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const k of _store.keys()) {
    if (k.startsWith(prefix)) _store.delete(k)
  }
}
