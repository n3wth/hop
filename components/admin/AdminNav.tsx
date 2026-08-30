'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon, { type IconName } from '@/components/Icon'

// The admin sidebar's navigation. Client-only for the active-route highlight
// and the mobile menu's open state; everything else in the shell stays
// server-rendered. Desktop (lg+) is an always-visible vertical rail. Mobile
// is a compact "current section" button that opens a dropdown panel listing
// every surface — a plain horizontal scroller doesn't work here because the
// admin section has grown past what fits in one row with no scroll
// affordance, silently hiding Content/Agents/Team/Ops off-screen.

interface Item {
  href: string
  label: string
  icon: IconName
  /** Match exactly (the /admin index) instead of by prefix. */
  exact?: boolean
}

const SURFACES: Item[] = [
  { href: '/admin', label: 'Overview', icon: 'chart', exact: true },
  { href: '/admin/users', label: 'Users', icon: 'person' },
  { href: '/admin/billing', label: 'Billing', icon: 'currency' },
  { href: '/admin/support', label: 'Inbox', icon: 'envelope' },
  { href: '/admin/content', label: 'Content', icon: 'content_copy' },
  { href: '/admin/agents', label: 'Agents', icon: 'compass' },
  { href: '/admin/team', label: 'Team', icon: 'team' },
  { href: '/admin/ops', label: 'Ops', icon: 'settings' },
]

// Read-only jumps out of the admin app — the public surfaces the numbers
// come from. Kept visually quieter than the ops surfaces above.
const SHORTCUTS: Item[] = [
  { href: '/stats', label: 'Trust stats', icon: 'trending_up' },
  { href: '/', label: 'View site', icon: 'globe' },
]

function NavLink({
  item,
  active,
  onNavigate,
  compact,
}: {
  item: Item
  active: boolean
  onNavigate?: () => void
  compact?: boolean
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
        compact ? 'w-full' : ''
      } ${active ? 'bg-sunk text-text' : 'text-text2 hover:bg-sunk hover:text-text'}`}
    >
      <Icon name={item.icon} size={16} />
      {item.label}
    </Link>
  )
}

export default function AdminNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Close the mobile panel on navigation (including browser back/forward),
  // without the cascading-render cost of an effect keyed on pathname — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [lastPathname, setLastPathname] = useState(pathname)
  if (pathname !== lastPathname) {
    setLastPathname(pathname)
    setOpen(false)
  }
  const rootRef = useRef<HTMLDivElement>(null)

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  const activeSurface = SURFACES.find(isActive) ?? SURFACES[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative lg:contents">
      {/* Mobile/tablet: compact current-section button that opens the panel below. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Admin sections"
        className="flex w-full items-center justify-between gap-2 border-t border-hair px-4 py-3 text-[13.5px] font-semibold text-text transition-colors hover:bg-sunk lg:hidden"
      >
        <span className="flex items-center gap-2.5">
          <Icon name={activeSurface.icon} size={16} className="text-text3" />
          {activeSurface.label}
        </span>
        <Icon name={open ? 'close' : 'menu'} size={16} className="text-text3" />
      </button>

      {open ? (
        <nav
          aria-label="Admin"
          className="absolute inset-x-0 top-full z-50 flex flex-col gap-1 border-b border-hair bg-paper px-3 pb-3 pt-2 lg:hidden"
        >
          {SURFACES.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item)}
              onNavigate={() => setOpen(false)}
              compact
            />
          ))}

          <div className="my-2 h-px bg-hair" role="presentation" />

          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[var(--track-eyebrow)] text-text3">
            Shortcuts
          </p>

          {SHORTCUTS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium text-text3 transition-colors hover:bg-sunk hover:text-text"
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Desktop: always-visible vertical rail. */}
      <nav aria-label="Admin" className="hidden lg:flex lg:flex-1 lg:flex-col lg:pt-1">
        {SURFACES.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item)} />
        ))}

        <div className="mx-3 my-3 h-px bg-hair" role="presentation" />

        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[var(--track-eyebrow)] text-text3">
          Shortcuts
        </p>

        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13px] font-medium text-text3 transition-colors hover:bg-sunk hover:text-text"
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
