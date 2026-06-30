import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
import TopNav, { type TopNavProps } from './TopNav'
import { OriginProvider, ORIGIN_STORAGE_KEY } from '@/lib/origin-context'

export interface AppShellProps extends TopNavProps {
  children: ReactNode
  /** Full-bleed mode — drops main's horizontal AND bottom padding so a child can
   *  own the whole stage edge-to-edge (e.g. /ask's full-viewport concierge). */
  noPadX?: boolean
}

export default async function AppShell({ children, noPadX = false, ...nav }: AppShellProps) {
  // Seed the persistent departure origin from its cookie so the selector + every
  // surface render the user's "where from" on the first paint (no client flash).
  // cookies() is async in Next 16.
  const cookieStore = await cookies()
  const initialOrigin = cookieStore.get(ORIGIN_STORAGE_KEY)?.value ?? null

  return (
    <OriginProvider initialOrigin={initialOrigin}>
      <div className="relative">
        <a
          href="#main"
          className="sr-only rounded-[12px] bg-brand px-4 py-2 text-[14px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[80]"
        >
          Skip to content
        </a>
        <TopNav {...nav} />
        <main id="main" className={noPadX ? '' : 'px-4 pb-24 sm:px-8 lg:px-16'}>
          {children}
        </main>
      </div>
    </OriginProvider>
  )
}
