'use client'

import { useState, type ReactNode } from 'react'
import AdminPageHeader, { AdminPageShell } from '@/components/admin/AdminPageHeader'
import Card from '@/components/ui/Card'
import Eyebrow from '@/components/ui/Eyebrow'
import type { SupportTicket } from '@/lib/support-tickets'
import type { Escalation, EscalationStatus } from '@/lib/escalation'
import {
  closeSupportTicket,
  reopenSupportTicket,
  updateEscalationStatus,
} from '@/app/actions/admin'

// The owner-gated support console: inbound support tickets (each with its AI draft,
// editable before sending) + expert-booking leads. Lists are null when the db read
// failed — rendered as "unavailable", never as empty. Flat-editorial, internal tool.
type ListFilter = 'open' | 'closed'

export default function SupportConsole({
  tickets,
  escalations,
}: {
  tickets: SupportTicket[] | null
  escalations: Escalation[] | null
}) {
  const [ticketFilter, setTicketFilter] = useState<ListFilter>('open')
  const [escalationFilter, setEscalationFilter] = useState<ListFilter>('open')

  const openTicketCount = tickets?.filter((t) => t.status !== 'closed').length ?? 0
  const closedTicketCount = tickets ? tickets.length - openTicketCount : 0
  const visibleTickets =
    tickets?.filter((t) => (ticketFilter === 'closed') === (t.status === 'closed')) ?? null

  const openEscalationCount = escalations?.filter((e) => e.status !== 'done').length ?? 0
  const doneEscalationCount = escalations ? escalations.length - openEscalationCount : 0
  const visibleEscalations =
    escalations?.filter((e) => (escalationFilter === 'closed') === (e.status === 'done')) ?? null

  return (
    <AdminPageShell>
      <AdminPageHeader
        title="Inbox"
        description={
          <>
            {tickets === null
              ? 'tickets unavailable'
              : `${tickets.length} ticket${tickets.length === 1 ? '' : 's'}`}{' '}
            ·{' '}
            {escalations === null
              ? 'booking requests unavailable'
              : `${escalations.length} booking request${escalations.length === 1 ? '' : 's'}`}{' '}
            · inbound via Resend, replies drafted by the support agent for your review
          </>
        }
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Inbox' },
        ]}
      />

      {/* Wide screens: tickets beside booking requests; below lg they stack. */}
      <div className="mt-8 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow as="h2" className="font-bold text-brand">Tickets</Eyebrow>
            {tickets !== null && tickets.length > 0 ? (
              <ListFilterToggle
                value={ticketFilter}
                onChange={setTicketFilter}
                openCount={openTicketCount}
                closedCount={closedTicketCount}
                closedLabel="Closed"
              />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {tickets === null ? (
              <Empty>Tickets unavailable.</Empty>
            ) : tickets.length === 0 ? (
              <Empty>No support emails yet.</Empty>
            ) : visibleTickets && visibleTickets.length === 0 ? (
              <Empty>No {ticketFilter} tickets.</Empty>
            ) : (
              visibleTickets?.map((t) => <TicketCard key={t.id} ticket={t} />)
            )}
          </div>
        </section>

        <section className="mt-10 lg:mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <Eyebrow as="h2" className="font-bold text-brand">
              Booking requests
            </Eyebrow>
            {escalations !== null && escalations.length > 0 ? (
              <ListFilterToggle
                value={escalationFilter}
                onChange={setEscalationFilter}
                openCount={openEscalationCount}
                closedCount={doneEscalationCount}
                closedLabel="Done"
              />
            ) : null}
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {escalations === null ? (
              <Empty>Booking requests unavailable.</Empty>
            ) : escalations.length === 0 ? (
              <Empty>No expert-booking requests yet.</Empty>
            ) : visibleEscalations && visibleEscalations.length === 0 ? (
              <Empty>No {escalationFilter === 'closed' ? 'done' : 'open'} booking requests.</Empty>
            ) : (
              visibleEscalations?.map((e) => <EscalationCard key={e.id} esc={e} />)
            )}
          </div>
        </section>
      </div>
    </AdminPageShell>
  )
}

