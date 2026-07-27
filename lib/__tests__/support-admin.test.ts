import { describe, it, expect } from 'vitest'
import { isOwner, getOwnerSession } from '@/lib/owner'
import {
  markReplied,
  listRecentTickets,
  getSupportTicket,
  setTicketStatus,
} from '@/lib/support-tickets'
import { listRecentEscalations, setEscalationStatus } from '@/lib/escalation'
import {
  closeSupportTicket,
  reopenSupportTicket,
  updateEscalationStatus,
} from '@/app/actions/admin'

// The owner gate must be CLOSED by default (no session in the test env → not the
// owner), and every admin read/write degrades gracefully, never throwing. List
// reads are honest about failure: an unconfigured db resolves null ("unknown"),
// never [] ("empty") — mirroring lib/cron-heartbeat.ts#listHeartbeats.

describe('owner gate — closed by default', () => {
  it('isOwner() is false and getOwnerSession() is null with no session (never throws)', async () => {
    await expect(isOwner()).resolves.toBe(false)
    await expect(getOwnerSession()).resolves.toBeNull()
  })
})

describe('support-tickets admin reads/writes — graceful', () => {
  it('listRecentTickets returns null (not []) when the db is unconfigured', async () => {
    await expect(listRecentTickets()).resolves.toBeNull()
  })

  it('getSupportTicket returns null for empty id / unconfigured', async () => {
    await expect(getSupportTicket('')).resolves.toBeNull()
    await expect(getSupportTicket('some-id')).resolves.toBeNull()
  })

  it('markReplied returns false for empty id / unconfigured', async () => {
    await expect(markReplied('', 'hi')).resolves.toBe(false)
    await expect(markReplied('some-id', 'hi')).resolves.toBe(false)
  })

  it('setTicketStatus returns false for empty id / bad status / unconfigured', async () => {
    await expect(setTicketStatus('', 'closed')).resolves.toBe(false)
    // @ts-expect-error — exercising a bad runtime status on purpose.
    await expect(setTicketStatus('some-id', 'replied')).resolves.toBe(false)
    await expect(setTicketStatus('some-id', 'closed')).resolves.toBe(false)
    await expect(setTicketStatus('some-id', 'open')).resolves.toBe(false)
  })

  it('listRecentEscalations returns null (not []) when the db is unconfigured', async () => {
    await expect(listRecentEscalations()).resolves.toBeNull()
  })

  it('setEscalationStatus returns false for empty id / bad status / unconfigured', async () => {
    await expect(setEscalationStatus('', 'done')).resolves.toBe(false)
    // @ts-expect-error — exercising a bad runtime status on purpose.
    await expect(setEscalationStatus('some-id', 'contacted')).resolves.toBe(false)
    await expect(setEscalationStatus('some-id', 'done')).resolves.toBe(false)
    await expect(setEscalationStatus('some-id', 'new')).resolves.toBe(false)
  })
})

describe('admin lifecycle server actions — gated, never throw', () => {
  it('closeSupportTicket refuses without an owner session', async () => {
    await expect(closeSupportTicket('some-id')).resolves.toEqual({
      ok: false,
      error: 'Not authorized',
    })
  })

  it('reopenSupportTicket refuses without an owner session', async () => {
    await expect(reopenSupportTicket('some-id')).resolves.toEqual({
      ok: false,
      error: 'Not authorized',
    })
  })

  it('updateEscalationStatus refuses without an owner session', async () => {
    await expect(updateEscalationStatus('some-id', 'done')).resolves.toEqual({
      ok: false,
      error: 'Not authorized',
    })
    // Bad input is still refused at the gate — no session leaks past validation.
    await expect(updateEscalationStatus('some-id', 'nonsense')).resolves.toEqual({
      ok: false,
      error: 'Not authorized',
    })
  })
})
