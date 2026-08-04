'use client'

import Link from 'next/link'
import { useEffect, useState, ViewTransition } from 'react'
import { tier } from '@/lib/cpp'

// Same good/ok/weak language the verdict + destination grid chips use, so a
// cpp figure's color always means the same thing across surfaces.
const TIER_TEXT: Record<ReturnType<typeof tier>, string> = {
  green: 'text-good',
  amber: 'text-ok',
  muted: 'text-weak',
}

// One showcase entry. Every number here was computed on the server
// (lib/destinations + lib/search's threshold) — this component only cycles.
export interface ShowcaseEntry {
  code: string
  city: string
  country: string
  cpp: number
  miles: number
  program: string
  /** Set when the figures price a premium cabin — ALWAYS shown. */
  cabin?: 'business' | 'first'
  pointsWin: boolean
  image: string
  /** Small thumb of the same photo — the blurred ambience layer uses it. */
  thumb: string
  color?: string
  href: string
  /** Typical one-way cash for this redemption (lib/destinations
      #typicalCashUSD) — "the cash you skip" by using points. Optional: only
      the signed-in hero's balance-line teaser needs it; the signed-out
      showcase leaves it unset. */
  cashValue?: number
}

// The photo and its verdict card advance TOGETHER on one slow clock — a
// single composed object whose content changes, not a set of independently
// blinking parts. Reduced motion → the first destination, static.
// Shared with HeroAmbience so the background wash keeps the same beat.
export const SHOWCASE_PERIOD_MS = 8500

export default function ShowcaseRotator({ entries }: { entries: ShowcaseEntry[] }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setTick((v) => v + 1), SHOWCASE_PERIOD_MS)
    return () => window.clearInterval(t)
  }, [])

  const active = tick % entries.length
  const d = entries[active]

  return (
    // pb absorbs the verdict card overhanging the photo's bottom edge.
    <div className="hop-rise relative pb-10" style={{ ['--hop-delay' as string]: '240ms' }}>
      <div
        className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-hero)]"
        style={{ backgroundColor: d.color ?? 'var(--color-brand-deep)' }}
      >
        {entries.map((e, j) => (
          // Named by the manifest's own destination code (lib/destination-
          // photos.ts identity) — /search names the destination hero photo the
          // same way (VerdictRail's destPhotoCode) when it's the same curated
          // destination, so clicking through morphs this exact photo into the
          // verdict hero instead of cross-fading two unrelated images.
          <ViewTransition key={e.code} name={`photo-${e.code}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={e.image}
              alt=""
              aria-hidden={j !== active}
              loading={j === 0 ? undefined : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ${
                j === active ? 'opacity-100' : 'opacity-0'
              }`}
            />
          </ViewTransition>
        ))}
      </div>

      {/* The product, layered on the dream: the engine's numbers for THIS
          place. Text lives on paper, never on the photo. Verdict-first
          hierarchy: the pill + cpp are the loudest thing on the card — the
          number IS the pitch. City/country is a small context header, not
          the headline (docs/design/copy-spec.md — state the answer, then the
          number). */}
      <Link
        href={d.href}
        aria-label={`${d.city} — ${d.cpp.toFixed(1)} cents per point — see the points-vs-cash verdict`}
        className="absolute bottom-0 left-5 block w-[min(82%,360px)] rounded-[var(--radius-lg)] border border-border bg-paper p-4 transition-colors hover:border-brand sm:left-8 sm:p-5"
      >
        <span className="block truncate text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
          {/* city-states would read twice (Hong Kong / HONG KONG) — show the
              IATA code instead when country adds nothing */}
          {d.country === d.city ? d.code : `${d.city} · ${d.country}`}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          {d.pointsWin ? (
            <span className="inline-flex rounded-full bg-brand-light px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[var(--track-tag)] text-brand-deep">
              Points win
            </span>
          ) : null}
          <span className={`hop-price text-[24px] leading-none sm:text-[28px] ${TIER_TEXT[tier(d.cpp)]}`}>
            {d.cpp.toFixed(1)}¢/pt
          </span>
        </span>
        <span className="mt-2 block truncate text-[13px] text-text2">
          from {Math.round(d.miles / 1000)}k miles{d.cabin ? ` · ${d.cabin}` : ''} · {d.program}
        </span>
      </Link>
    </div>
  )
}
