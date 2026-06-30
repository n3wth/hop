'use client'

import { useId, useState, useTransition } from 'react'
import Icon from '@/components/Icon'

// "Have hop book it for you" — the quiet expert-booking affordance on /ask
// (roadmap §6 / N-290, Phase 1). It does NOT book anything: it logs a request a
// person follows up on. The copy says so plainly — no "instant", no fake SLA.
//
// Flat editorial: a hairline-bordered panel on the cream canvas, no shadow/
// gradient/glow, brand tokens (never hex), AA contrast. One collapsed line that
// expands to a small inline form (email + optional note), POSTs to
// /api/concierge-escalation, then shows a calm confirmation. Reduced-motion-safe:
// the only motion is a token-eased color transition on the controls.

interface EscalationCTAProps {
  // Prefill from the signed-in session when known. The field stays editable so a
  // user can reach hop at a different address.
  defaultEmail?: string
  // Live total points at request time — passed through as context for the human
  // who follows up (never shown as a price; this isn't a quote).
  totalPoints?: number
}

type Phase = 'idle' | 'open' | 'done'

export default function EscalationCTA({ defaultEmail, totalPoints }: EscalationCTAProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [email, setEmail] = useState(defaultEmail ?? '')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const emailId = useId()
  const noteId = useId()

  function submit() {
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Add an email so we can reach you.')
      return
    }
    setError(null)
    start(async () => {
      try {
        const res = await fetch('/api/concierge-escalation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            email: trimmed,
            trip: {
              notes: note.trim() || undefined,
              ...(typeof totalPoints === 'number' ? { totalPoints } : {}),
            },
          }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (res.ok && data?.ok) {
          setPhase('done')
          return
        }
        setError(data?.error ?? "We couldn't log that just now — please try again in a bit.")
      } catch {
        setError("We couldn't reach hop just now — please try again in a bit.")
      }
    })
  }

  // Confirmation — calm and honest about what happens next (a human, not a bot,
  // and no promised turnaround we can't keep in Phase 1).
  if (phase === 'done') {
    return (
      <section className="rounded-[16px] border border-border bg-surface px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex-shrink-0 text-brand">
            <Icon name="check_circle" size={20} />
          </span>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-text">Request received</div>
            <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.55] text-text2">
              A hop specialist will look at your trip and email{' '}
              <span className="font-medium text-text">{email.trim()}</span> to take it from here.
              This is a hands-on booking service, so it&apos;s a real person — not an instant
              confirmation.
            </p>
          </div>
        </div>
      </section>
    )
  }

  // Collapsed: one quiet line. Not a billboard — it sits under the chat for the
  // user who wants a human to do the booking.
  if (phase === 'idle') {
    return (
      <section className="rounded-[16px] border border-border bg-surface px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 text-brand">
              <Icon name="compass" size={20} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold text-text">
                Want hop to book it for you?
              </div>
              <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.55] text-text2">
                Tell us the trip and a hop specialist will find the award space and handle the
                booking by hand. We&apos;ll email you to sort out the details.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setPhase('open')
            }}
            className="inline-flex flex-shrink-0 items-center gap-1.5 self-start rounded-[12px] border border-border bg-bg px-4 py-2 text-[13px] font-semibold text-brand transition-colors duration-200 hover:bg-brand-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:self-center"
          >
            Request a booking
          </button>
        </div>
      </section>
    )
  }

  // Open: the inline form. Email (required) + optional note. No modal — flat.
  return (
    <section className="rounded-[16px] border border-border bg-surface px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex-shrink-0 text-brand">
          <Icon name="compass" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-text">Have hop book it for you</div>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-[1.55] text-text2">
            Leave your email and anything you know about the trip. A hop specialist books it by
            hand and emails you — it&apos;s a concierge request, not an instant confirmation.
          </p>

          <div className="mt-3 flex flex-col gap-2.5">
            <div className="flex flex-col gap-1">
              <label htmlFor={emailId} className="text-[12px] font-semibold text-text2">
                Email
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={pending}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-[14px] text-text placeholder:text-text3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={noteId} className="text-[12px] font-semibold text-text2">
                Trip details <span className="font-normal text-text3">(optional)</span>
              </label>
              <textarea
                id={noteId}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="e.g. 2 in business to Tokyo, late March, flexible by a few days."
                disabled={pending}
                className="w-full resize-y rounded-[10px] border border-border bg-bg px-3 py-2 text-[14px] leading-[1.5] text-text placeholder:text-text3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
              />
            </div>

            {error ? (
              <p role="alert" className="flex items-center gap-1.5 text-[13px] text-weak">
                <Icon name="error" size={15} />
                {error}
              </p>
            ) : null}

            <div className="mt-0.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-[12px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
              >
                {pending ? 'Sending…' : 'Send request'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setPhase('idle')
                }}
                disabled={pending}
                className="rounded-[12px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors duration-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
