import { describe, it, expect } from 'vitest'
import { isOwner, getOwnerSession } from '@/lib/owner'
import { markReplied, listRecentTickets, getSupportTicket } from '@/lib/support-tickets'
import { listRecentEscalations } from '@/lib/escalation'

// The owner gate must be CLOSED by default (no session in the test env → not the
// owner), and every admin read/write degrades gracefully (no db configured → empty
// / false), never throwing.

describe('owner gate — closed by default', () => {
  it('isOwner() is false and getOwnerSession() is null with no session (never throws)', async () => {
    await expect(isOwner()).resolves.toBe(false)
    await expect(getOwnerSession()).resolves.toBeNull()
  })
})

describe('support-tickets admin reads/writes — graceful', () => {
  it('listRecentTickets returns [] when the db is unconfigured', async () => {
    await expect(listRecentTickets()).resolves.toEqual([])
  })

  it('getSupportTicket returns null for empty id / unconfigured', async () => {
    await expect(getSupportTicket('')).resolves.toBeNull()
    await expect(getSupportTicket('some-id')).resolves.toBeNull()
  })

  it('markReplied returns false for empty id / unconfigured', async () => {
    await expect(markReplied('', 'hi')).resolves.toBe(false)
    await expect(markReplied('some-id', 'hi')).resolves.toBe(false)
  })

  it('listRecentEscalations returns [] when the db is unconfigured', async () => {
    await expect(listRecentEscalations()).resolves.toEqual([])
  })
})
