import type { ReactNode } from 'react'
import TopNav, { type TopNavProps } from './TopNav'
import { NavThemeProvider } from './NavTheme'

export interface AppShellProps extends TopNavProps {
  children: ReactNode
  /** Remove horizontal padding from main — used by full-bleed pages like /ask. */
  noPadX?: boolean
}

export default function AppShell({ children, noPadX = false, ...nav }: AppShellProps) {
  return (
    <NavThemeProvider>
      <div className="relative">
        <a
          href="#main"
          className="sr-only rounded-[12px] bg-brand px-4 py-2 text-[14px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[80]"
        >
          Skip to content
        </a>
        <TopNav {...nav} />
        <main id="main" className={noPadX ? 'pb-24' : 'px-4 pb-24 sm:px-8 lg:px-16'}>
          {children}
        </main>
      </div>
    </NavThemeProvider>
  )
}
