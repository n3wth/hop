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
      className="pointer-events-none absolute top-[-160px] -z-10 h-[820px] overflow-hidden"
      style={{ left: 'calc(50% - 50vw)', right: 'calc(50% - 50vw)' }}
    >
      {entries.map((e, j) => (
        // The tiny thumb is plenty — 70px of blur erases any resolution.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={e.code}
          src={e.thumb}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1800ms] ${
            j === active ? 'opacity-[0.32]' : 'opacity-0'
          }`}
          style={{ filter: 'blur(70px) saturate(1.15)', transform: 'scale(1.2)' }}
        />
      ))}
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
