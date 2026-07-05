'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// One floating postcard's worth of data. Everything here was computed on the
// server (lib/destinations + lib/images) — this component only drifts and
// cycles; it never invents a number.
export interface Postcard {
  code: string
  city: string
  country: string
  /** Engine-computed typical value (lib/destinations#computeCpp). */
  cpp?: number
  thumb: string
  color?: string
  href: string
}

// A fixed scatter: two slots per side of the hero copy, each with its own
// resting rotation, drift period, and cross-fade period, so the field never
// moves in lockstep. Slots are anchored to the CENTER (calc from 50%) so the
// cards hug the copy column at every viewport instead of flying out to the
// shell edges on very wide screens.
// Each side is a tight diagonal CLUSTER (the second card tucks in beside the
// first, not below it) so the whole scatter stays within the hero copy band
// and can never reach the verdict panel underneath, whatever the copy height.
// One large portrait postcard per side with a smaller one tucked behind it —
// mass is symmetric, arrangement is not. Photo-first: the label sits ON the
// photo over the same legibility scrim the destination reel uses, so the
// ambient cards and the reel read as one visual system.
const SLOTS = [
  { side: 'left', edge: 'calc(50% - 660px)', top: 24, w: 212, h: 268, rot: -3.2, drift: 10800, cycle: 8200, z: 20 },
  { side: 'left', edge: 'calc(50% - 512px)', top: 56, w: 156, h: 196, rot: 2.6, drift: 12600, cycle: 11400, z: 10 },
  { side: 'right', edge: 'calc(50% - 656px)', top: 44, w: 212, h: 268, rot: 2.8, drift: 11600, cycle: 9800, z: 20 },
  { side: 'right', edge: 'calc(50% - 508px)', top: 64, w: 156, h: 196, rot: -2.6, drift: 13400, cycle: 12800, z: 10 },
] as const

export default function PostcardDrift({ cards }: { cards: Postcard[] }) {
  // Deal the cards round-robin into the four slots.
  const decks = SLOTS.map((_, i) => cards.filter((_, idx) => idx % SLOTS.length === i))
  const [ticks, setTicks] = useState<number[]>(() => SLOTS.map(() => 0))

  useEffect(() => {
    // Reduced motion → no cycling: each slot keeps its first card, static.
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timers = SLOTS.map((s, i) =>
      window.setInterval(() => {
        setTicks((prev) => prev.map((t, j) => (j === i ? t + 1 : t)))
      }, s.cycle),
    )
    return () => timers.forEach((t) => window.clearInterval(t))
  }, [])

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 hidden min-[1360px]:block">
      {SLOTS.map((slot, i) => {
        const deck = decks[i]
        if (deck.length === 0) return null
        const active = ticks[i] % deck.length
        return (
          <div
            key={i}
            className="hop-rise absolute"
            style={{
              [slot.side]: slot.edge,
              top: slot.top,
              zIndex: slot.z,
              ['--hop-delay' as string]: `${340 + i * 110}ms`,
            }}
          >
            <div
              className="hop-drift relative"
              style={{
                width: slot.w,
                height: slot.h,
                ['--pc-rot' as string]: `${slot.rot}deg`,
                ['--pc-period' as string]: `${slot.drift}ms`,
              }}
            >
              {deck.map((c, j) => (
                <Link
                  key={c.code}
                  href={c.href}
                  aria-hidden={j !== active}
                  tabIndex={j === active ? undefined : -1}
                  aria-label={`${c.city} — see the points-vs-cash verdict`}
                  className={`absolute inset-0 block rounded-[var(--radius)] border border-border bg-paper p-1.5 transition-opacity duration-[900ms] hover:border-brand ${
                    j === active ? 'pointer-events-auto opacity-100' : 'opacity-0'
                  }`}
                >
                  <span
                    className="relative block h-full w-full overflow-hidden rounded-[10px]"
                    style={{ backgroundColor: c.color ?? 'var(--color-brand-deep)' }}
                  >
                    {/* Small ~210px card — the small thumb, lazily. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.thumb}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    {/* legibility scrim — same language as the reel tiles */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(7,62,62,0.72) 0%, rgba(7,62,62,0.12) 44%, rgba(7,62,62,0) 66%)',
                      }}
                    />
                    <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-2 p-2.5">
                      <span className="truncate font-display text-[16px] font-semibold leading-[1.1] tracking-[-0.01em] text-white">
                        {c.city}
                      </span>
                      {c.cpp !== undefined ? (
                        <span className="hop-price flex-shrink-0 text-[11px] text-mint-bright">
                          {c.cpp.toFixed(1)}¢/pt
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
