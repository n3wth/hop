'use client'

import { useEffect, useState } from 'react'
import { SHOWCASE_PERIOD_MS, type ShowcaseEntry } from './ShowcaseRotator'

// A full-bleed gaussian backdrop behind the hero, literally matched to the
// showcase: the ACTIVE photo itself, heavily blurred, edge-to-edge of the
// screen (calc(50% - 50vw) breakout; body has overflow-x: clip), melting into
// the cream canvas at the bottom. Same period as the rotator, mounted in the
// same commit, so the wash and the photo advance together. Purely decorative:
// aria-hidden, pointer-events-none, static under reduced motion.
export default function HeroAmbience({ entries }: { entries: ShowcaseEntry[] }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setTick((v) => v + 1), SHOWCASE_PERIOD_MS)
    return () => window.clearInterval(t)
  }, [])

  const active = tick % entries.length

  return (
    <div
      aria-hidden
      // bottom-0 (not a fixed height) pins this to the hero SECTION's own
      // bottom edge, whatever that renders to on a given page/viewport — the
      // signed-out hero (search bar + sample-verdict panel) is much taller
      // than the signed-in hero (heading + composer only). A fixed height
      // tuned for the tall variant used to spill past the short variant's
      // section boundary, bleeding the wash into the next section's content.
      className="pointer-events-none absolute top-[-160px] bottom-0 -z-10 overflow-hidden"
      style={{ left: 'calc(50% - 50vw)', right: 'calc(50% - 50vw)' }}
    >
      {/* ONE confident tint, not a rotating set of hues — only the active
          photo is ever mounted (the old N-image stack, cross-fading between
          every entry's own color, read busier than the single restrained
          wash the flat-editorial bar calls for). Swaps with the rotator's
          own beat; the tiny thumb is plenty — 70px of blur erases any
          resolution. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={entries[active].code}
        src={entries[active].thumb}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-[0.32]"
        style={{ filter: 'blur(70px) saturate(1.15)', transform: 'scale(1.2)' }}
      />
      {/* veil: keeps nav/heading contrast honest up top, melts the wash into
          the plain canvas before the sample-verdict panel */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in srgb, var(--color-bg) 42%, transparent) 0%, color-mix(in srgb, var(--color-bg) 12%, transparent) 42%, var(--color-bg) 96%)',
        }}
      />
    </div>
  )
}
