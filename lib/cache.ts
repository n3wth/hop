/* eslint-disable @typescript-eslint/no-explicit-any */
// Reusable TTL Cache using Upstash Redis with a transparent, graceful in-memory
// fallback when Redis is unconfigured or fails (local development, test suites).
//
// Guaranteed to never throw — any Redis connection error or timeout degrades
// silently and immediately to the in-memory fallback.

import { Redis } from '@upstash/redis'

interface CacheEntry {
  value: any
  expiresAt: number
}

// In-memory cache fallback
const memoryCache = new Map<string, CacheEntry>()

// Resolve Upstash Redis client lazily
let redisClient: Redis | null | undefined

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  try {
    redisClient = url && token ? new Redis({ url, token }) : null
  } catch {
    redisClient = null
  }
  return redisClient
}

/** Get a value from the cache. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (redis) {
    try {
      const data = await redis.get<T>(key)
      return data
    } catch (error) {
      console.warn(`[Cache] Redis get error for key "${key}", falling back to memory:`, error)
    }
  }

  // Fallback to in-memory cache
  const entry = memoryCache.get(key)
  if (entry) {
    if (entry.expiresAt > Date.now()) {
      return entry.value as T
    }
    memoryCache.delete(key) // Clean up expired entries
  }
  return null
}

/** Set a value in the cache with a TTL (in seconds). */
export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSec })
      return true
    } catch (error) {
      console.warn(`[Cache] Redis set error for key "${key}", falling back to memory:`, error)
    }
  }

  // Fallback to in-memory cache
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSec * 1000,
  })
  return true
}

/**
 * High-level caching wrapper. Gets the value from the cache, or executes the
 * callback, caches the result, and returns it.
 */
export async function cacheWrap<T>(
  key: string,
  ttlSec: number,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const cached = await cacheGet<T>(key)
    if (cached !== null) return cached

    const fresh = await fn()
    await cacheSet(key, fresh, ttlSec)
    return fresh
  } catch (error) {
    console.error(`[Cache] Wrap error for key "${key}", executing fresh function directly:`, error)
    return fn()
  }
}

/**
 * Test-only: drop every in-memory fallback entry (Redis is untouched).
 * Suites that exercise cached clients (e.g. searchCash) call this between
 * tests so a cached result from one test can't swallow the next test's fetch.
 */
export function cacheClearMemory(): void {
  memoryCache.clear()
}

/** Clear a cache key. */
export async function cacheDelete(key: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    try {
      await redis.del(key)
      return true
    } catch (error) {
      console.warn(`[Cache] Redis del error for key "${key}":`, error)
    }
  }
  return memoryCache.delete(key)
}
