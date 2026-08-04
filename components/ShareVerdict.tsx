'use client'

import { useState, useTransition } from 'react'
import type { SearchParams } from '@/lib/types'
import { shareVerdict } from '@/app/actions/share-verdict'
import Icon from './Icon'

export interface ShareVerdictProps {
  /** The exact trip the verdict on screen was computed for. The server
      re-validates and re-runs the search — this is convenience, not trust. */
  params: SearchParams
}

type Status = 'idle' | 'success' | 'error'

function toRaw(params: SearchParams): Record<string, string> {
  const raw: Record<string, string> = {
    from: params.from,
    to: params.to,
    depart: params.depart,
    adults: String(params.adults),
  }
  if (params.return) raw.return = params.return
  if (params.children) raw.children = String(params.children)
  if (params.infants) raw.infants = String(params.infants)
  if (params.cabin) raw.cabin = params.cabin
  return raw
}

// Only two copy variants per docs/design/copy-spec.md — the degraded case
// names what's missing; every other reason (disabled/invalid/rate-limited/
// unavailable) gets the same terse retry line, never an internal-sounding code.
function errorCopy(reason: string): string {
  if (reason === 'degraded') return 'Not enough live data for a receipt. Try again in a minute.'
  return "Couldn't create the link. Try again."
}

// "Share this verdict" — mints a permanent /v/[id] receipt from the live
// search params and copies it (or opens the native share sheet on mobile).
// Rendered only when the server has already confirmed the flag is on and this
// result is shareable (VerdictRail's call site) — no client-side gate to keep
// in sync with the server one.
export default function ShareVerdict({ params }: ShareVerdictProps) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)

  function share() {
    setMessage(null)
    startTransition(async () => {
      const res = await shareVerdict(toRaw(params))
      if (!res.ok) {
        setStatus('error')
        setMessage(errorCopy(res.reason))
        return
      }
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({ url: res.url })
          setStatus('success')
          return
        } catch {
          // Cancelled or unsupported mid-call — fall through to clipboard so
          // the link is still delivered somehow.
        }
      }
      try {
        await navigator.clipboard.writeText(res.url)
      } catch {
        // Clipboard can be unavailable (insecure context, permissions) — the
        // receipt still exists at res.url; only the auto-copy is best-effort.
      }
      setStatus('success')
    })
  }

  return (
    <div className="flex flex-col items-start">
      <button
        type="button"
        onClick={share}
        disabled={pending}
        className="inline-flex items-center justify-center gap-[8px] rounded-[14px] border-[1.5px] border-white/20 px-7 py-4 text-[15px] font-medium text-hero-body transition-colors hover:border-white/45 hover:text-white disabled:opacity-70"
      >
        <Icon name="content_copy" size={16} />
        {pending ? 'Building…' : status === 'success' ? 'Link copied' : 'Share this verdict'}
      </button>
      {status === 'error' ? (
        <p role="alert" className="mt-[8px] text-[12.5px] leading-[1.5] text-gold-soft">
          {message}
        </p>
      ) : null}
    </div>
  )
}
