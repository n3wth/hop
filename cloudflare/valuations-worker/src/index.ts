// hop-valuations Cloudflare Worker — first-party cpp observation intake +
// periodic aggregation into a trusted per-program valuation snapshot.
//
// Separate runtime from the Next.js app (Cloudflare Workers / workerd). Does
// NOT import anything from the Next app's lib/. Shares a small set of
// constants with the Vercel side by value only — keep these in sync with
// lib/env.ts / lib/valuations.ts / lib/valuation-overrides.ts / the
// HTTP contract documented in docs/plans/ (valuation-sync pipeline).

export interface Env {
  DB: D1Database
  HOP_VALUATION_SYNC_SECRET: string
}

interface Sample {
  programId: string
  cpp: number
  cashCents: number | null
  miles: number | null
}

// Keep in sync with lib/valuations.ts MIN_CPP / MAX_CPP.
const MIN_CPP = 0.3
const MAX_CPP = 5.0

// Keep in sync with lib/env.ts#isValuationSyncEnabled doc / shared contract.
const MIN_SAMPLES_TO_TRUST = 20

// Worker-only constants.
const MAX_DAMPING_PCT = 0.15
const OBSERVATION_RETENTION_DAYS = 45
const MAX_SAMPLES_PER_REQUEST = 50

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function sha256(input: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(digest)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  if (!match) return false
  const provided = match[1]
  if (!env.HOP_VALUATION_SYNC_SECRET) return false
  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided),
    sha256(env.HOP_VALUATION_SYNC_SECRET),
  ])
  return timingSafeEqual(providedHash, expectedHash)
}

// Accept only a cpp inside the sane band. Clamping the aggregate afterwards
// hides an out-of-band input rather than dropping it, so the trimmed mean can
// saturate at MIN_CPP/MAX_CPP — reject the bad input here instead.
function isInBandCpp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_CPP && value <= MAX_CPP
}

function parseSamples(body: unknown): Sample[] {
  if (typeof body !== 'object' || body === null) return []
  const samples = (body as { samples?: unknown }).samples
  if (!Array.isArray(samples)) return []

  const valid: Sample[] = []
  for (const entry of samples) {
    if (typeof entry !== 'object' || entry === null) continue
    const { programId, cpp, cashCents, miles } = entry as Record<string, unknown>
    if (typeof programId !== 'string' || programId.trim() === '') continue
    if (!isInBandCpp(cpp)) continue
    valid.push({
      programId,
      cpp,
      cashCents: typeof cashCents === 'number' && Number.isFinite(cashCents) ? cashCents : null,
      miles: typeof miles === 'number' && Number.isFinite(miles) ? miles : null,
    })
  }
  return valid
}

async function handleObserve(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ ok: false, error: 'bad request' }, 400)
  }

  const rawSamples = typeof body === 'object' && body !== null ? (body as { samples?: unknown }).samples : undefined
  if (!Array.isArray(rawSamples) || rawSamples.length === 0 || rawSamples.length > MAX_SAMPLES_PER_REQUEST) {
    return jsonResponse({ ok: false, error: 'bad request' }, 400)
  }

  const samples = parseSamples(body)
  if (samples.length === 0) {
    return jsonResponse({ ok: false, error: 'bad request' }, 400)
  }

  // Bind observed_at explicitly as an ISO-8601 UTC string (matching the
  // aggregation cutoff's toISOString()) rather than relying on the column's
  // datetime('now') default, which is space-separated ("YYYY-MM-DD HH:MM:SS")
  // and sorts incorrectly against ISO strings on the boundary day (' ' < 'T'
  // lexicographically, even when the actual time is later).
  const observedAt = new Date().toISOString()
  const statements = samples.map((sample) =>
    env.DB.prepare(
      'INSERT INTO observations (program_id, cpp, cash_cents, miles, observed_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(sample.programId, sample.cpp, sample.cashCents, sample.miles, observedAt)
  )
  await env.DB.batch(statements)

  return jsonResponse({ ok: true, inserted: samples.length }, 200)
}

