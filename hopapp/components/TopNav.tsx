'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'
import { SearchForm, type SearchState } from './SearchBar'

export interface TopNavProps {
  from?: string
  to?: string
  dates?: string
  who?: string
  fromCode?: string
  toCode?: string
  depart?: string
  ret?: string
  adults?: number
}

// Crafted easing — decelerate, ~280ms. One curve drives the whole morph so the
// header, logo, and search contract together as a single motion.
const EASE = 'cubic-bezier(.2,0,0,1)'
const DUR = '280ms'

// Static logo lockup — memoized so scroll-state toggles never re-render the
// (path-heavy) bunny SVG. Only the wrapper's transform animates.
const LogoLockup = memo(function LogoLockup() {
  // Icon only — the bunny stands alone as the mark (wordmark removed for now).
  return <FlyingBunny size={48} carve="var(--color-bg)" />
})

// Scroll-aware top bar. The header SHRINKS in height on scroll (76→56px) and the
// logo scales down, but the search stays full size and fully editable. Frosted
// backdrop + hairline appear only once scrolled. Degrades to expanded with no JS.
export default function TopNav({
  fromCode = 'SFO',
  toCode = 'LAX',
  dates = 'Jul 9 – 12',
  depart = '2026-07-09',
  ret = '2026-07-12',
  adults = 1,
}: TopNavProps) {
  const initial: SearchState = useMemo(
    () => ({ from: fromCode, to: toCode, depart, ret, adults }),
    [fromCode, toCode, depart, ret, adults],
  )

  const [mobileOpen, setMobileOpen] = useState(false)
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
          backdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          WebkitBackdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          borderBottom: c ? '1px solid var(--color-border)' : '1px solid transparent',
          transform: 'translateZ(0)',
          isolation: 'isolate',
          willChange: c ? 'backdrop-filter' : 'auto',
          transition: `height ${DUR} ${EASE}, background ${DUR} ${EASE}, border-color ${DUR} ${EASE}`,
        }}
      >
        <div className="flex h-full items-center gap-4 px-4 sm:gap-6 sm:px-8 lg:gap-9 lg:px-16">
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

          {/* MOBILE search — a single compact tap pill that opens the full editable search */}
          <button
            type="button"
            aria-label="Edit search"
            onClick={() => setMobileOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 md:hidden"
          >
            <Icon name="search" size={16} className="flex-shrink-0 text-brand" />
            <span className="truncate text-[13px] font-semibold text-text">
              {fromCode} → {toCode}
            </span>
            <span className="ml-1 truncate text-[12px] text-text3">{dates}</span>
          </button>

          {/* DESKTOP search — full editable form, STABLE on scroll so the
              logo↔search gap never shifts and all fields stay visible. */}
          <div className="hidden min-w-0 flex-shrink-0 md:flex">
            <SearchForm initial={initial} variant="desktop" />
          </div>

          {/* spacer pushes the account to the far right (desktop only) */}
          <div className="hidden flex-1 md:block" />

          {/* account — right, scales down on collapse; hidden on mobile to save space */}
          <div
            className="hidden flex-shrink-0 items-center sm:flex"
            style={{ transform: c ? 'scale(0.86)' : 'scale(1)', transformOrigin: 'right center', transition: `transform ${DUR} ${EASE}` }}
          >
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand font-display text-[15px] font-bold text-white sm:h-[42px] sm:w-[42px] sm:text-[16px]">
              O
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE expanded search — solid sheet (no translucency), opens from the pill */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-bg md:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-[17px] font-bold text-text">Edit search</span>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setMobileOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-text2 hover:bg-sunk"
            >
              <span className="text-[22px] leading-none">×</span>
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <SearchForm
              initial={initial}
              variant="mobile"
              onSubmitted={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
