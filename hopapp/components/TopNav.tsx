'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import Logo from './Logo'

export interface TopNavProps {
  /** Display defaults for the search fields / collapsed pill. */
  from?: string
  to?: string
  dates?: string
  who?: string
  /** IATA codes for the compact collapsed pill. */
  fromCode?: string
  toCode?: string
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  width: string
}

function Field({ label, value, onChange, width }: FieldProps) {
  return (
    <label className="flex flex-col justify-center leading-[1.05]">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`bg-transparent text-[15px] font-semibold text-text outline-none ${width}`}
      />
    </label>
  )
}

// Scroll-aware top bar. At the top: full editable search. On scroll: the search
// condenses to a compact clickable pill pinned between the logo and avatar.
// Sticky with a frosted backdrop; hairline border fades in only once scrolled.
// Degrades to fully expanded if JS is off (default state).
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
  // When the user clicks the collapsed pill, force-expand until they scroll again.
  const [forceOpen, setForceOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        setScrolled(!entry.isIntersecting)
        if (entry.isIntersecting) setForceOpen(false)
      },
      { rootMargin: '0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const collapsed = scrolled && !forceOpen

  return (
    <>
      {/* sentinel: while visible we're at the top (expanded) */}
      <div ref={sentinelRef} aria-hidden className="absolute left-0 top-0 h-px w-px" />

      <header
        className="sticky top-0 z-50 transition-colors duration-200"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--color-bg) 78%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px) saturate(140%)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px) saturate(140%)' : 'none',
          borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
        }}
      >
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-16 py-[18px]">
          {/* logo — pinned left */}
          <div className="flex flex-shrink-0 items-center gap-3">
            <Logo size={46} carve="var(--color-bg)" className="text-brand" />
            <span className="font-display text-[28px] font-bold tracking-[-0.04em] text-text">
              hop
            </span>
          </div>

          {/* search: full fields ↔ compact pill (smooth width/opacity, no lift) */}
          <div className="relative flex flex-1 justify-center px-6">
            {/* full search */}
            <form
              className="flex items-center gap-4 rounded-full border border-border bg-surface py-[10px] pl-[22px] pr-3 transition-all duration-300"
              style={{
                opacity: collapsed ? 0 : 1,
                transform: collapsed ? 'scale(0.96)' : 'scale(1)',
                pointerEvents: collapsed ? 'none' : 'auto',
                position: collapsed ? 'absolute' : 'static',
              }}
              aria-hidden={collapsed}
            >
              <Field label="From" value={vFrom} onChange={setFrom} width="w-[112px]" />
              <span className="text-brand">
                <Icon name="swap_horiz" size={20} />
              </span>
              <Field label="To" value={vTo} onChange={setTo} width="w-[96px]" />
              <span className="h-[26px] w-px bg-border" />
              <Field label="Dates" value={vDates} onChange={setDates} width="w-[78px]" />
              <span className="h-[26px] w-px bg-border" />
              <Field label="Who" value={vWho} onChange={setWho} width="w-[60px]" />
              <button
                type="submit"
                aria-label="Search"
                className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep"
              >
                <Icon name="search" size={19} />
              </button>
            </form>

            {/* compact pill */}
            <button
              type="button"
              onClick={() => setForceOpen(true)}
              aria-hidden={!collapsed}
              tabIndex={collapsed ? 0 : -1}
              className="flex items-center gap-3 rounded-full border border-border bg-surface py-[10px] pl-5 pr-[14px] text-[14px] font-semibold text-text transition-all duration-300 hover:bg-sunk"
              style={{
                opacity: collapsed ? 1 : 0,
                transform: collapsed ? 'scale(1)' : 'scale(0.96)',
                pointerEvents: collapsed ? 'auto' : 'none',
                position: collapsed ? 'static' : 'absolute',
              }}
            >
              <span className="tabular-nums">{fromCode}</span>
              <Icon name="swap_horiz" size={16} className="text-brand" />
              <span className="tabular-nums">{toCode}</span>
              <span className="h-[18px] w-px bg-border" />
              <span className="font-medium text-text2">{vDates}</span>
              <span className="grid h-7 w-7 place-items-center rounded-full bg-brand text-white">
                <Icon name="search" size={15} />
              </span>
            </button>
          </div>

          {/* account — pinned right */}
          <div className="flex flex-shrink-0 items-center">
            <div className="grid h-[42px] w-[42px] place-items-center rounded-full bg-brand font-display text-[16px] font-bold text-white">
              O
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
