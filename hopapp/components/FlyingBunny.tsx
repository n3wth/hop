'use client'

import { useEffect, useRef } from 'react'
import Logo from './Logo'

export interface FlyingBunnyProps {
  size?: number
  className?: string
  carve?: string
}

// The bunny "flies" with scroll: scroll momentum lifts and tilts it (like it's
// catching air against gravity), then a damped spring settles it back to rest
// when scrolling stops. Transform-only (no opacity — nothing translucent), not a
// continuous loop. Honors prefers-reduced-motion (stays still).
export default function FlyingBunny({ size = 46, className, carve }: FlyingBunnyProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let lastY = window.scrollY
    let lastT = performance.now()
    let lift = 0 // current vertical offset (px, negative = up)
    let vel = 0 // velocity of the lift spring
    let target = 0 // where the lift wants to be, set by scroll momentum
    let raf = 0
    let idleSince = 0

    const onScroll = () => {
      const now = performance.now()
      const dy = window.scrollY - lastY
      const dt = Math.max(now - lastT, 1)
      lastY = window.scrollY
      lastT = now
      // scroll speed (px/ms) → desired lift, clamped small. Subtle: max ~5px.
      const speed = dy / dt
      target = Math.max(-5, Math.min(5, -speed * 3))
      idleSince = now
      if (!raf) raf = requestAnimationFrame(tick)
    }

    const tick = () => {
      const now = performance.now()
      // after ~80ms of no scroll, the target returns to rest (gravity wins)
      if (now - idleSince > 80) target = 0
      // gentle damped spring toward target
      const k = 0.12
      const d = 0.78
      vel += (target - lift) * k
      vel *= d
      lift += vel
      const tilt = Math.max(-2.2, Math.min(2.2, lift * 0.35)) // faint rotate
      el.style.transform = `translate3d(0, ${lift.toFixed(2)}px, 0) rotate(${tilt.toFixed(2)}deg)`
      // settle: round to rest and stop the loop (no idle rAF burning CPU)
      if (Math.abs(vel) > 0.03 || Math.abs(lift - target) > 0.03 || target !== 0) {
        raf = requestAnimationFrame(tick)
      } else {
        lift = 0
        vel = 0
        el.style.transform = 'translate3d(0,0,0)'
        raf = 0
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-flex', willChange: 'transform', transformOrigin: 'center bottom' }}
    >
      <Logo size={size} carve={carve} className="text-brand" />
    </span>
  )
}
