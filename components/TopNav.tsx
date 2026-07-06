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
import { PRIMARY_NAV } from '@/lib/seo-routes'
import { SITE_NAME } from '@/lib/seo'

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
  /** Nonstop-only filter carried over from the search that landed on this page. */
  nonstop?: boolean
  /** Auth0 session, passed from the server. Null when signed out. */
  user?: { id?: string; initial: string; name?: string; email?: string; picture?: string } | null
  /** Total points across the user's programs — shown beside the avatar. */
  pointsTotal?: number
  /** Hide the header search (e.g. on the landing page where the hero owns it). */
  hideSearch?: boolean
  /** True only for the owner (lib/owner.ts) — shows the /admin entry point. */
  isOwner?: boolean
}

// Crafted easing — decelerate, ~280ms. One curve drives the whole morph so the
// header, logo, and search contract together as a single motion.
const EASE = 'cubic-bezier(.2,0,0,1)'
const DUR = '280ms'

// Static logo lockup — memoized so scroll-state toggles never re-render the
// (path-heavy) bunny SVG. Only the wrapper's transform animates.
const LogoLockup = memo(function LogoLockup() {
  // Lockup color matches the nav's bordered controls (the Sign in pill's
  // border-text2/text-text2) so the masthead reads as one quiet system;
  // hover restores the brand flip. Hover is a color flip only (house rule:
  // no hover movement).
  return (
    <Link href="/" aria-label="hop — home" className="group flex items-center gap-[9px]">
      <FlyingBunny
        size={41}
        carve="var(--color-bg)"
        markClassName="text-text2 transition-colors group-hover:text-brand"
      />
      <span className="wordmark text-[19px] leading-none text-text2 transition-colors group-hover:text-brand">
        {SITE_NAME}
      </span>
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
  nonstop = false,
  user = null,
  pointsTotal,
  hideSearch = false,
  isOwner = false,
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
      nonstop,
    }),
    [fromCode, toCode, seedDepart, seedRet, adults, childrenCount, infants, cabin, nonstop],
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

  // Mobile search sheet controller: scroll-lock + focus-into + Tab-trap + Esc +
  // close-on-resize-to-md (a stranded full-viewport sheet would swallow nav
  // clicks). The returned ref is attached to the dialog.
  const searchSheetRef = useSheet(mobileOpen, () => setMobileOpen(false))

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

      {/* Below md the bottom tab bar is the nav: on hideSearch pages the header
          disappears entirely; on search pages it survives only as the slim
          search-pill strip (the pill is the page's primary control, not chrome). */}
      <header
        className={`sticky top-0 z-50 ${hideSearch ? 'hidden md:block' : ''} ${c ? 'hop-glass-surface' : ''}`}
        style={{
          height: 72,
          backdropFilter: c ? 'blur(14px) saturate(140%)' : 'none',
          WebkitBackdropFilter: c ? 'blur(14px) saturate(140%)' : 'none',
          borderBottom: c ? '1px solid var(--color-border)' : '1px solid transparent',
          transform: 'translateZ(0)',
          isolation: 'isolate',
          willChange: c ? 'backdrop-filter' : 'auto',
          transition: `background ${DUR} ${EASE}, border-color ${DUR} ${EASE}, backdrop-filter ${DUR} ${EASE}`,
        }}
      >
        <div className="h-full px-5 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto flex h-full max-w-[var(--container-shell)] items-center gap-4 sm:gap-5 lg:gap-7">
          {/* logo — left. Stays the SAME size whether at top or scrolled; only its
              vertical position shifts as the header height contracts (76→56px).
              Hidden below md — the bottom tab bar's home bunny is the mark there. */}
          <div className="hidden flex-shrink-0 items-center gap-[11px] md:flex">
            <LogoLockup />
          </div>

          {/* Search lives in the header on results pages; pages that hide it
              (landing, deals, ask, account — hero owns search there) get nav
              links to the other main pages instead of a blank gap. */}
          {hideSearch ? (
            <>
              <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex sm:ml-1 lg:ml-2">
                {PRIMARY_NAV.map((l) => (
                  <Link
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
                  </Link>
                ))}
              </nav>
            </>
          ) : (
            <>
              {/* MOBILE search — compact tap pill that opens the full editable
                  search. On phones this pill IS the trip summary (the results
                  page renders no separate route row below lg), so it carries
                  the full context: route → dates → party (when >1). The route
                  never truncates; the dates/party segment ellipsizes first. */}
              <button
                type="button"
                aria-label="Edit search"
                onClick={() => setMobileOpen(true)}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 md:hidden"
              >
                <Icon name="search" size={16} className="flex-shrink-0 text-brand" />
                <span className="flex-shrink-0 text-[13px] font-semibold text-text">
                  {fromCode} → {toCode}
                </span>
                <span className="min-w-0 truncate text-[12px] text-text3">
                  {dates}
                  {adults + childrenCount + infants > 1
                    ? ` · ${adults + childrenCount + infants} travelers`
                    : ''}
                </span>
              </button>

              {/* DESKTOP search — full editable form, stable on scroll */}
              <div className="hidden min-w-0 flex-shrink-0 md:flex">
                <SearchForm initial={initial} variant="desktop" scrolled={c} />
              </div>

            </>
          )}

          {/* spacer pushes the right cluster to the far edge (desktop only).
              Taste call (2026-07, full-width-shell gap fix): this row stays
              at --container-shell width on purpose, matching the rest of
              this bar and the "Chrome aligns with content" decision from the
              full-width 2026 shell PR — this is persistent nav chrome, not a
              content row, and generous open space between the logo/nav and
              the account cluster at wide viewports is standard for
              Airbnb/Linear-class full-bleed headers, not a layout bug.
              (Contrast with RouteBar/PointsPanel below, which ARE content
              rows and got capped back to --container-app because their two
              clusters read as visually related and now sit stranded apart.) */}
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
              No scroll scaling — the bar stays still as you scroll. Below md the
              bottom tab bar's Account tab covers this. */}
          <div className="hidden flex-shrink-0 items-center md:flex">
            {user ? (
              <div className="flex items-center gap-3">
                {isOwner ? (
                  <Link
                    href="/admin"
                    title="Admin"
                    aria-label="Admin"
                    className="hop-ink-border grid h-10 w-10 flex-shrink-0 place-items-center rounded-full border text-text2 transition-colors hover:bg-sunk"
                  >
                    <Icon name="shield" size={20} />
                  </Link>
                ) : null}
                {pointsTotal != null ? (
                  <Link
                    href="/account"
                    title="Your points"
                    className="hop-ink-border hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-text2 transition-colors hover:bg-sunk lg:flex"
                  >
                    <span className="hop-num text-[14px] font-semibold text-text">
                      {compactPoints(pointsTotal)}
                    </span>
                    <span className="text-[12px] font-medium text-text3">pts</span>
                  </Link>
                ) : null}
                <AccountMenu user={user} />
              </div>
            ) : (
              <a
                href={signInHref}
                className="rounded-full border border-text2 px-5 py-2.5 text-[14px] font-semibold text-text2 transition-colors hover:bg-sunk hop-press"
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

    </>
  )
}
