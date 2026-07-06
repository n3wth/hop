'use client'

import { useId, useState, useTransition } from 'react'
import Icon from '@/components/Icon'

// Newsletter signup (R1.6) — a single compact email input in the footer's
// brand column. Double opt-in (R2.3 sends a real weekly digest to this list),
// so success here means "check your inbox", NOT "you're subscribed" — that
// only becomes true once the confirm link is clicked (app/newsletter/confirmed).
// Flat editorial: no shadow/gradient/glow, brand tokens only, AA contrast.

type Phase = 'idle' | 'done'

export default function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [pending, start] = useTransition()
  const inputId = useId()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Add an email to join.')
      return
    }
    setError(null)
    start(async () => {
      try {
        const res = await fetch('/api/newsletter-signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (res.ok && data?.ok) {
          setPhase('done')
          return
        }
        setError(data?.error ?? "Couldn't save that — try again.")
      } catch {
        setError("Couldn't save that — try again.")
      }
    })
  }

  if (phase === 'done') {
    return (
      <p className="mt-4 flex items-center gap-1.5 text-left text-[13px] font-medium text-text2">
        <Icon name="check_circle" size={16} weight="fill" className="text-brand" />
        Check your inbox to confirm.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="mt-4 max-w-[34ch] text-left">
      <label htmlFor={inputId} className="text-[12px] font-semibold text-text2">
        Your wallet&apos;s best redemption, once a week.
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={inputId}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com"
          disabled={pending}
          className="w-full min-w-0 rounded-[10px] border border-border bg-bg px-3 py-2 text-[13px] text-text placeholder:text-text3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex-shrink-0 rounded-[10px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
        >
          {pending ? 'Joining…' : 'Join'}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-[12px] text-weak">
          <Icon name="error" size={12} weight="fill" />
          {error}
        </p>
      ) : null}
    </form>
  )
}
