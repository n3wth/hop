import { afterEach, describe, expect, it, vi } from 'vitest'
import { recordCppObservations, type CppObservation } from '@/lib/valuation-telemetry'

// The sync seam is GATED behind env.isValuationSyncEnabled() (flag + Worker URL +
// shared secret). recordCppObservations() is fire-and-forget (synchronous, void)
// and must never throw — every failure mode (disabled, network, timeout,
// non-2xx) is swallowed silently.

const ORIGINAL_ENV = { ...process.env }

function enableSync() {
  process.env.HOP_ENABLE_VALUATION_SYNC = '1'
  process.env.HOP_VALUATION_WORKER_URL = 'https://hop-valuations.example.workers.dev'
  process.env.HOP_VALUATION_SYNC_SECRET = 'shh-secret'
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

// Give any unawaited internal fire-and-forget fetch a tick to actually run.
async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const SAMPLE: CppObservation = { programId: 'amex-mr', cpp: 2.1, cashCents: 20000, miles: 10000 }

describe('recordCppObservations() — gated no-op', () => {
  it('never calls fetch when the flag is unset', async () => {
    delete process.env.HOP_ENABLE_VALUATION_SYNC
    delete process.env.HOP_VALUATION_WORKER_URL
    delete process.env.HOP_VALUATION_SYNC_SECRET
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    recordCppObservations([SAMPLE])
    await flush()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never calls fetch when only the flag is set (no worker url/secret)', async () => {
    process.env.HOP_ENABLE_VALUATION_SYNC = '1'
    delete process.env.HOP_VALUATION_WORKER_URL
    delete process.env.HOP_VALUATION_SYNC_SECRET
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    recordCppObservations([SAMPLE])
    await flush()

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('recordCppObservations() — enabled', () => {
  it('POSTs to {WORKER_URL}/observe with the bearer secret + JSON body', async () => {
    enableSync()
    const fetchSpy = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true, inserted: 1 }), { status: 200 })),
    )
    vi.stubGlobal('fetch', fetchSpy)

    recordCppObservations([SAMPLE])
    await flush()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://hop-valuations.example.workers.dev/observe')
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer shh-secret')
    expect(headers['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body.samples).toEqual([SAMPLE])
  })

  it('filters invalid samples and caps to 50', async () => {
    enableSync()
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    vi.stubGlobal('fetch', fetchSpy)

    const bad: unknown[] = [
      { programId: '', cpp: 2 }, // empty programId
      { programId: 'delta', cpp: 0 }, // non-positive cpp
      { programId: 'delta', cpp: -1 }, // negative cpp
      { programId: 'delta', cpp: NaN }, // non-finite
      { programId: 'delta', cpp: Infinity }, // non-finite
      { programId: 'delta', cpp: 0.29 }, // below MIN_CPP band floor
      { programId: 'delta', cpp: 5.01 }, // above MAX_CPP band ceiling
      { programId: 'delta', cpp: 99 }, // wildly out of band
      { cpp: 2 }, // missing programId
      { programId: 123, cpp: 2 }, // wrong type
    ]
    const many = Array.from({ length: 60 }, (_, i) => ({ programId: `p${i}`, cpp: 1 + i * 0.01 }))

    recordCppObservations([...bad, ...many] as CppObservation[])
    await flush()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.samples).toHaveLength(50)
    expect(body.samples.every((s: CppObservation) => s.cpp > 0 && s.programId)).toBe(true)
  })

  it('rejects out-of-band cpp so a clamp downstream never saturates the mean', async () => {
    enableSync()
    const fetchSpy = vi.fn(() => Promise.resolve(new Response('{}', { status: 200 })))
    vi.stubGlobal('fetch', fetchSpy)

    // Band edges (MIN_CPP 0.3, MAX_CPP 5.0) are accepted; just outside is dropped.
    recordCppObservations([
      { programId: 'avios-ba', cpp: 0.3 }, // MIN_CPP edge — kept
      { programId: 'avios-ba', cpp: 5.0 }, // MAX_CPP edge — kept
      { programId: 'avios-ba', cpp: 0.1 }, // below floor — dropped
      { programId: 'avios-ba', cpp: 12.5 }, // above ceiling — dropped
    ])
    await flush()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    const body = JSON.parse(init.body as string)
    expect(body.samples.map((s: CppObservation) => s.cpp)).toEqual([0.3, 5.0])
  })

  it('no-ops on an empty or non-array samples argument', async () => {
    enableSync()
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    recordCppObservations([])
    // @ts-expect-error — exercising a non-array argument at runtime
    recordCppObservations(null)
    await flush()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('never throws when fetch rejects', async () => {
    enableSync()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('network down'))),
    )

    expect(() => recordCppObservations([SAMPLE])).not.toThrow()
    await flush()
  })

  it('never throws when fetch times out (AbortError)', async () => {
    enableSync()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 0)
          }),
      ),
    )

    expect(() => recordCppObservations([SAMPLE])).not.toThrow()
    await flush()
  })

  it('never throws when fetch resolves non-2xx', async () => {
    enableSync()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('nope', { status: 500 }))),
    )

    expect(() => recordCppObservations([SAMPLE])).not.toThrow()
    await flush()
  })
})
