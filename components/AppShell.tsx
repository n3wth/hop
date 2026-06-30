import type { ReactNode } from 'react'
import TopNav, { type TopNavProps } from './TopNav'

export interface AppShellProps extends TopNavProps {
  children: ReactNode
  /** Full-bleed mode — drops main's horizontal AND bottom padding so a child can
   *  own the whole stage edge-to-edge (e.g. /ask's full-viewport concierge). */
  noPadX?: boolean
}

export default function AppShell({ children, noPadX = false, ...nav }: AppShellProps) {
  return (
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
  )
}
