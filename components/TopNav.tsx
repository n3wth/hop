'use client'

import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Icon from './Icon'
import FlyingBunny from './FlyingBunny'
import AccountMenu from './AccountMenu'
import OriginSelector from './OriginSelector'
import { SearchForm, type SearchState, type Cabin } from './SearchBar'
import { isoOffset } from '@/lib/dates'

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
  /** Optional passenger mix + cabin so the header search restates the trip. */
  childrenCount?: number
  infants?: number
  cabin?: Cabin
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
    <Link href="/" aria-label="hop — home" className="flex items-center">
      <FlyingBunny size={41} carve="var(--color-bg)" />
    </Link>
  )
})

// 618314 → "618K", 1240000 → "1.2M". Compact points for the header chip.
function compactPoints(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// One sheet controller for both mobile overlays (search + menu). When open it:
// locks body scroll, moves focus into the dialog, traps Tab within it, closes
// on Escape, and closes on resize to md (where the trigger/sheet vanish — a
// stranded sheet would swallow nav clicks). Returns the dialog ref to attach.
function useSheet(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    // Close immediately (and bail) if we're already at desktop.
    const mq = window.matchMedia('(min-width: 768px)')
    if (mq.matches) {
      close()
      return
    }

    const node = ref.current

    // Lock background scroll while the full-viewport sheet is up.
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog (first focusable, else the dialog itself).
    const focusables = node?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables?.[0]
    ;(first ?? node)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        return
      }
      if (e.key !== 'Tab' || !node) return
      // Trap Tab within the dialog's focusable set.
      const items = node.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (items.length === 0) return
      const firstEl = items[0]
      const lastEl = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && active === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    mq.addEventListener('change', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      mq.removeEventListener('change', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return ref
}

// Scroll-aware top bar. The header SHRINKS in height on scroll (76→56px) and the
// logo scales down, but the search stays full size and fully editable. Frosted
// backdrop + hairline appear only once scrolled. Degrades to expanded with no JS.
export default function TopNav({
  fromCode = 'SFO',
  toCode = 'LAX',
  dates = 'Jul 9 – 12',
  depart,
  ret,
  adults = 1,
  childrenCount = 0,
  infants = 0,
  cabin = 'economy',
  user = null,
  pointsTotal,
  hideSearch = false,
}: TopNavProps) {
  const pathname = usePathname()

  // Default seeded dates are relative to today (depart ≈ +10d, return ≈ +3d
  // after) so the header search never opens onto a stale, un-searchable trip.
  const seedDepart = depart ?? isoOffset(10)
  const seedRet = ret ?? isoOffset(13)

  const initial: SearchState = useMemo(
    () => ({
      from: fromCode,
      to: toCode,
      depart: seedDepart,
      ret: seedRet,
      adults,
      children: childrenCount,
      infants,
      cabin,
      oneWay: !seedRet,
    }),
    [fromCode, toCode, seedDepart, seedRet, adults, childrenCount, infants, cabin],
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

  // Both mobile sheets share one controller: scroll-lock + focus-into + Tab-trap
  // + Esc + close-on-resize-to-md (a stranded full-viewport sheet would swallow
  // nav clicks). The returned ref is attached to each dialog.
  const searchSheetRef = useSheet(mobileOpen, () => setMobileOpen(false))
  const menuSheetRef = useSheet(menuOpen, () => setMenuOpen(false))

  // returnTo on the sign-in links: after auth, Auth0 lands the user back where
  // they were rather than dumping them on the home page.
  const returnTo = `?returnTo=${encodeURIComponent(pathname || '/')}`
  const signInHref = `/auth/login${returnTo}`

  // Active-route helper for aria-current on the desktop/mobile nav links.
  const isActive = (href: string) => pathname === href

  const c = scrolled // collapsed

  return (
    <>
      {/* sentinel: while visible we're at the top (expanded) */}
      <div ref={sentinelRef} aria-hidden className="absolute left-0 top-0 h-px w-px" />

      <header
        className="sticky top-0 z-50"
        style={{
          height: 72,
          background: c ? 'color-mix(in srgb, var(--color-bg) 80%, transparent)' : 'transparent',
          backdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          WebkitBackdropFilter: c ? 'blur(10px) saturate(120%)' : 'none',
          borderBottom: c ? '1px solid var(--color-border)' : '1px solid transparent',
          transform: 'translateZ(0)',
          isolation: 'isolate',
          willChange: c ? 'backdrop-filter' : 'auto',
          transition: `background ${DUR} ${EASE}, border-color ${DUR} ${EASE}`,
        }}
      >
        <div className="h-full px-4 sm:px-8 lg:px-16">
        <div className="mx-auto flex h-full max-w-[1180px] items-center gap-4 sm:gap-6 lg:gap-9">
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
              <nav className="-ml-2 hidden items-center gap-1 md:flex sm:-ml-2 lg:-ml-3">
                {[
                  { href: '/search', label: 'Search' },
                  { href: '/deals', label: 'Deals' },
                  { href: '/ask', label: 'Ask' },
                ].map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    aria-current={isActive(l.href) ? 'page' : undefined}
                    className={
                      isActive(l.href)
                        ? 'rounded-full bg-sunk px-3.5 py-2 text-[14px] font-semibold text-text2'
                        : 'rounded-full px-3.5 py-2 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk'
                    }
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="flex-1 md:hidden" />
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

              {/* MOBILE affordance (<sm) — on search/results pages the account
                  block is hidden below sm and this branch has no hamburger, so a
                  signed-in phone user couldn't reach their account and never saw a
                  nav. Opens the same menu sheet (nav + account / Sign in). At ≥sm
                  the account block itself is visible, so this hides. */}
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
                className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border border-border bg-surface text-text2 transition-colors hover:bg-sunk sm:hidden"
              >
                <Icon name="menu" size={20} />
              </button>
            </>
          )}

          {/* spacer pushes the right cluster to the far edge (desktop only) */}
          <div className="hidden flex-1 md:block" />

          {/* right cluster — origin + account sit together as one tidy group so
              the gap between them is a single small step, not the wide header gap. */}
          <div className="flex items-center gap-1.5 lg:gap-2">
          {/* persistent "where from" — hidden below md so the phone header stays
              uncrowded (the menu sheet carries it there). */}
          <div className="hidden flex-shrink-0 md:block">
            <OriginSelector />
          </div>

          {/* account — Auth0: avatar+logout when signed in, Sign in when out.
              No scroll scaling — the bar stays still as you scroll. */}
          <div className="hidden flex-shrink-0 items-center sm:flex">
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
                href={signInHref}
                className="rounded-full border border-text2 px-5 py-2.5 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk"
              >
                Sign in
              </a>
            )}
          </div>
          </div>
        </div>
        </div>
      </header>

      {/* MOBILE expanded search — solid sheet (no translucency), opens from the pill */}
      {mobileOpen && (
        <div
          ref={searchSheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Edit search"
          tabIndex={-1}
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
              <Icon name="close" size={20} />
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
          ref={menuSheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          tabIndex={-1}
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
              <Icon name="close" size={20} />
            </button>
          </div>
          {/* "where from" — reachable on phones where the header selector hides */}
          <div className="border-b border-border px-4 py-3">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text2">
              Where from
            </span>
            <OriginSelector />
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {[
              { href: '/search', label: 'Search' },
              { href: '/deals', label: 'Deals' },
              { href: '/ask', label: 'Ask' },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                aria-current={isActive(l.href) ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
                className={
                  isActive(l.href)
                    ? 'rounded-[12px] bg-sunk px-4 py-3 text-[16px] font-semibold text-text'
                    : 'rounded-[12px] px-4 py-3 text-[16px] font-semibold text-text transition-colors hover:bg-sunk'
                }
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto border-t border-border p-4">
            {user ? (
              <a href="/account" onClick={() => setMenuOpen(false)} className="flex items-center justify-center rounded-full border border-border bg-surface px-5 py-3 text-[15px] font-semibold text-text transition-colors hover:bg-sunk">
                Your account
              </a>
            ) : (
              <a href={signInHref} className="flex items-center justify-center rounded-full bg-brand px-5 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep">
                Sign in
              </a>
            )}
          </div>
        </div>
      )}
    </>
  )
}
