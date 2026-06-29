'use client'

import { memo, useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'

export interface TopNavProps {
  from?: string
  to?: string
  dates?: string
  who?: string
  fromCode?: string
  toCode?: string
}

// Crafted easing — decelerate, ~280ms. One curve drives the whole morph so the
// header, logo, and search contract together as a single motion.
const EASE = 'cubic-bezier(.2,0,0,1)'
const DUR = '280ms'

// Static logo lockup — memoized so scroll-state toggles never re-render the
// (path-heavy) bunny SVG. Only the wrapper's transform animates.
const LogoLockup = memo(function LogoLockup() {
  return (
    <>
      <FlyingBunny size={46} carve="var(--color-bg)" />
      <span className="font-display text-[28px] font-bold tracking-[-0.04em] text-text">hop</span>
    </>
  )
})

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  width: string
  collapsed: boolean
}

// A search field that MORPHS: its label collapses to zero height on scroll and
// the input narrows, so the whole row contracts rather than cross-fading.
function Field({ label, value, onChange, width, collapsed }: FieldProps) {
  return (
    <label className="flex min-w-0 flex-col justify-center leading-[1.05]">
      <span
        className="overflow-hidden text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2"
        style={{
          maxHeight: collapsed ? 0 : 16,
          opacity: collapsed ? 0 : 1,
          transition: `max-height ${DUR} ${EASE}, opacity ${DUR} ${EASE}`,
        }}
      >
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent font-semibold text-text outline-none ${width}`}
        style={{
          fontSize: collapsed ? 14 : 15,
          transition: `font-size ${DUR} ${EASE}`,
        }}
      />
    </label>
  )
}

// Scroll-aware top bar. The whole header SHRINKS in height on scroll (76→56px),
// the logo scales down, and the search CONTRACTS in place (labels collapse,
// "Dates/Who" hide) into a compact route+dates pill — one continuous morph, not
// a cross-fade. Frosted backdrop + hairline appear only once scrolled. Degrades
// to fully expanded with no JS.
export default function TopNav({
  from = 'San Francisco',
  to = 'Los Angeles',
  dates = 'Jul 9 – 12',
  who = '1 adult',
  fromCode = 'SFO',
  toCode = 'LAX',
}: TopNavProps) {
  const [vFrom, setFrom] = useState(from)
  const [vTo, setTo] = useState(to)
  const [vDates, setDates] = useState(dates)
  const [vWho, setWho] = useState(who)

  const [scrolled, setScrolled] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // IntersectionObserver on a top sentinel: zero per-frame JS, no scroll
  // listener. Fires only on the cross transition; React bails on equal state.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      threshold: 0,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const c = scrolled // collapsed

  return (
    <>
      {/* sentinel: while visible we're at the top (expanded) */}
      <div ref={sentinelRef} aria-hidden className="absolute left-0 top-0 h-px w-px" />

      <header
        className="sticky top-0 z-50"
        style={{
          height: c ? 56 : 76,
          background: c ? 'color-mix(in srgb, var(--color-bg) 80%, transparent)' : 'transparent',
          // Blur ONLY when scrolled — top-of-page has zero filter cost.
          // Lighter radius/saturate than before; promote to its own compositor
          // layer so the blur never repaints page content behind it on scroll.
          backdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          WebkitBackdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          borderBottom: c ? '1px solid var(--color-border)' : '1px solid transparent',
          transform: 'translateZ(0)',
          isolation: 'isolate',
          willChange: c ? 'backdrop-filter' : 'auto',
          transition: `height ${DUR} ${EASE}, background ${DUR} ${EASE}, border-color ${DUR} ${EASE}`,
        }}
      >
        <div className="mx-auto flex h-full max-w-[1440px] items-center gap-9 px-16">
          {/* logo — left, scales down on collapse */}
          <div
            className="flex flex-shrink-0 items-center gap-[11px]"
            style={{
              transform: c ? 'scale(0.84)' : 'scale(1)',
              transformOrigin: 'left center',
              transition: `transform ${DUR} ${EASE}`,
            }}
          >
            <LogoLockup />
          </div>

          {/* search — grouped next to the logo (not orphaned center); one
              element that contracts from full fields to a pill */}
          <div className="flex min-w-0 flex-shrink-0">
            <form
              className="flex items-center rounded-full border border-border bg-surface"
              style={{
                gap: c ? 10 : 16,
                paddingLeft: c ? 18 : 22,
                paddingRight: c ? 6 : 12,
                paddingTop: c ? 6 : 10,
                paddingBottom: c ? 6 : 10,
                transition: `gap ${DUR} ${EASE}, padding ${DUR} ${EASE}`,
              }}
            >
              <Field label="From" value={c ? fromCode : vFrom} onChange={setFrom} width={c ? 'w-[34px]' : 'w-[112px]'} collapsed={c} />
              <span className="flex-shrink-0 text-brand">
                <Icon name="swap_horiz" size={c ? 16 : 20} />
              </span>
              <Field label="To" value={c ? toCode : vTo} onChange={setTo} width={c ? 'w-[34px]' : 'w-[96px]'} collapsed={c} />

              {/* divider + Dates: collapse the divider; Dates stays in pill */}
              <span
                className="w-px flex-shrink-0 bg-border"
                style={{ height: c ? 18 : 26, transition: `height ${DUR} ${EASE}` }}
              />
              <Field label="Dates" value={vDates} onChange={setDates} width={c ? 'w-[72px]' : 'w-[78px]'} collapsed={c} />

              {/* Who — hidden entirely when collapsed (width + opacity to 0) */}
              <span
                className="w-px flex-shrink-0 overflow-hidden bg-border"
                style={{
                  height: c ? 0 : 26,
                  opacity: c ? 0 : 1,
                  transition: `height ${DUR} ${EASE}, opacity ${DUR} ${EASE}`,
                }}
              />
              <div
                className="overflow-hidden"
                style={{
                  maxWidth: c ? 0 : 90,
                  opacity: c ? 0 : 1,
                  transition: `max-width ${DUR} ${EASE}, opacity ${DUR} ${EASE}`,
                }}
              >
                <Field label="Who" value={vWho} onChange={setWho} width="w-[60px]" collapsed={c} />
              </div>

              <button
                type="submit"
                aria-label="Search"
                className="grid flex-shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep"
                style={{ width: c ? 32 : 40, height: c ? 32 : 40, transition: `width ${DUR} ${EASE}, height ${DUR} ${EASE}` }}
              >
                <Icon name="search" size={c ? 15 : 19} />
              </button>
            </form>
          </div>

          {/* spacer pushes the account to the far right — logo|search ——— avatar */}
          <div className="flex-1" />

          {/* account — right, scales down on collapse */}
          <div
            className="flex flex-shrink-0 items-center"
            style={{ transform: c ? 'scale(0.86)' : 'scale(1)', transformOrigin: 'right center', transition: `transform ${DUR} ${EASE}` }}
          >
            <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-brand font-display text-[16px] font-bold text-white">
              O
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
