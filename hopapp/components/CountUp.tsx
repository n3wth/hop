'use client'

import { useEffect, useRef, useState } from 'react'

export interface CountUpProps {
  /** Final value to count to. */
  value: number
  /** Render the number (and any prefix/suffix) — receives the live value. */
  format?: (n: number) => string
  durationMs?: number
  delayMs?: number
  className?: string
  style?: React.CSSProperties
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Counts up from 0 to `value` once on mount, ease-out. Respects reduced-motion
// (renders the final value immediately). Tabular-friendly — the caller styles it.
export default function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString(),
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
      {format(display)}
    </span>
  )
}
