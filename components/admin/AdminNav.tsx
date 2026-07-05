'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Icon, { type IconName } from '@/components/Icon'

// The admin sidebar's navigation. Client-only for the active-route highlight;
// everything else in the shell stays server-rendered. Horizontal pill row on
// mobile, vertical rail on lg+. Hover is color-only per the design canon.

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
  { href: '/admin/support', label: 'Inbox', icon: 'envelope' },
  { href: '/admin/content', label: 'Content', icon: 'content_copy' },
  { href: '/admin/agents', label: 'Agents', icon: 'compass' },
  { href: '/admin/ops', label: 'Ops', icon: 'settings' },
]

// Read-only jumps out of the admin app — the public surfaces the numbers
// come from. Kept visually quieter than the ops surfaces above.
const SHORTCUTS: Item[] = [
  { href: '/stats', label: 'Trust stats', icon: 'trending_up' },
  { href: '/', label: 'View site', icon: 'globe' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <nav
      aria-label="Admin"
      className="flex items-center gap-1 overflow-x-auto px-3 pb-3 lg:flex-1 lg:flex-col lg:items-stretch lg:overflow-visible lg:pb-0 lg:pt-1"
    >
      {SURFACES.map((item) => {
        const active = isActive(item)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-shrink-0 items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
              active ? 'bg-sunk text-text' : 'text-text2 hover:bg-sunk hover:text-text'
            }`}
          >
            <Icon name={item.icon} size={16} />
            {item.label}
          </Link>
        )
      })}

      <div className="mx-3 hidden h-px bg-hair lg:my-3 lg:block" role="presentation" />

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
  )
}
