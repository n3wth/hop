'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Icon, { type IconName } from '@/components/Icon'

interface TabDef {
  href: string
  label: string
  icon: IconName
}

// The five primary surfaces, in journey order. Icons are pulled from the
// existing Phosphor registry (components/Icon.tsx).
const TABS: TabDef[] = [
  { href: '/', label: 'Home', icon: 'house' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/ask', label: 'Ask', icon: 'lightbulb' },
  { href: '/deals', label: 'Deals', icon: 'deals' },
  { href: '/account', label: 'Account', icon: 'person' },
]

// Persistent phone-only bottom tab bar — the signature "this is an app" nav.
// Flat: cream surface, a single top hairline, no shadow/gradient. Sits above
// the home-indicator safe area. Hidden on /ask, where the concierge composer
// owns the bottom edge. Tapping the already-active tab scrolls to the top.
export default function BottomTabBar() {
  const pathname = usePathname()

  // /ask pins its own composer to the bottom — the bar would fight it.
  if (pathname === '/ask') return null

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
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
              className={`hop-press flex flex-1 flex-col items-center justify-center gap-0.5 text-center transition-colors ${
                active ? 'font-semibold text-brand' : 'font-normal text-text3'
              }`}
            >
              <Icon
                name={tab.icon}
                size={20}
                className={`flex-shrink-0 ${active ? 'hop-tab-active' : ''}`}
              />
              <span className="text-[11px] leading-tight">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