// "Show only" filter — defaults to open so a growing backlog of closed/done
// items never buries what still needs the owner's attention.
function ListFilterToggle({
  value,
  onChange,
  openCount,
  closedCount,
  closedLabel,
}: {
  value: ListFilter
  onChange: (next: ListFilter) => void
  openCount: number
  closedCount: number
  closedLabel: string
}) {
  return (
    <div className="flex flex-shrink-0 gap-1 rounded-full border border-border bg-surface p-0.5">
      <FilterPill active={value === 'open'} onClick={() => onChange('open')}>
        Open · {openCount}
      </FilterPill>
      <FilterPill active={value === 'closed'} onClick={() => onChange('closed')}>
        {closedLabel} · {closedCount}
      </FilterPill>
    </div>
  )
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
        active ? 'bg-brand text-white' : 'text-text3 hover:text-text2'
      }`}
    >
      {children}
    </button>
  )
}

type SendState = 'idle' | 'sending' | 'sent' | 'error'

const GHOST_BTN =
  'rounded-full border border-border px-3 py-1 text-[12px] font-medium text-text2 transition-colors hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-50'

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const [reply, setReply] = useState(ticket.draftReply ?? '')
  const [state, setState] = useState<SendState>(ticket.status === 'replied' ? 'sent' : 'idle')
  const [err, setErr] = useState('')
  const [status, setStatus] = useState(ticket.status)
  const [statusPending, setStatusPending] = useState(false)
  const [statusErr, setStatusErr] = useState('')
  const closed = status === 'closed'

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

  const setLifecycle = async (next: 'open' | 'closed') => {
    if (statusPending) return
    setStatusPending(true)
    setStatusErr('')
    try {
      const res = next === 'closed' ? await closeSupportTicket(ticket.id) : await reopenSupportTicket(ticket.id)
      if (res.ok) setStatus(next)
      else setStatusErr(res.error || 'update failed')
    } catch {
      setStatusErr('network error')
    }
    setStatusPending(false)
  }

  const closeButton = (
    <button
      type="button"
      onClick={() => setLifecycle('closed')}
      disabled={statusPending}
      className={GHOST_BTN}
    >
      {statusPending ? 'Closing…' : 'Close'}
    </button>
  )

  return (
    <Card surface="paper" radius="md" className="p-4">
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

      {closed ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[12.5px] text-text3">Closed.</span>
          <button
            type="button"
            onClick={() => setLifecycle('open')}
            disabled={statusPending}
            className={GHOST_BTN}
          >
            {statusPending ? 'Reopening…' : 'Reopen'}
          </button>
          {statusErr ? <span className="text-[11.5px] text-weak">{statusErr}</span> : null}
        </div>
      ) : state === 'sent' ? (
        <>
          <div className="mt-3 rounded-[10px] border border-good-bg bg-good-bg/50 px-3 py-2 text-[12.5px] text-good">
            Replied{ticket.replyText ? ` · "${truncate(ticket.replyText, 140)}"` : ''}.
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {closeButton}
            {statusErr ? <span className="text-[11.5px] text-weak">{statusErr}</span> : null}
          </div>
        </>
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
            {closeButton}
            {ticket.draftReply ? (
              <span className="text-[11.5px] text-text3">AI draft loaded — edit before sending</span>
            ) : null}
            {state === 'error' ? <span className="text-[11.5px] text-warn">{err}</span> : null}
            {statusErr ? <span className="text-[11.5px] text-weak">{statusErr}</span> : null}
          </div>
        </div>
      )}
    </Card>
  )
}

function EscalationCard({ esc }: { esc: Escalation }) {
  const entries = Object.entries(esc.trip ?? {}).filter(([, v]) => v != null)
  const [status, setStatus] = useState(esc.status)
  const [pending, setPending] = useState(false)
  const [err, setErr] = useState('')
  const done = status === 'done'

  const update = async (next: EscalationStatus) => {
    if (pending) return
    setPending(true)
    setErr('')
    try {
      const res = await updateEscalationStatus(esc.id, next)
      if (res.ok) setStatus(next)
      else setErr(res.error || 'update failed')
    } catch {
      setErr('network error')
    }
    setPending(false)
  }

  return (
    <Card surface="paper" radius="md" className="p-4">
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
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[11.5px] text-text3">{done ? 'Done.' : status}</span>
        <button
          type="button"
          onClick={() => update(done ? 'new' : 'done')}
          disabled={pending}
          className={GHOST_BTN}
        >
          {pending ? 'Saving…' : done ? 'Reopen' : 'Mark done'}
        </button>
        {err ? <span className="text-[11.5px] text-weak">{err}</span> : null}
      </div>
    </Card>
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
