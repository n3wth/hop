// POST /api/admin/support/send — OWNER-ONLY. Sends a (human-reviewed, possibly
// edited) reply to a support ticket's sender from support@hop.flights, threaded to
// the original inbound message, and marks the ticket replied.
//
// Gated by the owner session (lib/owner) — 403 for anyone else. The reply text is
// whatever the owner approved in the console (the AI draft, edited or not). NEVER
// 500s; a send failure reports a soft error so the console can surface it.

import { getOwnerSession } from '@/lib/owner'
import { getSupportTicket, markReplied } from '@/lib/support-tickets'
import { sendSupportReply } from '@/lib/email'

export const runtime = 'nodejs'

interface SendBody {
  ticketId?: unknown
  replyText?: unknown
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!(await getOwnerSession())) return json({ ok: false, error: 'forbidden' }, 403)

  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return json({ ok: false, error: 'bad json' }, 400)
  }

  const ticketId = typeof body?.ticketId === 'string' ? body.ticketId : ''
  const replyText = typeof body?.replyText === 'string' ? body.replyText.trim() : ''
  if (!ticketId) return json({ ok: false, error: 'missing ticketId' }, 400)
  if (!replyText) return json({ ok: false, error: 'empty reply' }, 400)

  const ticket = await getSupportTicket(ticketId)
  if (!ticket) return json({ ok: false, error: 'ticket not found' }, 404)

  const subject = ticket.subject?.trim()
    ? `Re: ${ticket.subject.trim().replace(/^re:\s*/i, '')}`
    : 'Re: your message to hop'

  const res = await sendSupportReply(ticket.fromEmail, subject, replyText, {
    inReplyTo: ticket.messageId,
  })
  if (!res.ok) {
    // 'unconfigured' (no RESEND key) vs a real send failure — surface to the console.
    return json({ ok: false, error: res.reason }, res.reason === 'unconfigured' ? 503 : 502)
  }

  await markReplied(ticketId, replyText)
  return json({ ok: true, id: res.id })
}
