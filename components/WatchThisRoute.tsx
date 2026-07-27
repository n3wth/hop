'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { SearchParams } from '@/lib/types'
import { createWatchExplicit } from '@/app/actions/standing-orders'
import { watchRequestFromParams } from '@/lib/watch-request'
import Icon from './Icon'

export interface WatchThisRouteProps {
  /** The exact trip the verdict on screen was computed for — watched verbatim. */
  params: SearchParams
  /** hop's verdict line (lib/search.POINTS_THRESHOLD_CPP), passed down so this
      stays a pure display value, never a re-derived one. */
  threshold: number
  isSignedIn: boolean
  /** /auth/login?returnTo=... — the SAME returnTo VerdictRail builds for its own
      sign-in CTA, so a signed-out visitor lands back on this exact search. */
  signInHref: string
  /** Whether the standing-orders runner is live (resolved server-side from
      lib/env.ts#isStandingOrdersCronLive). Off → the copy promises only what
      hop can do today: the watch is saved, alerts go live soon. Defaults
      false — fail honest when a caller forgets. */
  live?: boolean
}

type Status = 'idle' | 'success' | 'limit' | 'error'

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "Watch this route" — the one-tap path from a pay-cash verdict into a standing
// order, so a one-time lookup can become a habit. Calls the already-validated,
// tier-capped createWatchExplicit server action with the live search params;
// no new economics, no new tables. Flat editorial on the teal hero: a
// hairline-bordered row, matching CardAffiliateCTA's slot on the points path.
export default function WatchThisRoute({
  params,
  threshold,
  isSignedIn,
  signInHref,
  live = false,
}: WatchThisRouteProps) {
  const [pending, startTransition] = useTransition()
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const searchQuery = useSearchParams()
  const router = useRouter()
  const resumedRef = useRef(false)

  const route = `${params.from} → ${params.to}`
  const dates = params.return ? `${params.depart} – ${params.return}` : params.depart
  const cabin = params.cabin && params.cabin !== 'economy' ? ` · ${cap(params.cabin)}` : ''
  const thresholdLabel = `${threshold.toFixed(1)}¢`

  async function performWatch() {
    const res = await createWatchExplicit(watchRequestFromParams(params))
    if (res.ok) {
      setStatus('success')
      return
    }
    const atLimit = /alert limit/i.test(res.error ?? '')
    setStatus(atLimit ? 'limit' : 'error')
    setMessage(res.error ?? 'Could not save the watch.')
  }

  function watch() {
    setMessage(null)
    startTransition(performWatch)
  }

  // Resume the tap that started the login round-trip: the signed-out CTA sends
  // `watch=1` through returnTo, and one saved watch is exactly what the user
  // asked for by tapping it. The flag is stripped from the URL before firing so
  // refresh/back can never repeat the action.
  useEffect(() => {
    if (!isSignedIn || resumedRef.current) return
    if (searchQuery.get('watch') !== '1') return
    resumedRef.current = true
    const next = new URLSearchParams(searchQuery.toString())
    next.delete('watch')
    router.replace(`?${next.toString()}`, { scroll: false })
    // Not watch(): its eager setMessage(null) would be a synchronous
    // set-state-in-effect; message is still null on first render anyway.
    startTransition(performWatch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, searchQuery])

  if (!isSignedIn) {
    // Thread the one-shot resume flag INSIDE the (encoded) returnTo, so the
    // post-login landing is this same search with `watch=1` present.
    const resumeHref = /returnTo=[^&]/.test(signInHref)
      ? signInHref.replace(/(returnTo=[^&]*)/, `$1${encodeURIComponent('&watch=1')}`)
      : signInHref
    return (
      <Shell icon="notifications">
        <p className="text-[14px] leading-[1.5] text-hero-body">
          {live
            ? `hop pings you the day ${route} clears ${thresholdLabel}/point.`
            : `hop saves a watch on ${route} for the day it clears ${thresholdLabel}/point — alerts aren't live yet.`}
        </p>
        <ArrowLink href={resumeHref}>Sign in to watch this route</ArrowLink>
      </Shell>
    )
  }

  if (status === 'success') {
    return (
      <Shell icon="check_circle">
        {/* Post-action feedback, not page entrance: the line settles in as the
            check pops (Shell animates the check_circle icon). */}
        <p className="hop-text-appear text-[14px] leading-[1.5] text-hero-body">
          {live ? (
            <>
              Watching <b className="font-semibold text-white">{route}</b> on {dates}
              {cabin}. hop pings you above{' '}
              <b className="font-semibold text-white">{thresholdLabel}</b> /point.
            </>
          ) : (
            <>
              {/* Lead with the fact that is true NOW (a saved row), not the
                  active verb — nothing is monitoring until the runner flips. */}
              Saved — <b className="font-semibold text-white">{route}</b> on {dates}
              {cabin}. Alerts aren&apos;t live yet.
            </>
          )}
        </p>
        <ArrowLink href="/account">Manage in /account</ArrowLink>
      </Shell>
    )
  }

  return (
    <Shell icon="notifications">
      <p className="text-[14px] leading-[1.5] text-hero-body">
        {live
          ? `hop pings you the day this exact trip clears ${thresholdLabel}/point.`
          : `hop saves this watch for the day this trip clears ${thresholdLabel}/point — alerts aren't live yet.`}
      </p>
      <button
        type="button"
        onClick={watch}
        disabled={pending}
        className="mt-[10px] inline-flex items-center gap-[8px] rounded-[10px] border-[1.5px] border-white/20 px-4 py-[9px] text-[13.5px] font-semibold text-white transition-colors hover:border-white/45 disabled:opacity-70"
      >
        <Icon name="notifications" size={16} />
        {pending ? 'Watching…' : 'Watch this route'}
      </button>
      {status === 'limit' ? (
        <p role="alert" className="mt-[8px] text-[12.5px] leading-[1.5] text-gold-soft">
          {message}{' '}
          {/* #billing lands on the Plan section (the upgrade door) when billing
              is on; with billing off the anchor is absent and the link degrades
              to plain /account — same page, no dead end. */}
          <a href="/account#billing" className="underline underline-offset-2 hover:text-white">
            Manage in /account
          </a>
          .
        </p>
      ) : null}
      {status === 'error' ? (
        <p role="alert" className="mt-[8px] text-[12.5px] leading-[1.5] text-gold-soft">
          {message}
        </p>
      ) : null}
    </Shell>
  )
}

function Shell({
  icon,
  children,
}: {
  icon: 'notifications' | 'check_circle'
  children: React.ReactNode
}) {
  return (
    <div
      className="hop-rise mt-5 flex items-start gap-3 rounded-[14px] border-[1.5px] border-white/15 bg-white/[0.04] px-4 py-[14px]"
      style={{ ['--hop-delay' as string]: '260ms' }}
    >
      {/* check_circle only ever renders after the save succeeds, so its settle
          is action feedback (hop-check-in), never load-time motion. */}
      <span
        aria-hidden
        className={`mt-[2px] flex-shrink-0 text-hero-label ${
          icon === 'check_circle' ? 'hop-check-in' : ''
        }`}
      >
        <Icon name={icon} size={16} weight={icon === 'check_circle' ? 'fill' : 'regular'} />
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="group mt-[6px] inline-flex items-center gap-[6px] text-[13px] font-semibold text-mint-bright transition-colors hover:text-white"
    >
      {children}
      <span aria-hidden>→</span>
    </a>
  )
}
