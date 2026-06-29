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
      <TopNav {...nav} />
      <div className="px-4 pb-24 sm:px-8 lg:px-16">{children}</div>
    </div>
  )
}
