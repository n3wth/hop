// Unit tests for lib/travel-history-sync.ts — the persistence/sync layer for
// the Gmail travel-history seam. Previously untested (only the pure parser and
// the gated-off read path had coverage). Locks in the staleness-detection fix:
// a dead/revoked refresh token or a failed Gmail list call must be surfaced as
// a distinguishable failure (SyncResult) and stamped as `syncFailedAt` inside
// the existing `trips` jsonb — NOT silently swallowed into "0 trips synced"
// with the connection still reporting healthy.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks -------------------------------------------------------------------

const { withDbMock } = vi.hoisted(() => ({ withDbMock: vi.fn() }))
vi.mock('@/lib/supabase-helpers', () => ({ withDb: withDbMock }))

const {
  refreshAccessTokenMock,
  listConfirmationMessageIdsMock,
  getMessageMock,
  revokeTokenMock,
} = vi.hoisted(() => ({
  refreshAccessTokenMock: vi.fn(),
  listConfirmationMessageIdsMock: vi.fn(),
  getMessageMock: vi.fn(),
  revokeTokenMock: vi.fn(),
}))

vi.mock('@/lib/gmail', () => ({
  refreshAccessToken: refreshAccessTokenMock,
  listConfirmationMessageIds: listConfirmationMessageIdsMock,
  getMessage: getMessageMock,
  revokeToken: revokeTokenMock,
}))

const { parseMessagesMock, deriveFavoriteRegionsMock } = vi.hoisted(() => ({
  parseMessagesMock: vi.fn(),
  deriveFavoriteRegionsMock: vi.fn(),
}))

vi.mock('@/lib/gmail-parser', () => ({
  parseMessages: parseMessagesMock,
  deriveFavoriteRegions: deriveFavoriteRegionsMock,
}))

const { syncTravelHistory, isGmailConnected } = await import('@/lib/travel-history-sync')

// --- Fake DB -------------------------------------------------------------------
// A minimal stand-in for the SupabaseCompat builder: enough chainable surface
// for select().eq().maybeSingle() and update().eq() (awaited directly, mirroring
// the real thenable builder). `row` is mutated in place by update() so tests can
// assert on what actually got written.

interface Row {
  google_refresh_token?: string | null
  connected?: boolean
  google_email?: string | null
  trips?: unknown
}

function makeDb(row: Row) {
  return {
    from: () => {
      const selectBuilder = {
        eq: () => selectBuilder,
        maybeSingle: async () => ({ data: { ...row }, error: null }),
      }
      const updateBuilder = {
        eq: () => updateBuilder,
        then: (onfulfilled?: (v: unknown) => unknown) => {
          const result = { error: null }
          return Promise.resolve(onfulfilled ? onfulfilled(result) : result)
        },
      }
      return {
        select: () => selectBuilder,
        maybeSingle: selectBuilder.maybeSingle,
        update: (patch: Record<string, unknown>) => {
          Object.assign(row, patch)
          return updateBuilder
        },
      }
    },
  }
}

function setupDb(row: Row) {
  withDbMock.mockImplementation(async (fallback: unknown, fn: (db: unknown) => Promise<unknown>) => {
    try {
      return await fn(makeDb(row))
    } catch {
      return fallback
    }
  })
  return row
}

beforeEach(() => {
  vi.clearAllMocks()
})

// --- syncTravelHistory() ------------------------------------------------------

describe('syncTravelHistory() — failure paths are distinguishable, never silent', () => {
  it('reports not-connected when there is no stored refresh token', async () => {
    setupDb({ google_refresh_token: null, trips: {} })

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'not-connected' })
    expect(refreshAccessTokenMock).not.toHaveBeenCalled()
  })

  it('marks sync failed and preserves prior trips when the refresh token is dead', async () => {
    const priorTrips = [{ destinationCity: 'Tokyo', month: '2024-02' }]
    const row = setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: priorTrips, favoriteRegions: ['Asia'] },
    })
    refreshAccessTokenMock.mockResolvedValue(null)

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'auth-failed' })
    expect(listConfirmationMessageIdsMock).not.toHaveBeenCalled()
    const stored = row.trips as { trips: unknown; favoriteRegions: unknown; syncFailedAt: string }
    // The previously-synced trips must survive a failed sync untouched.
    expect(stored.trips).toEqual(priorTrips)
    expect(stored.favoriteRegions).toEqual(['Asia'])
    expect(typeof stored.syncFailedAt).toBe('string')
  })

  it('marks sync failed with auth-failed when the Gmail list call 401s', async () => {
    const row = setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: [], favoriteRegions: [] },
    })
    refreshAccessTokenMock.mockResolvedValue('access-1')
    listConfirmationMessageIdsMock.mockResolvedValue({ ok: false, authFailed: true })

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'auth-failed' })
    const stored = row.trips as { syncFailedAt: string }
    expect(typeof stored.syncFailedAt).toBe('string')
  })

  it('marks sync failed with fetch-failed on a non-auth list error (transient/5xx)', async () => {
    setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: [], favoriteRegions: [] },
    })
    refreshAccessTokenMock.mockResolvedValue('access-1')
    listConfirmationMessageIdsMock.mockResolvedValue({ ok: false, authFailed: false })

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'fetch-failed' })
  })

  it('on success, stores fresh trips and clears any prior syncFailedAt', async () => {
    const row = setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: [], favoriteRegions: [], syncFailedAt: '2026-06-01T00:00:00.000Z' },
    })
    refreshAccessTokenMock.mockResolvedValue('access-1')
    listConfirmationMessageIdsMock.mockResolvedValue({ ok: true, ids: ['m1'] })
    getMessageMock.mockResolvedValue({
      id: 'm1',
      subject: 'Your trip confirmation',
      from: 'united.com',
      internalDate: 0,
      body: '',
    })
    const trips = [{ destinationCity: 'Tokyo', month: '2024-02' }]
    parseMessagesMock.mockReturnValue(trips)
    deriveFavoriteRegionsMock.mockReturnValue(['Asia'])

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: true, count: 1 })
    const stored = row.trips as { trips: unknown; favoriteRegions: unknown; syncFailedAt: null }
    expect(stored.trips).toEqual(trips)
    expect(stored.favoriteRegions).toEqual(['Asia'])
    expect(stored.syncFailedAt).toBeNull()
  })
})

// --- isGmailConnected() --------------------------------------------------------

describe('isGmailConnected() — surfaces syncFailed instead of an eternal "Connected"', () => {
  it('reports not connected when the row has no connection', async () => {
    setupDb({ connected: false })

    const result = await isGmailConnected('user-1')

    expect(result).toEqual({ connected: false, email: null, syncFailed: false })
  })

  it('reports connected with syncFailed:false when nothing has failed', async () => {
    setupDb({
      connected: true,
      google_email: 'me@gmail.com',
      trips: { trips: [], favoriteRegions: [] },
    })

    const result = await isGmailConnected('user-1')

    expect(result).toEqual({ connected: true, email: 'me@gmail.com', syncFailed: false })
  })

  it('reports syncFailed:true when the row carries a syncFailedAt stamp', async () => {
    setupDb({
      connected: true,
      google_email: 'me@gmail.com',
      trips: { trips: [], favoriteRegions: [], syncFailedAt: '2026-07-05T00:00:00.000Z' },
    })

    const result = await isGmailConnected('user-1')

    expect(result).toEqual({ connected: true, email: 'me@gmail.com', syncFailed: true })
  })
})
