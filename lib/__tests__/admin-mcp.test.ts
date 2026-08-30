import { describe, expect, it } from 'vitest'
import { attachCallerEmails } from '@/lib/admin-mcp'

// attachCallerEmails is the pure half of listTopMcpCallers — the DB read
// (grouping by user_id, then a batch email lookup) can't run without a live
// db, but the join + ranking logic it feeds is plain data transformation and
// fully testable with fixture rows, no mocks.
describe('attachCallerEmails', () => {
  it('resolves emails for known user ids and ranks by call count desc', () => {
    const rows = attachCallerEmails(
      [
        { userId: 'u1', callCount: 3, lastCallAt: '2026-07-01T00:00:00.000Z' },
        { userId: 'u2', callCount: 9, lastCallAt: '2026-07-02T00:00:00.000Z' },
      ],
      new Map([
        ['u1', 'a@example.com'],
        ['u2', 'b@example.com'],
      ]),
    )
    expect(rows.map((r) => r.email)).toEqual(['b@example.com', 'a@example.com'])
    expect(rows[0].callCount).toBe(9)
  })

  it('rolls a null userId up into one unlinked row with a null email', () => {
    const rows = attachCallerEmails(
      [{ userId: null, callCount: 5, lastCallAt: '2026-07-01T00:00:00.000Z' }],
      new Map(),
    )
    expect(rows).toEqual([{ userId: null, email: null, callCount: 5, lastCallAt: '2026-07-01T00:00:00.000Z' }])
  })

  it('a user id missing from the email map still surfaces (email null, not dropped)', () => {
    const rows = attachCallerEmails(
      [{ userId: 'ghost', callCount: 1, lastCallAt: null }],
      new Map(),
    )
    expect(rows).toEqual([{ userId: 'ghost', email: null, callCount: 1, lastCallAt: null }])
  })

  it('empty input yields an empty list', () => {
    expect(attachCallerEmails([], new Map())).toEqual([])
  })
})
