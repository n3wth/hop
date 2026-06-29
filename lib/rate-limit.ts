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

// Best-effort client IP from common proxy headers (Vercel/Cloud), used to key the
// limiter per-caller. Falls back to a shared 'unknown' bucket when nothing is
// present (still caps anonymous abuse per node). Pure + total.
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
