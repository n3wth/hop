'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import HomeAirportPicker from './HomeAirportPicker'
import Logo from './Logo'

const DISMISS_KEY = 'hop:home-airport-prompt-dismissed'

// Shown on the signed-in home when the user has no home airport yet. A warm,
// solid-bunny prompt to set it once — then every search/deal starts from home.
// Uses the Logo mark carved onto a solid teal chip, matching the sibling
// icon-chip pattern (GmailHistory, ProgramsManager, AirlineStatusManager).
export default function HomeAirportPrompt() {
  const [done, setDone] = useState<string | null>(null)
  // Persist dismissal so the prompt stays gone on reload (it's purely a nudge —
  // the home airport can still be set anytime in /account).
  const [dismissed, setDismissed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      // Read client-only persisted dismissal on mount (can't run during SSR).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true)
    } catch {
      // storage unavailable — show the prompt as usual.
    }
    setReady(true)
  }, [])

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore — dismissal still holds for this session via state.
    }
  }

  // Avoid a flash of the prompt before we've read the persisted dismissal.
  if (!ready || dismissed) return null

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand text-brand-light">
          <Logo size={26} carve="var(--color-brand)" decorative />
        </span>
        <div className="min-w-0 flex-1">
          {done ? (
            <>
              <h3 className="font-display text-[17px] font-semibold text-text">
                Home set to {done}.
              </h3>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-text2">
                Every search and deal now starts from there. Change it anytime in{' '}
                <Link
                  href="/account"
                  className="font-semibold text-brand underline-offset-2 transition-colors hover:text-brand-deep hover:underline"
                >
                  your account
                </Link>
                .
              </p>
            </>
          ) : (
            <>
              <h3 className="font-display text-[17px] font-semibold text-text">
                Where do you usually fly from?
              </h3>
              <p className="mt-1 mb-4 max-w-[52ch] text-[13.5px] leading-[1.5] text-text2">
                Set your home airport once and hop will pre-fill it on every search and tailor
                deals to where you actually start.
              </p>
              <HomeAirportPicker cta="Set home" onSaved={(c) => setDone(c)} />
            </>
          )}
        </div>
        {/* The × stays visible in the done state so the member can dismiss the
            confirmation; dismissal persists across reloads. */}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-text3 transition-colors hover:bg-sunk hover:text-text2"
        >
          <span className="text-[20px] leading-none">×</span>
        </button>
      </div>
    </section>
  )
}
