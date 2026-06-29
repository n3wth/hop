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
      <div className="mx-auto max-w-[1440px] px-16 pb-24">{children}</div>
    </div>
  )
}
