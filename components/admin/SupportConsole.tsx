'use client'

import { useState, type ReactNode } from 'react'
import type { SupportTicket } from '@/lib/support-tickets'
import type { Escalation } from '@/lib/escalation'

// The owner-gated support console: inbound support tickets (each with its AI draft,
// editable before sending) + expert-booking leads. Flat-editorial, internal tool.
export default function SupportConsole({
  tickets,
  escalations,
}: {
  tickets: SupportTicket[]
  escalations: Escalation[]
}) {
  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">Inbox</h1>
      <p className="mt-1 text-[13px] text-text3">
        {tickets.length} ticket{tickets.length === 1 ? '' : 's'} · {escalations.length} booking
        request{escalations.length === 1 ? '' : 's'} · inbound via Resend, replies drafted by the
        support agent for your review
      </p>

      {/* Wide screens: tickets beside booking requests; below lg they stack. */}
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <section className="mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">Tickets</h2>
          <div className="mt-3 flex flex-col gap-3">
            {tickets.length === 0 ? (
              <Empty>No support emails yet.</Empty>
            ) : (
              tickets.map((t) => <TicketCard key={t.id} ticket={t} />)
            )}
          </div>
        </section>

        <section className="mt-10 lg:mt-8">
          <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
            Booking requests
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {escalations.length === 0 ? (
              <Empty>No expert-booking requests yet.</Empty>
            ) : (
              escalations.map((e) => <EscalationCard key={e.id} esc={e} />)
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const [reply, setReply] = useState(ticket.draftReply ?? '')
  const [state, setState] = useState<SendState>(ticket.status === 'replied' ? 'sent' : 'idle')
  const [err, setErr] = useState('')

  const send = async () => {
    const text = reply.trim()
    if (!text || state === 'sending') return
    setState('sending')
    setErr('')
    try {
      const res = await fetch('/api/admin/support/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ticketId: ticket.id, replyText: text }),
      })
      const j = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string }
      if (j.ok) setState('sent')
      else {
        setState('error')
        setErr(j.error === 'unconfigured' ? 'email not configured (set RESEND_API_KEY)' : j.error || 'send failed')
      }
    } catch {
      setState('error')
      setErr('network error')
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-semibold text-text">{ticket.fromEmail}</span>
        <span className="flex-shrink-0 text-[11.5px] text-text3">{fmtDate(ticket.createdAt)}</span>
      </div>
      <div className="mt-0.5 text-[13px] text-text2">{ticket.subject || '(no subject)'}</div>
      {ticket.body ? (
        <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-[13px] leading-[1.5] text-text2">
          {ticket.body}
        </p>
      ) : null}

      {state === 'sent' ? (
        <div className="mt-3 rounded-[10px] border border-good-bg bg-good-bg/50 px-3 py-2 text-[12.5px] text-good">
          Replied{ticket.replyText ? ` · "${truncate(ticket.replyText, 140)}"` : ''}.
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={5}
            placeholder="Write a reply…"
            className="no-inner-ring w-full resize-y rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] leading-[1.5] text-text outline-none transition-colors focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={send}
              disabled={state === 'sending' || !reply.trim()}
              className="rounded-full bg-brand px-3.5 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {state === 'sending' ? 'Sending…' : 'Send reply'}
            </button>
            {ticket.draftReply ? (
              <span className="text-[11.5px] text-text3">AI draft loaded — edit before sending</span>
            ) : null}
            {state === 'error' ? <span className="text-[11.5px] text-warn">{err}</span> : null}
          </div>
        </div>
      )}
    </div>
  )
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const entries = Object.entries(esc.trip ?? {}).filter(([, v]) => v != null)
  return (
    <div className="rounded-[14px] border border-border bg-paper p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-semibold text-text">{esc.email}</span>
        <span className="flex-shrink-0 text-[11.5px] text-text3">{fmtDate(esc.createdAt)}</span>
      </div>
      {entries.length ? (
        <div className="mt-2 flex flex-col gap-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[13px]">
              <span className="min-w-[84px] flex-shrink-0 text-text3">{k}</span>
              <span className="text-text2">{String(v)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-text3">No extra context.</p>
      )}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-border bg-paper/50 px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return ''
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}
