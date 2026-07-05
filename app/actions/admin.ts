'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerSession } from '@/lib/owner'
import { setTicketStatus } from '@/lib/support-tickets'
import {
  setEscalationStatus,
  ESCALATION_STATUSES,
  type EscalationStatus,
} from '@/lib/escalation'
import {
  createSweetSpotDraft,
  updateSweetSpotDraftWhy,
  setSweetSpotDraftStatus,
  draftSweetSpotWhy,
  DRAFT_STATUSES,
  type DraftStatus,
  type SweetSpotDraftInput,
} from '@/lib/sweet-spot-drafts'

// Server Actions for the owner-only admin surfaces: the support console
// (close/reopen a ticket, flip an escalation's status) and the sweet-spot
// content review queue (draft/edit/approve/reject). Every action is gated by
// the owner session (lib/owner) — anyone else gets {ok:false} (the
// 403-equivalent for an action), never data. Returns a simple result for the
// client; never throws.

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

// Revalidate the surfaces a sweet-spot draft affects: the review queue, the
// program's guide page, and the /sweet-spots index (redemption counts).
function revalidateSweetSpots(programSlug: string): void {
  revalidatePath('/admin/content')
  revalidatePath('/sweet-spots')
  revalidatePath(`/sweet-spots/${programSlug}`)
}

type DraftResult = Result & { id?: string }
type WhyResult = Result & { why?: string }

export async function createSweetSpotDraftAction(
  input: Omit<SweetSpotDraftInput, 'createdBy'>,
): Promise<DraftResult> {
  const owner = await getOwnerSession()
  if (!owner) return NOT_AUTHORIZED
  const id = await createSweetSpotDraft({ ...input, createdBy: owner.email })
  if (!id) return { ok: false, error: "Couldn't save — check the fields and try again" }
  revalidatePath('/admin/content')
  return { ok: true, id }
}

// Ask the AI gateway to draft the "why" copy from the given facts. Returns the
// text for the form to show (editable) — does NOT persist it; the owner saves
// via updateSweetSpotDraftWhyAction once they're happy with it.
export async function draftSweetSpotWhyAction(facts: {
  route: string
  program: string
  metal?: string
  cabin: string
  milesLabel: string
  milesOw?: number
  notes?: string
}): Promise<WhyResult> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  const why = await draftSweetSpotWhy(facts)
  if (!why) return { ok: false, error: "Couldn't draft copy — write it by hand instead" }
  return { ok: true, why }
}

export async function updateSweetSpotDraftWhyAction(id: string, why: string): Promise<Result> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'Missing draft' }
  const ok = await updateSweetSpotDraftWhy(id.trim(), why)
  if (!ok) return { ok: false, error: "Couldn't save — try again" }
  revalidatePath('/admin/content')
  return { ok: true }
}

// Approve/reject/reset a draft. programSlug comes from the client's own copy
// of the draft (avoids an extra read here) purely to know which /sweet-spots
// page to revalidate.
export async function setSweetSpotDraftStatusAction(
  id: string,
  status: string,
  programSlug: string,
): Promise<Result> {
  if (!(await getOwnerSession())) return NOT_AUTHORIZED
  if (typeof id !== 'string' || !id.trim()) return { ok: false, error: 'Missing draft' }
  if (!DRAFT_STATUSES.includes(status as DraftStatus)) return { ok: false, error: 'Bad status' }
  const ok = await setSweetSpotDraftStatus(id.trim(), status as DraftStatus)
  if (!ok) return { ok: false, error: "Couldn't update — try again" }
  if (typeof programSlug === 'string' && programSlug.trim()) {
    revalidateSweetSpots(programSlug.trim())
  } else {
    revalidatePath('/admin/content')
  }
  return { ok: true }
}
