import type { ReactNode } from 'react'

export interface AppShellProps {
  logoCell: ReactNode
  topbar: ReactNode
  rail: ReactNode
  children: ReactNode
}

// CSS grid per v9: two columns (square | rest), two rows (square | rest).
//   logo  | topbar
//   rail  | stage(children)
export default function AppShell({ logoCell, topbar, rail, children }: AppShellProps) {
  return (
    <div
      className="grid h-screen"
      style={{
        gridTemplateColumns: 'var(--spacing-sq) 1fr',
        gridTemplateRows: 'var(--spacing-sq) 1fr',
      }}
    >
      {/* logo cell — top-left square: teal bunny on white surface, hairline right + bottom */}
      <div className="col-start-1 row-start-1 flex h-sq w-sq items-center justify-center border-b border-r border-border bg-surface text-brand">
        {logoCell}
      </div>

      {/* topbar — right of logo, square tall */}
      <div className="col-start-2 row-start-1 flex h-sq items-stretch border-b border-border bg-surface">
        {topbar}
      </div>

      {/* rail — below logo, square wide */}
      <div className="col-start-1 row-start-2 border-r border-border">{rail}</div>

      {/* stage — scrollable main */}
      <main className="col-start-2 row-start-2 overflow-auto">{children}</main>
    </div>
  )
}
