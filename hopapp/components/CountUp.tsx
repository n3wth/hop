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
    if (prefersReducedMotion() || value === 0) {
      setDisplay(value)
      return
    }

    setDisplay(0)
    let start: number | null = null
    let timer: ReturnType<typeof setTimeout>

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

    timer = setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick)
    }, delayMs)

    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [value, durationMs, delayMs])

  return (
    <span className={className} style={style}>
      {render(display, format, prefix, suffix)}
    </span>
  )
}
