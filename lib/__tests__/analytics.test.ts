import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { FUNNEL_EVENTS, type FunnelEventProperties } from '@/lib/analytics'

// posthog-js is loaded lazily (dynamic import) by lib/analytics-client — mock
// it so the client seam is observable without a browser. Spies are hoisted so
// the factory can reference them.
const { initSpy, captureSpy, identifySpy } = vi.hoisted(() => ({
  initSpy: vi.fn(),
  captureSpy: vi.fn(),
  identifySpy: vi.fn(),
}))
vi.mock('posthog-js', () => ({
  default: { init: initSpy, capture: captureSpy, identify: identifySpy },
}))

// Fresh module instance per test — the client memoizes its init promise.
async function freshClient() {
  vi.resetModules()
  return import('@/lib/analytics-client')
}

async function freshServer() {
  vi.resetModules()
  return import('@/lib/posthog-server')
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.POSTHOG_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST
  delete process.env.POSTHOG_HOST
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('FUNNEL_EVENTS — exactly the five R0.5 funnel events', () => {
  it('contains exactly the five event names, nothing else', () => {
    expect(Object.values(FUNNEL_EVENTS).sort()).toEqual([
      'first_program_added',
      'outclick',
      'search_ran',
      'signed_up',
      'verdict_viewed',
    ])
  })

  it('payload shapes compile for each event', () => {
    // Type-level assertions — a compile failure here is the test.
    const signedUp: FunnelEventProperties['signed_up'] = {}
    const first: FunnelEventProperties['first_program_added'] = { program: 'United MileagePlus' }
    const search: FunnelEventProperties['search_ran'] = { origin: 'SFO', destination: 'NRT' }
    const verdict: FunnelEventProperties['verdict_viewed'] = {
      verdict: 'use-points',
      cpp: 3.2,
      program: 'United MileagePlus',
    }
    const outclick: FunnelEventProperties['outclick'] = {
      kind: 'cash',
      target: 'SFO-NRT',
      url: 'https://www.kiwi.com/deep?from=SFO',
      program: null,
    }
    expect([signedUp, first, search, verdict, outclick]).toHaveLength(5)
  })
})

describe('lib/analytics-client — lazy, gated, silent no-op without a key', () => {
  it('no NEXT_PUBLIC_POSTHOG_KEY → capture/identify are complete no-ops (posthog-js never initialized)', async () => {
    vi.stubGlobal('window', {})
    const { captureClientEvent, identifyUser } = await freshClient()

    expect(() =>
      captureClientEvent(FUNNEL_EVENTS.searchRan, { origin: 'SFO', destination: 'NRT' }),
    ).not.toThrow()
    expect(() => identifyUser('user-1')).not.toThrow()
    await flush()

    expect(initSpy).not.toHaveBeenCalled()
    expect(captureSpy).not.toHaveBeenCalled()
    expect(identifySpy).not.toHaveBeenCalled()
  })

  it('no window (server render) → no-op even with a key set', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    const { captureClientEvent } = await freshClient()

    captureClientEvent(FUNNEL_EVENTS.searchRan, { origin: 'SFO', destination: 'NRT' })
    await flush()

    expect(initSpy).not.toHaveBeenCalled()
    expect(captureSpy).not.toHaveBeenCalled()
  })

  it('key + window → initializes posthog-js once (no autocapture/pageview noise) and captures', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    vi.stubGlobal('window', {})
    const { captureClientEvent, identifyUser } = await freshClient()

    captureClientEvent(FUNNEL_EVENTS.searchRan, { origin: 'SFO', destination: 'NRT' })
    captureClientEvent(FUNNEL_EVENTS.verdictViewed, {
      verdict: 'use-points',
      cpp: 3.2,
      program: 'ANA Mileage Club',
    })
    identifyUser('user-1')
    await flush()

    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(initSpy.mock.calls[0][0]).toBe('phc_test')
    expect(initSpy.mock.calls[0][1]).toMatchObject({
      autocapture: false,
      capture_pageview: false,
    })
    expect(captureSpy).toHaveBeenCalledWith('search_ran', { origin: 'SFO', destination: 'NRT' })
    expect(captureSpy).toHaveBeenCalledWith('verdict_viewed', {
      verdict: 'use-points',
      cpp: 3.2,
      program: 'ANA Mileage Club',
    })
    expect(identifySpy).toHaveBeenCalledWith('user-1')
  })

  it('never throws to the page, even when posthog-js init explodes', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    vi.stubGlobal('window', {})
    initSpy.mockImplementationOnce(() => {
      throw new Error('sdk broke')
    })
    const { captureClientEvent } = await freshClient()

    expect(() =>
      captureClientEvent(FUNNEL_EVENTS.searchRan, { origin: 'SFO', destination: 'NRT' }),
    ).not.toThrow()
    await flush()
    expect(captureSpy).not.toHaveBeenCalled()
  })
})

describe('lib/posthog-server#captureFunnelEvent — server half of the funnel', () => {
  it('no key → resolves without ever calling fetch', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { captureFunnelEvent } = await freshServer()

    await expect(
      captureFunnelEvent({ event: FUNNEL_EVENTS.signedUp, distinctId: 'user-1' }),
    ).resolves.toBeUndefined()
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('distinctId → person event keyed to the Better Auth user id', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const { captureFunnelEvent } = await freshServer()

    await captureFunnelEvent({ event: FUNNEL_EVENTS.signedUp, distinctId: 'user-1' })

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.event).toBe('signed_up')
    expect(body.distinct_id).toBe('user-1')
    // Person events must NOT suppress person-profile processing — that's what
    // joins them to the client-side identify()'d person.
    expect(body.properties.$process_person_profile).not.toBe(false)
  })

  it('no distinctId → anonymous server-label event (outclick), profile processing off', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchSpy)
    const { captureFunnelEvent } = await freshServer()

    await captureFunnelEvent({
      event: FUNNEL_EVENTS.outclick,
      properties: { kind: 'cash', target: 'SFO-NRT', url: 'https://www.kiwi.com/x', program: null },
    })

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body)
    expect(body.event).toBe('outclick')
    expect(body.distinct_id).toBe('hop-server')
    expect(body.properties).toMatchObject({
      kind: 'cash',
      target: 'SFO-NRT',
      $process_person_profile: false,
    })
  })

  it('never rejects, even when fetch explodes', async () => {
    process.env.POSTHOG_KEY = 'phc_test'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const { captureFunnelEvent } = await freshServer()

    await expect(
      captureFunnelEvent({ event: FUNNEL_EVENTS.firstProgramAdded, distinctId: 'user-1' }),
    ).resolves.toBeUndefined()
  })
})
