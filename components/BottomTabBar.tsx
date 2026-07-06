'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Icon, { type IconName } from '@/components/Icon'
import Logo from '@/components/Logo'

interface TabDef {
  href: string
  label: string
  /** Phosphor icon, or undefined for the Home tab, which renders the bunny mark. */
  icon?: IconName
}

// The five primary surfaces, in journey order. Home carries the hop bunny —
// with the top nav hidden on phones, this is the brand mark on mobile.
const TABS: TabDef[] = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/ask', label: 'Ask', icon: 'lightbulb' },
  { href: '/deals', label: 'Deals', icon: 'deals' },
  { href: '/account', label: 'Account', icon: 'person' },
]

// Persistent phone-only bottom tab bar — the signature "this is an app" nav.
// Glass: translucent cream + blur/saturate (matches the scrolled top nav's
// treatment — nav chrome is the one approved spot for glassmorphism), a
// single top hairline, no shadow/gradient/glow. Sits above the home-indicator
// safe area. Icon-only (labels live in aria-label); shown on EVERY page
// including /ask, whose stage height makes room for it (globals.css
// .hop-ask-stage). Tapping the already-active tab scrolls to the top.
export default function BottomTabBar() {
  const pathname = usePathname()

  const isActive = (href: string): boolean => {
    if (href === '/') return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  const onTap = (href: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive(href)) return
    // Already here → native "tap active tab = back to top".
    e.preventDefault()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }

  return (
    <nav
      aria-label="Primary"
      className="hop-glass-surface fixed inset-x-0 bottom-0 z-40 border-t border-border md:hidden"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      }}
    >
      <div className="flex h-14 items-stretch justify-around">
        {TABS.map((tab) => {
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={(e) => onTap(tab.href, e)}
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              className={`hop-press flex flex-1 items-center justify-center transition-colors ${
                active ? 'text-brand' : 'text-text3'
              }`}
            >
              {tab.icon ? (
                <Icon
                  name={tab.icon}
                  size={24}
                  className={`flex-shrink-0 ${active ? 'hop-tab-active' : ''}`}
                />
              ) : (
                <Logo
                  size={26}
                  carve="var(--color-bg)"
                  className={`flex-shrink-0 ${active ? 'hop-tab-active' : ''}`}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
