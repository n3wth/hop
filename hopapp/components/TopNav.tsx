'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'
import AccountMenu from './AccountMenu'
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
  /** Auth0 session, passed from the server. Null when signed out. */
  user?: { initial: string; name?: string; email?: string; picture?: string } | null
  /** Total points across the user's programs — shown beside the avatar. */
  pointsTotal?: number
  /** Hide the header search (e.g. on the landing page where the hero owns it). */
  hideSearch?: boolean
}

// Crafted easing — decelerate, ~280ms. One curve drives the whole morph so the
// header, logo, and search contract together as a single motion.
const EASE = 'cubic-bezier(.2,0,0,1)'
const DUR = '280ms'

// Static logo lockup — memoized so scroll-state toggles never re-render the
// (path-heavy) bunny SVG. Only the wrapper's transform animates.
const LogoLockup = memo(function LogoLockup() {
  // Icon only — the bunny stands alone as the mark. Links to the home page.
  return (
    <a href="/" aria-label="hop — home" className="flex items-center">
      <FlyingBunny size={41} carve="var(--color-bg)" />
    </a>
  )
})

// 618314 → "618K", 1240000 → "1.2M". Compact points for the header chip.
function compactPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

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
  user = null,
  pointsTotal,
  hideSearch = false,
}: TopNavProps) {
  const initial: SearchState = useMemo(
    () => ({ from: fromCode, to: toCode, depart, ret, adults, oneWay: !ret }),
    [fromCode, toCode, depart, ret, adults],
  )

  const [mobileOpen, setMobileOpen] = useState(false)
  // Mobile menu sheet for hideSearch pages (landing, ask, deals, account), where
  // the desktop nav + account block are hidden below their breakpoints. Closed on
  // resize to md / Escape (same guard as the search sheet) so it never strands.
  const [menuOpen, setMenuOpen] = useState(false)
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

  // The mobile search sheet is a full-viewport fixed z-[70] layer. It must never
  // outlive the mobile context: once the viewport reaches md (where the sheet is
  // display:none and the pill that opens it disappears) a stuck-open sheet would
  // sit invisibly over the header and swallow every nav click. Close it on any
  // resize to desktop, and on Escape, so it can never get stranded over the nav.
  useEffect(() => {
    if (!mobileOpen) return
    const mq = window.matchMedia('(min-width: 768px)')
    const close = () => setMobileOpen(false)
    if (mq.matches) {
      close()
      return
    }
    mq.addEventListener('change', close)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      mq.removeEventListener('change', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  // The mobile search sheet is a full-viewport fixed z-[70] layer. It must never
  // outlive the mobile context: once the viewport reaches md (where the sheet is
  // display:none and the pill that opens it disappears) a stuck-open sheet would
  // sit invisibly over the header and swallow every nav click. Close it on any
  // resize to desktop, and on Escape, so it can never get stranded.
  useEffect(() => {
    if (!mobileOpen) return
    const mq = window.matchMedia('(min-width: 768px)')
    const close = () => setMobileOpen(false)
    if (mq.matches) {
      close()
      return
    }
    mq.addEventListener('change', close)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      mq.removeEventListener('change', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  // Same stranding guard as the search sheet: close the menu on resize to md (its
  // trigger is md:hidden) and on Escape, so it can never sit invisibly over the nav.
  useEffect(() => {
    if (!menuOpen) return
    const mq = window.matchMedia('(min-width: 768px)')
    const close = () => setMenuOpen(false)
    if (mq.matches) {
      close()
      return
    }
    mq.addEventListener('change', close)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      mq.removeEventListener('change', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

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
          {/* logo — left. Stays the SAME size whether at top or scrolled; only its
              vertical position shifts as the header height contracts (76→56px). */}
          <div className="flex flex-shrink-0 items-center gap-[11px]">
            <LogoLockup />
          </div>

          {/* Search lives in the header on results pages; pages that hide it
              (landing, deals, ask, account — hero owns search there) get nav
              links to the other main pages instead of a blank gap. */}
          {hideSearch ? (
            <>
              <nav className="-ml-4 hidden items-center gap-1 md:flex sm:-ml-5 lg:-ml-7">
                <a href="/search" className="hop-nav-link rounded-full px-3.5 py-2 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk hover:text-text">
                  Search
                </a>
                <a href="/deals" className="hop-nav-link rounded-full px-3.5 py-2 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk hover:text-text">
                  Deals
                </a>
                <a href="/ask" className="hop-nav-link rounded-full px-3.5 py-2 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk hover:text-text">
                  Ask
                </a>
              </nav>
              <div className="flex-1" />
              {/* MOBILE affordance — on hideSearch pages the nav links (md:flex)
                  and the account block (sm:flex) are both hidden below their
                  breakpoints, leaving the header with nothing actionable on a
                  phone. This hamburger (visible <md) opens the menu sheet so Sign
                  in / nav are always reachable at 390px. */}
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-border bg-surface text-text2 transition-colors hover:bg-sunk md:hidden"
              >
                <Icon name="menu" size={20} />
              </button>
            </>
          ) : (
            <>
              {/* MOBILE search — compact tap pill that opens the full editable search */}
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

              {/* DESKTOP search — full editable form, stable on scroll */}
              <div className="hidden min-w-0 flex-shrink-0 md:flex">
                <SearchForm initial={initial} variant="desktop" scrolled={c} />
              </div>
            </>
          )}

          {/* spacer pushes the account to the far right (desktop only) */}
          <div className="hidden flex-1 md:block" />

          {/* account — Auth0: avatar+logout when signed in, Sign in when out */}
          <div
            className="hidden flex-shrink-0 items-center sm:flex"
            style={{ transform: c ? 'scale(0.86)' : 'scale(1)', transformOrigin: 'right center', transition: `transform ${DUR} ${EASE}` }}
          >
            {user ? (
              <div className="flex items-center gap-3">
                {pointsTotal != null ? (
                  <a
                    href="/account"
                    title="Your points"
                    className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-2 transition-colors hover:bg-sunk lg:flex"
                  >
                    <span className="font-display text-[14px] font-semibold tabular-nums text-text">
                      {compactPoints(pointsTotal)}
                    </span>
                    <span className="text-[12px] font-medium text-text3">pts</span>
                  </a>
                ) : null}
                <AccountMenu user={user} />
              </div>
            ) : (
              <a
                href="/auth/login"
                className="hop-interactive hop-press rounded-full border border-border bg-surface px-5 py-2.5 text-[14px] font-semibold text-text hover:bg-sunk hover:border-brand-mint-deep"
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      {/* MOBILE expanded search — solid sheet (no translucency), opens from the pill */}
      {mobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit search"
          className="fixed inset-0 z-[70] flex flex-col bg-bg md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-[17px] font-semibold text-text">Edit search</span>
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

      {/* MOBILE menu — solid sheet for hideSearch pages, so Sign in + nav are
          always reachable at 390px (the desktop nav/account are hidden below md/sm). */}
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[70] flex flex-col bg-bg md:hidden"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="font-display text-[17px] font-semibold text-text">Menu</span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="grid h-9 w-9 place-items-center rounded-full text-text2 hover:bg-sunk"
            >
              <span className="text-[22px] leading-none">×</span>
            </button>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            <a href="/search" onClick={() => setMenuOpen(false)} className="hop-menu-item hop-interactive rounded-[12px] px-4 py-3 text-[16px] font-semibold text-text hover:bg-sunk">
              Search
            </a>
            <a href="/deals" onClick={() => setMenuOpen(false)} className="hop-menu-item hop-interactive rounded-[12px] px-4 py-3 text-[16px] font-semibold text-text hover:bg-sunk">
              Deals
            </a>
            <a href="/ask" onClick={() => setMenuOpen(false)} className="hop-menu-item hop-interactive rounded-[12px] px-4 py-3 text-[16px] font-semibold text-text hover:bg-sunk">
              Ask
            </a>
          </nav>
          <div className="mt-auto border-t border-border p-4">
            {user ? (
              <a href="/account" onClick={() => setMenuOpen(false)} className="flex items-center justify-center rounded-full border border-border bg-surface px-5 py-3 text-[15px] font-semibold text-text transition-colors hover:bg-sunk">
                Your account
              </a>
            ) : (
              <a href="/auth/login" className="flex items-center justify-center rounded-full bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep">
                Sign in
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}
