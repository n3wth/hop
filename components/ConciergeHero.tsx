'use client'

// The conversational front door TEASER — the home hero's compact way in to
// hop's agent. The /ask landing's empty state now renders its own component
// (components/concierge/AskStart) instead of this one, but the two still
// share one voice via lib/concierge-hero's copy (conciergeHeroCopy), so a chip
// tapped here and the greeting on /ask never drift into two different products.
//
// Presentation only — it owns the look (photographic panel + scrim, eyebrow,
// heading, sub, composer, chips) and renders the copy from lib/concierge-hero.
// Behavior is the caller's: AgentComposer wires submit to route into /ask?q=….
//
// Flat + on-brand: a brand-ink panel (an allowed surface) under a full-bleed
// photo as imagery, a single dark→ink scrim for legibility, solid white input,
// hover = color only (no lift), motion is reduced-motion-safe via .hop-rise.

import { useEffect, useRef, useState, useMemo, type FormEvent } from 'react'
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
  /** Disable submit. Home leaves it false. */
  submitDisabled?: boolean
  /** Autofocus the input (the home does not steal focus by default). */
  autoFocus?: boolean
  /** Optional backdrop photos — the first is the scrimmed backdrop; several
   *  cross-fade the backdrop slowly through them (see `rotating` below). */
  photos?: ConciergeHeroPhoto[]
  /** Heading level for the hero title. Defaults to h1; pass 'h2' where another
   *  element owns the page's h1 (the signed-out home, where the verdict hero
   *  leads and this is the second door). */
  headingTag?: 'h1' | 'h2'
  /** Lazy-load the backdrop photo. Only pass true when this hero is confirmed
   *  BELOW the fold (e.g. the signed-out home's "second door", which renders
   *  after the verdict hero + reel) — never for a hero that's a page's likely
   *  LCP image (signed-in home's front-door composer). Defaults to eager. */
  lazyBackdrop?: boolean
}

export default function ConciergeHero({
  copy,
  value,
  onValueChange,
  onSubmit,
  onChip,
  submitDisabled = false,
  autoFocus = false,
  photos = [],
  headingTag: HeadingTag = 'h1',
  lazyBackdrop = false,
}: ConciergeHeroProps) {
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

  // Engaging, dynamic typing loop for sample search queries
  const PLACEHOLDERS = useMemo(() => [
    'somewhere warm, ~40k points...',
    '7 nights in Tokyo on United miles...',
    'business class to Europe under 80k points...',
    'direct flight to London next month...',
    'beach trip for a long weekend...'
  ], [])

  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [currentPlaceholder, setCurrentPlaceholder] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let timer: NodeJS.Timeout
    const fullText = PLACEHOLDERS[placeholderIndex]
    
    // Typing speed: 40ms per char. Erasing speed: 20ms. Delay between words: 3000ms.
    if (isDeleting) {
      timer = setTimeout(() => {
        setCurrentPlaceholder(p => p.slice(0, -1))
      }, 20)
    } else {
      timer = setTimeout(() => {
        setCurrentPlaceholder(fullText.slice(0, currentPlaceholder.length + 1))
      }, 40)
    }

    if (!isDeleting && currentPlaceholder === fullText) {
      timer = setTimeout(() => setIsDeleting(true), 3000)
    } else if (isDeleting && currentPlaceholder === '') {
      setIsDeleting(false)
      setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
    }

    return () => clearTimeout(timer)
  }, [currentPlaceholder, isDeleting, placeholderIndex, PLACEHOLDERS])

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[var(--radius-hero)]"
      style={{ background: 'var(--color-brand-ink)' }}
    >
      {/* Structural architectural minimalist grid lines */}
      <div className="pointer-events-none absolute inset-0 flex justify-between px-6 sm:px-10 md:px-16 lg:px-24">
        <div className="w-px h-full bg-white/[0.03]" />
        <div className="w-px h-full bg-white/[0.02] hidden md:block" />
        <div className="w-px h-full bg-white/[0.02] hidden md:block" />
        <div className="w-px h-full bg-white/[0.03]" />
      </div>

      {/* Content: centered in the available space. */}
      <div className="relative flex flex-1 flex-col items-center px-5 py-16 text-center sm:px-10 sm:py-24">
        <span
          className="hop-rise inline-flex items-center gap-2 rounded-full bg-brand-deep px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[var(--track-tag)] text-hero-eyebrow"
          style={{ ['--hop-delay' as string]: '40ms' }}
        >
          <Icon name="lightbulb" size={12} />
          {copy.eyebrow}
        </span>

        <HeadingTag
          className="hop-rise mt-7 max-w-[18ch] text-balance font-display text-[38px] font-semibold leading-[0.98] tracking-[-0.03em] text-white sm:text-[60px] lg:text-[72px]"
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

        {/* composer — the primary action */}
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
              placeholder={currentPlaceholder || copy.placeholder}
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

        {/* one-tap starters — one canonical set */}
        <div
          className="hop-rise mt-6 flex w-full max-w-[560px] flex-wrap justify-center gap-2"
          style={{ ['--hop-delay' as string]: '240ms' }}
        >
          {copy.chips.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChip(p)}
              className="rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-[13.5px] font-medium text-hero-cream transition-colors hover:border-mint-bright hover:bg-white/20 hover:text-white"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
