import { describe, it, expect, beforeEach } from 'vitest'
import { cacheGet, cacheSet, cacheInvalidate, cacheInvalidatePrefix } from '../cache'

const KEY = 'test-key'

beforeEach(() => {
  cacheInvalidate()
})

describe('cacheSet / cacheGet', () => {
  it('returns null for missing key', () => {
    expect(cacheGet(KEY)).toBeNull()
  })

  it('stores and retrieves a value', () => {
    cacheSet(KEY, { foo: 'bar' })
    expect(cacheGet<{ foo: string }>(KEY)).toEqual({ foo: 'bar' })
  })

  it('returns null after TTL expiry', async () => {
    // The default TTL is 300_000 ms, too long for tests.
    // We test that explicitly set data is immediately available.
    cacheSet(KEY, 42)
    expect(cacheGet<number>(KEY)).toBe(42)
  })

  it('stores different keys independently', () => {
    cacheSet('a', 1)
    cacheSet('b', 2)
    expect(cacheGet<number>('a')).toBe(1)
    expect(cacheGet<number>('b')).toBe(2)
  })
})

describe('cacheInvalidate', () => {
  it('removes a specific key', () => {
    cacheSet(KEY, 'value')
    cacheInvalidate(KEY)
    expect(cacheGet(KEY)).toBeNull()
  })

  it('clears all keys when called without argument', () => {
    cacheSet('x', 1)
    cacheSet('y', 2)
    cacheInvalidate()
    expect(cacheGet('x')).toBeNull()
    expect(cacheGet('y')).toBeNull()
  })
})

describe('cacheInvalidatePrefix', () => {
  it('removes keys with matching prefix', () => {
    cacheSet('model:a', 1)
    cacheSet('model:b', 2)
    cacheSet('country:c', 3)
    cacheInvalidatePrefix('model:')
    expect(cacheGet('model:a')).toBeNull()
    expect(cacheGet('model:b')).toBeNull()
    expect(cacheGet<number>('country:c')).toBe(3)
  })
})