async function handleGetValuations(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    'SELECT program_id, cpp, sample_size, as_of FROM valuation_snapshot'
  ).all<{ program_id: string; cpp: number; sample_size: number; as_of: string }>()

  const valuations: Record<string, { cpp: number; sampleSize: number; asOf: string }> = {}
  for (const row of result.results ?? []) {
    valuations[row.program_id] = {
      cpp: row.cpp,
      sampleSize: row.sample_size,
      asOf: row.as_of,
    }
  }

  return jsonResponse({ ok: true, valuations }, 200)
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

function trimmedMean(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const trimCount = Math.floor(sorted.length * 0.1)
  const trimmed = trimCount > 0 ? sorted.slice(trimCount, sorted.length - trimCount) : sorted
  const pool = trimmed.length > 0 ? trimmed : sorted
  return pool.reduce((sum, v) => sum + v, 0) / pool.length
}

function dampen(newValue: number, prevValue: number | null): number {
  if (prevValue === null || prevValue === undefined || !Number.isFinite(prevValue)) return newValue
  const maxDelta = Math.abs(prevValue) * MAX_DAMPING_PCT
  const delta = clamp(newValue - prevValue, -maxDelta, maxDelta)
  return prevValue + delta
}

export async function aggregate(env: Env): Promise<void> {
  const cutoff = new Date(Date.now() - OBSERVATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let programRows: { program_id: string }[] = []
  try {
    const result = await env.DB.prepare(
      `SELECT program_id, COUNT(*) as cnt FROM observations
       WHERE observed_at >= ?
       GROUP BY program_id
       HAVING cnt >= ?`
    )
      .bind(cutoff, MIN_SAMPLES_TO_TRUST)
      .all<{ program_id: string; cnt: number }>()
    programRows = (result.results ?? []).map((r) => ({ program_id: r.program_id }))
  } catch {
    return
  }

  const nowIso = new Date().toISOString()

  for (const { program_id: programId } of programRows) {
    try {
      const obsResult = await env.DB.prepare(
        'SELECT cpp FROM observations WHERE program_id = ? AND observed_at >= ?'
      )
        .bind(programId, cutoff)
        .all<{ cpp: number }>()
      const cppValues = (obsResult.results ?? []).map((r) => r.cpp)
      if (cppValues.length < MIN_SAMPLES_TO_TRUST) continue

      const mean = trimmedMean(cppValues)
      const clamped = clamp(mean, MIN_CPP, MAX_CPP)

      const existing = await env.DB.prepare(
        'SELECT cpp FROM valuation_snapshot WHERE program_id = ?'
      )
        .bind(programId)
        .first<{ cpp: number }>()

      const prevCpp = existing ? existing.cpp : null
      const dampedCpp = dampen(clamped, prevCpp)

      await env.DB.prepare(
        `INSERT INTO valuation_snapshot (program_id, cpp, sample_size, prev_cpp, as_of)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(program_id) DO UPDATE SET
           cpp = excluded.cpp,
           sample_size = excluded.sample_size,
           prev_cpp = excluded.prev_cpp,
           as_of = excluded.as_of`
      )
        .bind(programId, dampedCpp, cppValues.length, prevCpp, nowIso)
        .run()
    } catch {
      // One bad program can't abort the whole aggregation run.
      continue
    }
  }

  try {
    await env.DB.prepare('DELETE FROM observations WHERE observed_at < ?').bind(cutoff).run()
  } catch {
    // Pruning failure is non-fatal; next run will retry the delete.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)

      if (url.pathname === '/observe' && request.method === 'POST') {
        if (!(await isAuthorized(request, env))) {
          return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
        }
        return await handleObserve(request, env)
      }

      if (url.pathname === '/valuations' && request.method === 'GET') {
        if (!(await isAuthorized(request, env))) {
          return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
        }
        return await handleGetValuations(env)
      }

      return jsonResponse({ ok: false, error: 'not found' }, 404)
    } catch {
      return jsonResponse({ ok: false, error: 'internal error' }, 500)
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(aggregate(env))
  },
}
