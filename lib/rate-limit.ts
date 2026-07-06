// Lightweight in-memory token-bucket rate limiter for the node runtime. Guards
// expensive endpoints (e.g. the agentic concierge, which fans out to multiple
// LLM steps + provider web_search + outbound weather fetches per request) from
// repetition abuse — a scripted loop or auto-firing chips could otherwise drive
// unbounded gateway/open-meteo cost. Per-process only (no Redis); that's enough
// to blunt a single bad client on a single node. NEVER throws.
//
// Token bucket: each key gets CAPACITY tokens that refill at REFILL_PER_SEC. A
// request costs 1 token; when the bucket is empty the request is limited. We
// sweep idle buckets so memory stays bounded.

interface Bucket {
  tokens: number
  last: number // ms timestamp of last refill
}

export interface RateLimitConfig {
  capacity: number // burst size
  refillPerSec: number // sustained rate
}

export interface RateLimitResult {
  ok: boolean
  retryAfterSec: number // hint for when a limited caller may try again
}

const buckets = new Map<string, Bucket>()
const IDLE_MS = 10 * 60 * 1000 // drop buckets untouched for 10m
let lastSweep = 0

function sweep(now: number) {
  if (now - lastSweep < IDLE_MS) return
  lastSweep = now
  for (const [k, b] of buckets) {
    if (now - b.last > IDLE_MS) buckets.delete(k)
  }
}

// Consume one token for `key`. Returns { ok:false } when the bucket is empty.
// Pure aside from the module-level bucket map; total (never throws).
export function rateLimit(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now()
  sweep(now)
  const cap = Math.max(1, cfg.capacity)
  const rate = Math.max(0.0001, cfg.refillPerSec)
  let b = buckets.get(key)
  if (!b) {
    b = { tokens: cap, last: now }
    buckets.set(key, b)
  }
  // Refill based on elapsed time, clamped to capacity.
  const elapsedSec = (now - b.last) / 1000
  b.tokens = Math.min(cap, b.tokens + elapsedSec * rate)
  b.last = now
  if (b.tokens >= 1) {
    b.tokens -= 1
    return { ok: true, retryAfterSec: 0 }
  }
  const retryAfterSec = Math.ceil((1 - b.tokens) / rate)
  return { ok: false, retryAfterSec }
}

// TEST-ONLY: reset the limiter between cases so buckets don't leak across tests.
export function _resetRateLimitForTest() {
  buckets.clear()
  lastSweep = 0
}

// Best-effort client IP, used to key the limiter per-caller. Prefers Vercel's
// platform-computed headers over blindly parsing x-forwarded-for: a client
// can set x-forwarded-for to anything before it reaches an intermediate
// proxy, and naively trusting its leading entry would let an attacker rotate
// fake IPs per-request to dodge the limiter's bucket key. x-vercel-forwarded-
// for is Vercel's own edge-resolved client IP and stays correct even when
// another proxy (e.g. hop's Cloudflare workers) sits in front of Vercel;
// x-real-ip is the next most reliable platform signal (Vercel docs: both are
// platform-set, unlike a bare x-forwarded-for chain a client can prepend to).
// Only off-Vercel contexts (local dev, tests, CI) fall through to parsing
// x-forwarded-for's leading entry — there's no adversary on that path, and a
// real Vercel request always carries x-vercel-forwarded-for, so that
// fallback never runs in production. Falls back to a shared 'unknown' bucket
// when nothing is present (still caps anonymous abuse per node). Pure + total.
export function clientIp(request: Request): string {
  return clientIpFromHeaders(request.headers)
}

// Same proxy-header parsing as clientIp(), for callers that never receive a
// Request — server actions only get `headers()` from `next/headers` (Next 16
// has no `Request` in that context), so this is the shared source both read.
export function clientIpFromHeaders(h: Headers): string {
  const vercelForwarded = h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
  if (vercelForwarded) return vercelForwarded
  const realIp = h.get('x-real-ip')?.trim()
  if (realIp) return realIp
  const first = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (first) return first
  return 'unknown'
}

// ── Durable, cross-instance limiting via Upstash (optional) ─────────────────
// The in-memory bucket above is PER-PROCESS: on Vercel's serverless fleet a
// caller spread across instances can slip past it. When an Upstash Redis is
// configured (UPSTASH_REDIS_REST_* or Vercel-KV's KV_REST_API_*), we limit there
// so the cap holds across every instance. With no Redis env we transparently
// fall back to the in-memory bucket — so local dev + tests need no Redis.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// undefined = not yet resolved; null = no Redis env (use in-memory fallback).
let redisClient: Redis | null | undefined
function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  try {
    // new Redis() THROWS on a malformed URL (e.g. missing https://, a typo'd
    // env). Catch it so a bad Redis config degrades to the in-memory bucket
    // instead of throwing here — honoring this module's never-throw contract.
    // Caching null also prevents re-constructing (and re-throwing) every call.
    redisClient = url && token ? new Redis({ url, token }) : null
  } catch {
    redisClient = null
  }
  return redisClient
}

// One Ratelimit per distinct config (cheap to reuse; keyed by its shape). The
// token bucket mirrors the in-memory model. Upstash's tokenBucket takes an
// INTEGER refillRate per interval, so a fractional rate (our configs use 0.2/s =
// 12/min) is encoded as 1 token per N ms — NOT rounded up to 1/s (which would 5x
// the budget). Caller guarantees refillPerSec > 0 (see checkRateLimit).
const limiters = new Map<string, Ratelimit>()
function limiterFor(cfg: RateLimitConfig, redis: Redis): Ratelimit {
  const id = `${cfg.capacity}:${cfg.refillPerSec}`
  let rl = limiters.get(id)
  if (!rl) {
    const intervalMs = Math.max(1, Math.round(1000 / cfg.refillPerSec))
    rl = new Ratelimit({
      redis,
      limiter: Ratelimit.tokenBucket(
        1,
        `${intervalMs} ms` as `${number} ms`,
        Math.max(1, Math.round(cfg.capacity)),
      ),
      prefix: 'hop:rl',
    })
    limiters.set(id, rl)
  }
  return rl
}

// Durable rate check: uses Upstash when configured, else the in-memory bucket.
// NEVER throws — a Redis hiccup degrades to the in-memory bucket rather than
// failing the request (matches the "never break /ask on infra failure" stance).
// A non-positive refill (pure burst, no refill) can't be expressed as an Upstash
// token bucket, so it also takes the in-memory path.
export async function checkRateLimit(key: string, cfg: RateLimitConfig): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis || cfg.refillPerSec <= 0) return rateLimit(key, cfg)
  try {
    const res = await limiterFor(cfg, redis).limit(key)
    if (res.success) return { ok: true, retryAfterSec: 0 }
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) }
  } catch {
    return rateLimit(key, cfg)
  }
}
