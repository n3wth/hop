// Unit tests for lib/travel-history-sync.ts — the persistence/sync layer for
// the Gmail travel-history seam. Previously untested (only the pure parser and
// the gated-off read path had coverage). Locks in the staleness-detection fix:
// a dead/revoked refresh token (or an auth-failed Gmail list call) must be
// surfaced as a distinguishable failure (SyncResult) and stamped as
// `syncFailedAt` inside the existing `trips` jsonb — NOT silently swallowed
// into "0 trips synced" with the connection still reporting healthy. A
// transient, non-auth list failure is reported but deliberately NOT stamped,
// so it doesn't get conflated with a dead token and force a needless
// reconnect (see the `fetch-failed` test below).

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

const { syncTravelHistory, isGmailConnected, disconnectGmail } = await import('@/lib/travel-history-sync')

// --- Fake DB -------------------------------------------------------------------
// A minimal stand-in for the SupabaseCompat builder: enough chainable surface
// for select().eq().maybeSingle(), update().eq() and delete().eq() (awaited
// directly, mirroring the real thenable builder). `row` is mutated in place by
// update() so tests can assert on what actually got written.
//
// The update path DOES enforce one real filter — an `updated_at` .eq() — so
// tests can exercise markSyncFailed's optimistic-concurrency guard. Every
// other .eq() (e.g. user_id) stays a no-op passthrough, same as before.

interface Row {
  google_refresh_token?: string | null
  connected?: boolean
  google_email?: string | null
  trips?: unknown
  updated_at?: string
}

function makeDb(row: Row) {
  return {
    from: () => {
      const selectBuilder = {
        eq: () => selectBuilder,
        maybeSingle: async () => ({ data: { ...row }, error: null }),
      }
      return {
        select: () => selectBuilder,
        maybeSingle: selectBuilder.maybeSingle,
        update: (patch: Record<string, unknown>) => {
          let updatedAtGuard: unknown
          const updateBuilder = {
            eq: (col: string, val: unknown) => {
              if (col === 'updated_at') updatedAtGuard = val
              return updateBuilder
            },
            then: (onfulfilled?: (v: unknown) => unknown) => {
              if (updatedAtGuard === undefined || row.updated_at === updatedAtGuard) {
                Object.assign(row, patch)
              }
              const result = { error: null }
              return Promise.resolve(onfulfilled ? onfulfilled(result) : result)
            },
          }
          return updateBuilder
        },
        delete: () => {
          const deleteBuilder = {
            eq: () => deleteBuilder,
            then: (onfulfilled?: (v: unknown) => unknown) => {
              const result = { error: null }
              return Promise.resolve(onfulfilled ? onfulfilled(result) : result)
            },
          }
          return deleteBuilder
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

  it('reports fetch-failed WITHOUT stamping syncFailedAt on a non-auth list error (transient/5xx)', async () => {
    const row = setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: [], favoriteRegions: [] },
    })
    refreshAccessTokenMock.mockResolvedValue('access-1')
    listConfirmationMessageIdsMock.mockResolvedValue({ ok: false, authFailed: false })

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'fetch-failed' })
    // A transient failure must not be indistinguishable from a dead refresh
    // token in persisted state — otherwise a one-off network blip forces the
    // /account UI into "Reconnect needed" and hides the normal Sync button.
    expect(row.trips).toEqual({ trips: [], favoriteRegions: [] })
  })

  it('does not clobber a concurrently-completed fresh sync (updated_at guard)', async () => {
    const row = setupDb({
      google_refresh_token: 'refresh-1',
      trips: { trips: [{ destinationCity: 'Old' }], favoriteRegions: ['Asia'] },
      updated_at: 't0',
    })
    // Simulate a concurrent sync (e.g. a double-clicked resync) landing a
    // fresh result WHILE this attempt's token refresh is still in flight —
    // updated_at moves, and so does trips, before this attempt gets to write.
    refreshAccessTokenMock.mockImplementation(async () => {
      Object.assign(row, {
        trips: { trips: [{ destinationCity: 'Fresh' }], favoriteRegions: ['Europe'], syncFailedAt: null },
        updated_at: 't1',
      })
      return null // this attempt's own refresh still fails
    })

    const result = await syncTravelHistory('user-1')

    expect(result).toEqual({ ok: false, reason: 'auth-failed' })
    // The failure write must be a no-op here: the concurrently-written FRESH
    // trips survive untouched, not overwritten with this attempt's stale
    // pre-refresh snapshot.
    const stored = row.trips as { trips: unknown; favoriteRegions: unknown }
    expect(stored.trips).toEqual([{ destinationCity: 'Fresh' }])
    expect(stored.favoriteRegions).toEqual(['Europe'])
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

// --- disconnectGmail() ---------------------------------------------------------
// revokeToken is best-effort — the local row deletion must proceed either way
// — but a failed upstream revoke is worth logging (a token that stays valid at
// Google after the user "disconnected" locally).

describe('disconnectGmail() — revoke is logged, never blocks the local delete', () => {
  it('deletes the row and does not warn when the upstream revoke succeeds', async () => {
    setupDb({ google_refresh_token: 'refresh-1' })
    revokeTokenMock.mockResolvedValue(true)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const ok = await disconnectGmail('user-1')

    expect(ok).toBe(true)
    expect(revokeTokenMock).toHaveBeenCalledWith('refresh-1')
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('still deletes the row AND logs when the upstream revoke fails', async () => {
    setupDb({ google_refresh_token: 'refresh-1' })
    revokeTokenMock.mockResolvedValue(false)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const ok = await disconnectGmail('user-1')

    expect(ok).toBe(true)
    expect(warnSpy).toHaveBeenCalledTimes(1)
    warnSpy.mockRestore()
  })

  it('skips the revoke call (and any warning) when there was no stored token', async () => {
    setupDb({ google_refresh_token: null })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const ok = await disconnectGmail('user-1')

    expect(ok).toBe(true)
    expect(revokeTokenMock).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
