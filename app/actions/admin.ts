'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerSession } from '@/lib/owner'
import { setTicketStatus } from '@/lib/support-tickets'
import {
  setEscalationStatus,
  ESCALATION_STATUSES,
  type EscalationStatus,
} from '@/lib/escalation'

// Server Actions for the owner-only support console lifecycle: close/reopen a
// ticket, flip an escalation's status. Every action is gated by the owner
// session (lib/owner) — anyone else gets {ok:false} (the 403-equivalent for an
// action), never data. Returns a simple result for the client; never throws.

type Result = { ok: boolean; error?: string }

const NOT_AUTHORIZED: Result = { ok: false, error: 'Not authorized' }

// Revalidate the surfaces that render tickets/escalations so the change shows
// on next paint.
function revalidateAdmin(): void {
  revalidatePath('/admin/support')
  revalidatePath('/admin')
}

export async function closeSupportTicket(id: string): Promise<Result> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'Missing ticket' }
  const ok = await setTicketStatus(id.trim(), 'closed')
  if (!ok) return { ok: false, error: "Couldn't update — try again" }
  revalidateAdmin()
  return { ok: true }
}

export async function reopenSupportTicket(id: string): Promise<Result> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'Missing ticket' }
  const ok = await setTicketStatus(id.trim(), 'open')
  if (!ok) return { ok: false, error: "Couldn't update — try again" }
  revalidateAdmin()
  return { ok: true }
}

export async function updateEscalationStatus(id: string, status: string): Promise<Result> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'Missing request' }
  if (!ESCALATION_STATUSES.includes(status as EscalationStatus)) {
    return { ok: false, error: 'Bad status' }
  }
  const ok = await setEscalationStatus(id.trim(), status as EscalationStatus)
  if (!ok) return { ok: false, error: "Couldn't update — try again" }
  revalidateAdmin()
  return { ok: true }
}
