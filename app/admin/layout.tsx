import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOwnerSession } from '@/lib/owner'
import { auth0 } from '@/lib/auth0'
import { toNavUser } from '@/lib/nav-user'
import Logo from '@/components/Logo'
import AccountMenu from '@/components/AccountMenu'
import AdminNav from '@/components/admin/AdminNav'

// The admin app shell. Unlike the site surfaces (AppShell + TopNav), admin is
// laid out like an app — a fixed sidebar rail on desktop, a compact bar + pill
// nav on mobile — in the same flat-editorial language (tokens, hairlines, no
// shadows). Owner-gated here in addition to each page's own notFound gate
// (defense in depth; the layout gate keeps non-owners from ever seeing chrome).
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const owner = await getOwnerSession()
  if (!owner) notFound()

  const session = await auth0.getSession()
  const user = toNavUser(session?.user)

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <aside className="border-b border-hair bg-paper lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-4 lg:px-5">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 text-text transition-colors hover:text-brand"
          >
            <Logo size={22} />
            <span className="font-display text-[15px] font-semibold tracking-[-0.01em]">
              hop <span className="font-medium text-text3">admin</span>
            </span>
          </Link>
          {/* Mobile: the account menu lives in the bar; desktop uses the rail footer. */}
          <div className="lg:hidden">{user ? <AccountMenu user={user} /> : null}</div>
        </div>

        <AdminNav />

        {/* Rail footer — who's operating, and the way out. Initial-only avatar
            (server-rendered; no client error-fallback needed for a 404 gravatar). */}
        <div className="hidden border-t border-hair px-5 py-4 lg:flex lg:items-center lg:gap-3">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand font-display text-[13px] font-semibold text-white">
            {user?.initial ?? 'O'}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold text-text">
              {user?.name ?? owner.email}
            </div>
            <a
              href="/auth/logout"
              className="text-[11.5px] font-medium text-text3 transition-colors hover:text-text"
            >
              Log out
            </a>
          </div>
        </div>
      </aside>

      <main className="min-w-0">{children}</main>
    </div>
  )
}
