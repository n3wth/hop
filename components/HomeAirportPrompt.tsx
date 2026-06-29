'use client'

import { useState } from 'react'
import HomeAirportPicker from './HomeAirportPicker'

// Shown on the signed-in home when the user has no home airport yet. A warm,
// solid-bunny prompt to set it once — then every search/deal starts from home.
// Uses the SOLID bunny (favicon-bunny.svg) on a teal chip, not the line mark.
export default function HomeAirportPrompt() {
  const [done, setDone] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-surface p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-[14px] bg-brand text-brand-light">
          {/* solid bunny mark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon-bunny.svg" alt="" className="h-7 w-7 [filter:brightness(0)_invert(0.93)_sepia(0.2)_saturate(3)_hue-rotate(120deg)]" />
        </span>
        <div className="min-w-0 flex-1">
          {done ? (
            <>
              <h3 className="font-display text-[17px] font-semibold text-text">
                Home set to {done}.
              </h3>
              <p className="mt-1 text-[13.5px] leading-[1.5] text-text2">
                Every search and deal now starts from there. Change it anytime in your account.
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
        {!done ? (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setDismissed(true)}
            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-text3 transition-colors hover:bg-sunk hover:text-text2"
          >
            <span className="text-[20px] leading-none">×</span>
          </button>
        ) : null}
      </div>
    </section>
  )
}
