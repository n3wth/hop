import type { ReactNode } from 'react'
import TopNav, { type TopNavProps } from './TopNav'

export interface AppShellProps extends TopNavProps {
  children: ReactNode
}

// Page shell: scroll-aware sticky TopNav (logo + search/account) over the
// content. No fake-masthead theatrics — trip context is a page sub-header
// rendered above the hero by the page itself.
export default function AppShell({ children, ...nav }: AppShellProps) {
  return (
    <div className="relative">
      {/* Skip link (WCAG 2.4.1) — visually hidden until focused, then it lands
          on-canvas so keyboard users can jump past the nav to the content. */}
      <a
        href="#main"
        className="sr-only rounded-[12px] bg-brand px-4 py-2 text-[14px] font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-[80]"
      >
        Skip to content
      </a>
      <TopNav {...nav} />
      <main id="main" className="px-4 pb-24 sm:px-8 lg:px-16">
        {children}
      </main>
    </div>
  )
}
