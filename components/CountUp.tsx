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
  prefix?: string
  suffix?: string
  durationMs?: number
  delayMs?: number
  className?: string
  style?: React.CSSProperties
}

function render(n: number, format: CountUpFormat, prefix?: string, suffix?: string): string {
  let body: string
  if (format === 'usd') body = `$${Math.round(n).toLocaleString()}`
  else if (format === 'cpp') body = `${(Math.round(n * 10) / 10).toFixed(1)}¢`
  else body = Math.round(n).toLocaleString()
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
  prefix,
  suffix,
  durationMs = 900,
  delayMs = 120,
  className,
  style,
}: CountUpProps) {
  const [display, setDisplay] = useState(value)
  const rafRef = useRef<number | undefined>(undefined)

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

    setDisplay(0)
    let start: number | null = null

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

    const timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs, delayMs])

  // The animated number is decorative for AT — a screen reader landing mid
  // count-up would otherwise read an intermediate (or 0) figure. Hide the
  // animating value and expose the true final value once, via sr-only.
  return (
    <span className={className} style={style}>
      <span aria-hidden="true">{render(display, format, prefix, suffix)}</span>
      <span className="sr-only">{render(value, format, prefix, suffix)}</span>
    </span>
  )
}
