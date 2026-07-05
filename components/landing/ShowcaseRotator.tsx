'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

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
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={e.code}
            src={e.image}
            alt=""
            aria-hidden={j !== active}
            loading={j === 0 ? undefined : 'lazy'}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ${
              j === active ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
      </div>

      {/* The product, layered on the dream: the engine's numbers for THIS
          place. Text lives on paper, never on the photo. */}
      <Link
        href={d.href}
        aria-label={`${d.city} — see the points-vs-cash verdict`}
        className="absolute bottom-0 left-5 block w-[min(82%,360px)] rounded-[var(--radius-lg)] border border-border bg-paper p-4 transition-colors hover:border-brand sm:left-8 sm:p-5"
      >
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-display text-[19px] font-semibold leading-[1.1] tracking-[-0.01em] text-text sm:text-[21px]">
            {d.city}
          </span>
          <span className="flex-shrink-0 text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
            {/* city-states would read twice (Hong Kong / HONG KONG) — show the
                IATA code instead when country adds nothing */}
            {d.country === d.city ? d.code : d.country}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="hop-price text-[14px] text-brand">{d.cpp.toFixed(1)}¢/pt</span>
          <span className="text-[13px] text-text2">
            from {Math.round(d.miles / 1000)}k miles{d.cabin ? ` · ${d.cabin}` : ''} · {d.program}
          </span>
        </span>
        {d.pointsWin ? (
          <span className="mt-3 inline-flex rounded-full bg-brand-light px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[var(--track-tag)] text-brand-deep">
            Points win
          </span>
        ) : null}
      </Link>
    </div>
  )
}
