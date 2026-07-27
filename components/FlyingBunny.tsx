'use client'

import { useEffect, useRef } from 'react'
import Logo from './Logo'

export interface FlyingBunnyProps {
  size?: number
  className?: string
  carve?: string
  /** Color class for the mark itself; defaults to the calm ink-soft. The
      TopNav lockup paints it text-brand per the masthead canon. */
  markClassName?: string
}

// The bunny does a single playful leap on first arrival (once per session), then
// stays calm. No scroll-driven motion — a scroll listener + per-frame transform
// made scrolling feel heavy, so the bunny just rests after its entrance.
// Transform-only (nothing translucent). Honors prefers-reduced-motion.
export default function FlyingBunny({ size = 46, className, carve, markClassName }: FlyingBunnyProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // One-time load leap — but only ONCE PER SESSION, not on every page nav
    // (the bunny remounts on each navigation). sessionStorage gates it so it
    // plays on first arrival, then stays calm as you move around the app.
    let alreadyLeapt = true
    try {
      alreadyLeapt = sessionStorage.getItem('hop-leapt') === '1'
    } catch {
      /* sessionStorage unavailable — skip the leap */
    }
    if (alreadyLeapt) return

    let done = false
    const endLeap = () => {
      if (done) return
      done = true
      el.classList.remove('hop-bunny-leap')
      el.style.transform = 'translate3d(0,0,0)'
    }
    el.classList.add('hop-bunny-leap')
    el.addEventListener('animationend', endLeap, { once: true })
    // Fallback: if animationend never fires (interrupted, backgrounded tab, a
    // browser that drops the event), clear the leap class anyway so the bunny
    // doesn't get stuck mid-animation. 720ms anim + 240ms delay ≈ 960ms; pad it.
    const fallback = setTimeout(endLeap, 1200)
    try {
      sessionStorage.setItem('hop-leapt', '1')
    } catch {
      /* ignore */
    }

    return () => {
      clearTimeout(fallback)
      el.removeEventListener('animationend', endLeap)
      el.classList.remove('hop-bunny-leap')
    }
  }, [])

  return (
    <span
      ref={ref}
      className={className}
      style={{ display: 'inline-flex', willChange: 'transform', transformOrigin: 'center bottom' }}
    >
      <Logo size={size} carve={carve} className={markClassName ?? 'text-text2'} />
    </span>
  )
}
