'use client'

import { useEffect, useRef, useState } from 'react'

// Format is a STRING, not a function — functions can't cross the
// Server→Client component boundary in Next. Formatting happens here.
export type CountUpFormat = 'plain' | 'usd' | 'cpp'

export interface CountUpProps {
  /** Final value to count to. */
  value: number
  /** How to render the live number. */
  format?: CountUpFormat
  /** Fraction digits for 'plain'/'usd' (e.g. 2 for an exact receipt total).
      Default keeps the original whole-number rendering. */
  decimals?: number
  /** Start counting when the element first scrolls into view instead of on
      mount — for numbers below the fold, so the tick isn't spent unseen. */
  startInView?: boolean
  prefix?: string
  suffix?: string
  durationMs?: number
  delayMs?: number
  className?: string
  style?: React.CSSProperties
}

// Locale is PINNED to en-US: the server (Node ICU) and the client (browser ICU)
// must produce byte-identical strings or the SSR'd final value hydration-
// mismatches — worst on the receipt total, where cents must render exactly.
// It also matches money()/Intl usage elsewhere (the app formats USD-style
// throughout), so a de-DE visitor never sees "$1.234,56" on one number only.
function render(
  n: number,
  format: CountUpFormat,
  decimals: number | undefined,
  prefix?: string,
  suffix?: string
): string {
  let body: string
  const opts =
    decimals !== undefined
      ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
      : undefined
  if (format === 'usd')
    body = `$${opts ? n.toLocaleString('en-US', opts) : Math.round(n).toLocaleString('en-US')}`
  else if (format === 'cpp') body = `${(Math.round(n * 10) / 10).toFixed(1)}¢`
  else body = opts ? n.toLocaleString('en-US', opts) : Math.round(n).toLocaleString('en-US')
  return `${prefix ?? ''}${body}${suffix ?? ''}`
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Counts up from 0 to `value` once on mount, ease-out. Respects reduced-motion
// (renders the final value immediately). Tabular-friendly — the caller styles it.
export default function CountUp({
  value,
  format = 'plain',
  decimals,
  startInView = false,
  prefix,
  suffix,
  durationMs = 900,
  delayMs = 120,
  className,
  style,
}: CountUpProps) {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    // Reduced-motion (or a trivial 0 target): show the final value immediately
    // and never start the animation — no count-up, no momentary 0 flash. The
    // initial state is already `value`, so this also keeps SSR/first paint stable.
    if (prefersReducedMotion() || value === 0) {
      // Sync to the final value (no animation). Deliberate state set when the
      // value prop changes under reduced motion — not a cascading render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDisplay(value)
      return
    }

    let start: number | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let observer: IntersectionObserver | undefined

    const tick = (now: number) => {
      if (start === null) start = now
      const elapsed = now - start
      const t = Math.min(1, elapsed / durationMs)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(value * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else setDisplay(value)
    }

    const begin = () => {
      // Zero the display only once we're committed to animating, so a
      // below-the-fold number never sits at 0 waiting to be seen.
      setDisplay(0)
      timer = setTimeout(() => {
        rafRef.current = requestAnimationFrame(tick)
      }, delayMs)
    }

    if (startInView && rootRef.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            observer?.disconnect()
            observer = undefined
            begin()
          }
        },
        { threshold: 0.4 }
      )
      observer.observe(rootRef.current)
    } else {
      begin()
    }

    return () => {
      observer?.disconnect()
      if (timer !== undefined) clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs, delayMs, startInView])

  // The animated number is decorative for AT — a screen reader landing mid
  // count-up would otherwise read an intermediate (or 0) figure. Hide the
  // animating value and expose the true final value once, via sr-only.
  return (
    <span ref={rootRef} className={className} style={style}>
      <span aria-hidden="true">{render(display, format, decimals, prefix, suffix)}</span>
      <span className="sr-only">{render(value, format, decimals, prefix, suffix)}</span>
    </span>
  )
}
