import type { DetailsResponse } from '@/components/ModelPage/types'

export interface AppCacheSchema {
  modelDetails: DetailsResponse
}

export type AppCacheKey = keyof AppCacheSchema

export interface TypedAppCache {
  get<K extends AppCacheKey>(key: K): AppCacheSchema[K] | null
  set<K extends AppCacheKey>(key: K, data: AppCacheSchema[K]): void
  invalidate(key?: AppCacheKey): void
}
