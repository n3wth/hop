import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock posthog-js at the module boundary — the seam under test is OUR wiring
// (gating, init options, once-only boot), not the SDK.
const { initSpy, captureSpy, identifySpy } = vi.hoisted(() => ({
  initSpy: vi.fn(),
  captureSpy: vi.fn(),
  identifySpy: vi.fn(),
}))

vi.mock('posthog-js', () => ({
  default: { init: initSpy, capture: captureSpy, identify: identifySpy },
}))

// Fresh module instance per test — the client memoizes `booted`.
async function freshClient() {
  vi.resetModules()
  return await import('@/lib/posthog-client')
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST
})

afterEach(() => {
  delete process.env.NEXT_PUBLIC_POSTHOG_KEY
  delete process.env.NEXT_PUBLIC_POSTHOG_HOST
})

describe('posthog-client', () => {
  it('no NEXT_PUBLIC_POSTHOG_KEY → boot/track/identify are complete no-ops', async () => {
    const { bootAnalytics, track, identifyUser } = await freshClient()

    bootAnalytics()
    track('search_ran', { origin: 'SFO' })
    identifyUser('user-1')

    expect(initSpy).not.toHaveBeenCalled()
    expect(captureSpy).not.toHaveBeenCalled()
    expect(identifySpy).not.toHaveBeenCalled()
  })

  it('key → boots once with proxy-ready options and captures', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    const { bootAnalytics, track } = await freshClient()

    bootAnalytics()
    bootAnalytics()
    track('search_ran', { origin: 'SFO', destination: 'NRT' })

    expect(initSpy).toHaveBeenCalledTimes(1)
    expect(initSpy.mock.calls[0][0]).toBe('phc_test')
    expect(initSpy.mock.calls[0][1]).toMatchObject({
      autocapture: false,
      capture_pageview: 'history_change',
      // Proxy-ready: ui_host must point at PostHog proper so app/toolbar
      // links resolve even when api_host is the reverse proxy; defaults pins
      // the SDK's config-defaults snapshot across upgrades.
      ui_host: 'https://us.posthog.com',
      defaults: '2026-05-30',
      person_profiles: 'identified_only',
    })
    expect(captureSpy).toHaveBeenCalledWith('search_ran', { origin: 'SFO', destination: 'NRT' })
  })

  it('NEXT_PUBLIC_POSTHOG_HOST routes api_host through the reverse proxy', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://elephant.hop.flights'
    const { bootAnalytics } = await freshClient()

    bootAnalytics()

    expect(initSpy.mock.calls[0][1]).toMatchObject({
      api_host: 'https://elephant.hop.flights',
      ui_host: 'https://us.posthog.com',
    })
  })

  it('never throws to the page, even when posthog-js init explodes', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'phc_test'
    initSpy.mockImplementation(() => {
      throw new Error('boom')
    })
    const { bootAnalytics, track, identifyUser } = await freshClient()

    expect(() => bootAnalytics()).not.toThrow()
    expect(() => track('search_ran', {})).not.toThrow()
    expect(() => identifyUser('user-1')).not.toThrow()
  })
})
