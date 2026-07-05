'use client'

// THE shared conversational front door — one visual language, one voice.
//
// hop's single way in (talk to it) appears in two places: a teaser on the home
// hero and the full landing on /ask. Both render THIS component, so they can
// never drift into "two features that don't know about each other" again.
//
// Presentation only — it owns the look (photographic panel + scrim, eyebrow,
// heading, sub, composer, chips, optional mood gallery) and the copy (from
// lib/concierge-hero). Behavior is the caller's: the home wires submit to route
// into /ask?q=…; the /ask landing wires it to useChat. So the same hero drives a
// route push in one place and a streamed message in the other, identically drawn.
//
// Density:
//   • 'teaser' — home. Compact, no gallery/Gmail seam; the marketing promise
//     that, on submit, carries the visitor into /ask where the answer streams.
//   • 'full'   — /ask. Taller, with the mood gallery and the gets-to-know-you
//     affordances (Gmail seam, what-hop-remembers).
//
// Flat + on-brand: a brand-ink panel (an allowed surface) under a full-bleed
// photo as imagery, a single dark→ink scrim for legibility, solid white input,
// hover = color only (no lift), motion is reduced-motion-safe via .hop-rise.

import { useEffect, useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import Icon from './Icon'
import { type ConciergeHeroCopy } from '@/lib/concierge-hero'

// A serializable photo record (the same shape both pages already pass down) so
// the hero can render real imagery without the Unsplash key on the client.
export interface ConciergeHeroPhoto {
  thumb: string
  alt: string
  city: string
  countryCode: string
  /** Unsplash attribution (API terms) — optional only so a hand-built caller
   *  without a real photo doesn't need to fake one; every photo actually
   *  resolved via lib/images.ts#DestImage carries one. */
  credit?: { name: string; link: string; source?: string; sourceLink?: string }
}

export interface ConciergeHeroProps {
  /** Resolved copy (eyebrow/heading/sub/placeholder/chips) — one source. */
  copy: ConciergeHeroCopy
  /** Controlled composer value + setter (each surface owns its own state). */
  value: string
  onValueChange: (v: string) => void
  /** Submit the typed value. */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  /** Tap a starter chip — sends that prompt straight through. */
  onChip: (prompt: string) => void
  /** 'teaser' (home) | 'full' (/ask). */
  density: 'teaser' | 'full'
  /** Disable submit (e.g. /ask while the agent is busy). Home leaves it false. */
  submitDisabled?: boolean
  /** Autofocus the input (the /ask landing does; the home does not steal focus). */
  autoFocus?: boolean
  /** Optional backdrop + mood-gallery photos. The first is the scrimmed
   *  backdrop; up to six tile the gallery base (full density only). */
  photos?: ConciergeHeroPhoto[]
  /** Signed-in unlocks the "what hop remembers" affordance (full density). */
  signedIn?: boolean
  /** Gmail travel-history seam is live (env flag + Google creds). When true the
   *  "Connect Gmail" pill becomes a real button; otherwise it keeps "Soon". */
  gmailEnabled?: boolean
  /** Invoked by the live Gmail pill (routes to login / OAuth start). */
  onConnectGmail?: () => void
  /** Signed in but no programs linked yet → show the "Add your programs" nudge
   *  so the visitor knows answers will sharpen once balances are connected. */
  needsPrograms?: boolean
  /** Heading level for the hero title. Defaults to h1 (/ask, signed-in home);
   *  pass 'h2' where another element owns the page's h1 (the signed-out home,
   *  where the verdict hero leads and this is the second door). */
  headingTag?: 'h1' | 'h2'
}

export default function ConciergeHero({
  copy,
  value,
  onValueChange,
  onSubmit,
  onChip,
  density,
  submitDisabled = false,
  autoFocus = false,
  photos = [],
  signedIn = false,
  gmailEnabled = false,
  onConnectGmail,
  needsPrograms = false,
  headingTag: HeadingTag = 'h1',
}: ConciergeHeroProps) {
  const full = density === 'full'
  const tiles = photos.slice(0, 6)
  const backdrop = tiles[0]

  // autoFocus is gated to pointer:fine + wide viewports: on a phone, focusing the
  // input on mount pops the keyboard and buries the hero. We focus imperatively
  // after mount only when the device clearly has a hardware pointer and room.
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!autoFocus) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    const ok = window.matchMedia('(pointer: fine) and (min-width: 768px)').matches
    if (ok) inputRef.current?.focus()
  }, [autoFocus])

  // Teaser backdrop rotation — when the home passes several photos, the scrim
  // photo slowly cross-fades through them so the panel feels alive. Full
  // density (/ask) keeps its static backdrop: the mood gallery below already
  // carries the imagery there. Reduced motion → static first photo.
  const [backdropIdx, setBackdropIdx] = useState(0)
  const rotating = !full && tiles.length > 1
  useEffect(() => {
    if (!rotating) return
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setBackdropIdx((v) => v + 1), 7600)
    return () => window.clearInterval(t)
  }, [rotating])

  // Full density fills the parent (100dvh hop-ask-stage) with no rounding.
  // Teaser sizes to content with the standard hero radius.
  const panelClass = full
    ? 'flex-1'
    : 'rounded-[var(--radius-hero)]'

  // Attribution (Unsplash API terms) for whichever backdrop photo is actually
  // on screen right now — the rotating tile when cross-fading, else the
  // single static backdrop.
  const activeCredit = rotating ? tiles[backdropIdx % tiles.length]?.credit : backdrop?.credit

  return (
    <div
      className={`relative flex flex-col overflow-hidden ${panelClass}`}
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* full-bleed photo as imagery (allowed), under a single legibility scrim.
          Teaser + several photos → a slow cross-fade through them (opacity
          only; the scrim above holds legibility constant throughout). */}
      {rotating ? (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {tiles.map((t, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={t.thumb + i}
              src={t.thumb}
              alt=""
              loading={i === 0 ? undefined : 'lazy'}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1600ms] ${
                i === backdropIdx % tiles.length ? 'opacity-35' : 'opacity-0'
              }`}
            />
          ))}
        </div>
      ) : backdrop ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={backdrop.thumb}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
        />
      ) : null}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          // Stronger top stop so white eyebrow/heading clear WCAG AA even over a
          // bright backdrop photo (the lightest tiles previously thinned the top).
          background:
            'linear-gradient(to bottom, rgba(7,62,62,0.80) 0%, rgba(7,62,62,0.90) 55%, rgba(7,62,62,0.97) 100%)',
        }}
      />

      {/* Unsplash attribution (API terms) for the backdrop currently on
          screen — a small solid chip, not a shadow/gradient surface. */}
      {activeCredit ? (
        <div
          className="pointer-events-auto absolute right-3 top-3 z-10 max-w-[70%] truncate rounded-full px-2.5 py-1 text-[10px] font-medium text-white/70"
          style={{ background: 'rgba(7,26,26,0.5)' }}
        >
          Photo by{' '}
          <a
            href={`${activeCredit.link}?utm_source=hop&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {activeCredit.name}
          </a>{' '}
          on{' '}
          <a
            href={activeCredit.sourceLink ?? 'https://unsplash.com/?utm_source=hop&utm_medium=referral'}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-white/40 underline-offset-2 hover:text-white"
          >
            {activeCredit.source ?? 'Unsplash'}
          </a>
        </div>
      ) : null}

      {/* Content: centered in the available space above the gallery.
          Full density: top padding clears the transparent sticky nav. */}
      <div
        className={`relative flex flex-1 flex-col items-center px-5 text-center sm:px-10 ${
          full
            ? 'justify-center py-8'
            : 'py-16 sm:py-24'
        }`}
      >
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-brand-deep px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-hero-eyebrow"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={12} />
          {copy.eyebrow}
        </span>

        <HeadingTag
          className={`hop-rise mt-7 max-w-[18ch] text-balance font-display font-semibold leading-[0.98] tracking-[-0.03em] text-white ${
            full ? 'text-[40px] sm:text-[64px]' : 'text-[38px] sm:text-[60px] lg:text-[72px]'
          }`}
          style={{ ['--hop-delay' as string]: '90ms' }}
        >
          {copy.heading}
        </HeadingTag>

        <p
          className="hop-rise mt-5 max-w-[52ch] text-pretty text-[15px] leading-[1.6] text-hero-body sm:text-[17px]"
          style={{ ['--hop-delay' as string]: '140ms' }}
        >
          {copy.sub}
        </p>

        {/* composer — the primary action, identical on both surfaces */}
        <form
          onSubmit={onSubmit}
          className="hop-rise mt-8 w-full max-w-[600px]"
          style={{ ['--hop-delay' as string]: '190ms' }}
        >
          <div className="flex items-center gap-2 rounded-[16px] border-2 border-transparent bg-white py-2 pl-5 pr-2 transition-colors focus-within:border-brand sm:gap-3 sm:py-2.5">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              placeholder={copy.placeholder}
              aria-label="Tell hop where you want to go"
              enterKeyHint="go"
              className="no-inner-ring min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-medium text-text outline-none placeholder:font-normal placeholder:text-text3"
            />
            <button
              type="submit"
              aria-label="Ask hop"
              disabled={!value.trim() || submitDisabled}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-[12px] bg-brand px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-brand-deep disabled:text-hero-label hop-press"
            >
              Ask hop
              <span aria-hidden className="text-[15px] leading-none">→</span>
            </button>
          </div>
        </form>

        {/* one-tap starters — one canonical set, same on both surfaces.
            Full density: 2-column grid up to max-w-[560px] for neat alignment. */}
        <div
          className={`hop-rise mt-6 w-full max-w-[560px] ${full ? 'grid grid-cols-2 gap-2' : 'flex flex-wrap justify-center gap-2'}`}
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {copy.chips.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              className={`rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-[13.5px] font-medium text-hero-cream transition-colors hover:border-mint-bright hover:bg-white/20 hover:text-white ${full ? 'text-center' : ''}`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* full density only: gets-to-know-you affordances. Signed-out visitors
            don't see the disabled "Connect Gmail — Soon" pill (a dead control is
            noise before there's a relationship); they see nothing extra here. */}
        {full && signedIn ? (
          <div
            className="hop-rise mt-4 flex flex-wrap items-center justify-center gap-2"
            style={{ ['--hop-delay' as string]: '300ms' }}
          >
            {/* No programs yet → invite linking so answers price against real
                balances. The primary onward action for a fresh signed-in user. */}
            {needsPrograms ? (
              <Link
                href="/account"
                className="flex items-center gap-1.5 rounded-full border border-wallet-active bg-wallet-active/15 px-3.5 py-1.5 text-[12px] font-semibold text-hero-white-hover transition-colors hover:bg-wallet-active/25"
              >
                <Icon name="loyalty" size={16} className="flex-shrink-0" />
                Add your programs
              </Link>
            ) : null}
            {/* Gmail seam: live button when configured (env flag + creds), else
                the honest disabled "Soon" affordance. This block is signed-in
                only, so a live click routes straight to the OAuth start. */}
            {gmailEnabled && onConnectGmail ? (
              <button
                type="button"
                onClick={onConnectGmail}
                className="flex items-center gap-1.5 rounded-full border border-brand-muted bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-hero-label transition-colors hover:border-wallet-active hover:text-hero-white-hover"
              >
                <Icon name="envelope" size={16} className="flex-shrink-0" />
                Connect Gmail to learn from past trips
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Coming soon — let hop learn from your past trips"
                className="flex cursor-not-allowed items-center gap-1.5 rounded-full border border-brand-muted bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-hero-label"
              >
                <Icon name="envelope" size={16} className="flex-shrink-0" />
                Connect Gmail to learn from past trips
                <span className="rounded-full bg-brand-deep px-1.5 py-px text-[10px] uppercase tracking-wide text-hero-body">
                  Soon
                </span>
              </button>
            )}
            <Link
              href="/account"
              className="flex items-center gap-1.5 rounded-full border border-brand-muted bg-transparent px-3.5 py-1.5 text-[12px] font-medium text-hero-label transition-colors hover:border-wallet-active hover:text-hero-white-hover"
            >
              <Icon name="info" size={16} className="flex-shrink-0" />
              What hop remembers
            </Link>
          </div>
        ) : null}
      </div>

      {/* full density only: mood gallery — fixed-height strip at the base so the
          whole hero fits in one viewport with nothing to scroll. */}
      {full && tiles.length > 0 ? (
        <div
          className="hop-rise relative grid grid-cols-3 gap-px bg-brand-deep sm:grid-cols-6"
          style={{
            ['--hop-delay' as string]: '300ms',
            height: 'clamp(170px, 30vh, 280px)',
          }}
        >
          {tiles.map((t, i) => (
            <div
              key={t.city + i}
              className={`relative overflow-hidden ${i >= 3 ? 'hidden sm:block' : ''}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.thumb} alt={t.alt} loading="lazy" className="h-full w-full object-cover" />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(7,62,62,0.82) 0%, rgba(7,62,62,0) 60%)',
                }}
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2">
                <span
                  className={`fi fi-${t.countryCode} h-[10px] w-[14px] flex-shrink-0 rounded-[1px]`}
                  aria-hidden
                />
                <span className="truncate text-[11px] font-semibold text-white">{t.city}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
