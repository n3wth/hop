import Link from 'next/link'
import type { ReactNode } from 'react'

export interface AdminCrumb {
  label: string
  href?: string
}

/** Shared page chrome for /admin surfaces — breadcrumbs, title, actions. */
export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">{children}</div>
  )
}

export default function AdminPageHeader({
  title,
  description,
  crumbs = [{ label: 'Admin', href: '/admin' }],
  actions,
}: {
  title: string
  description?: ReactNode
  crumbs?: AdminCrumb[]
  actions?: ReactNode
}) {
  return (
    <header className="border-b border-hair pb-6">
      {crumbs.length > 0 ? (
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex flex-wrap items-center gap-1 text-[12px] font-medium text-text3"
        >
          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                {i > 0 ? <span aria-hidden className="text-text3/60">/</span> : null}
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} className="transition-colors hover:text-text">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? 'text-text2' : undefined}>{crumb.label}</span>
                )}
              </span>
            )
          })}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">{title}</h1>
          {description ? <div className="mt-1 text-[13px] text-text3">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  )
}
