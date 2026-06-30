// AI-drafted support replies — Phase 2 of the support inbox.
//
// When a support email lands (lib/support-tickets, via /api/support-ingest), we
// draft a reply for a HUMAN to review and send. The draft is grounded in GENERAL
// hop knowledge only — NEVER the sender's account data:
//   • email From is spoofable, so exposing a user's balances/bookings to whoever
//     claims their address would be a data leak; and
//   • hop keys users by Auth0 sub, not email, so there's no safe email->account map.
// So the draft answers how hop works and asks the user to sign in for account
// specifics. It's a suggestion, never auto-sent, and makes no commitments.
//
// Gated on the AI gateway key (callGatewayText returns null without it) and NEVER
// throws — no draft simply means the human writes the reply themselves.

import { callGatewayText } from '@/lib/ai-gateway'

export interface SupportTicketContext {
  from: string
  subject?: string | null
  body?: string | null
}

const SYSTEM = [
  "You are hop's support assistant, drafting a reply to an inbound support email.",
  'About hop: a points-vs-cash flight optimizer. It reads a user\'s loyalty balances and computes live cents-per-point (cpp) to tell them whether to book with points, transfer to a partner, or pay cash. Surfaces: /search (the verdict), /deals, /ask (an AI travel concierge), proactive award-space alerts, and an MCP server ("Add to Claude"). The site is hop.flights.',
  "Write the reply in hop's voice: warm, concise, plain, confident. State the answer. No marketing slop, no clichés, no emoji.",
  'HARD RULES:',
  '- This is a DRAFT a human will review before sending. Make NO commitments (no refunds, bookings, dates, prices, or promises).',
  '- You do NOT have this person\'s account, and email senders can be spoofed — NEVER state or imply their balances, bookings, or any account specifics. For anything account-specific, ask them to sign in at hop.flights or describe the issue and say a human will check.',
  '- Never invent fares, award availability, or any hard number. Speak generally about how hop works.',
  '- If you genuinely can\'t help from general knowledge, keep it short and say a human will follow up.',
  '- Output ONLY the reply body — no subject line, no "Draft:", no greeting placeholder like [Name]. You may end with "— hop".',
].join('\n')

// Draft a support reply for the given inbound email. Returns the draft text, or
// null when the gateway is unconfigured / the call fails / there's nothing to
// answer. NEVER throws.
export async function draftSupportReply(ticket: SupportTicketContext): Promise<string | null> {
  const subject = (ticket.subject ?? '').slice(0, 300).trim()
  const body = (ticket.body ?? '').slice(0, 4000).trim()
  if (!subject && !body) return null
  const user = `Inbound support email.\nSubject: ${subject || '(none)'}\n\nMessage:\n${body || '(no body)'}\n\nWrite the reply body only.`
  const text = await callGatewayText({ system: SYSTEM, user, maxTokens: 600 })
  return text ? text.slice(0, 4000) : null
}
