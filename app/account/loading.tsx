import AppShell from '@/components/AppShell'
import { isBillingEnabled } from '@/lib/env'

// Route-level loading UI for /account. Mirrors the real page's hero, nav row,
// and two-column section layout so the real content swaps in with no layout
// shift. Section/pill counts here MUST track app/account/page.tsx's actual
// section list — count them there before changing either file. The billing
// section/pill is driven by the same isBillingEnabled() flag as the real page
// (not a hardcoded guess) so this can't drift when the flag flips.
function Bar({ className }: { className?: string }) {
  return <span className={`hop-skeleton block rounded-[6px] ${className ?? ''}`} />
}

function SectionSkeleton({
  className,
  contentClassName,
  children,
}: {
  className?: string
  contentClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div className={`mt-10 ${className ?? ''}`}>
      <Bar className="h-[18px] w-[160px]" />
      <Bar className="mt-2 h-[14px] w-[85%]" />
      <Bar className="mt-1 h-[14px] w-[55%]" />
      <div className={`mt-4 ${contentClassName ?? ''}`}>{children}</div>
    </div>
  )
}

const NAV_PILLS = [
  '72px', // Knows you
  '88px', // Programs
  '64px', // Status
  '56px', // Trips
  '76px', // Watches
  ...(isBillingEnabled() ? ['52px'] : []), // Plan
  '68px', // What-if
  '72px', // Security
  '92px', // Developers
]

export default function Loading() {
  return (
    <AppShell hideSearch>
      {/* Width MUST match the real page (container-shell) — a narrower
          skeleton reads as a different design and shifts on swap. */}
      <div className="mx-auto max-w-[var(--container-shell)] pb-4 pt-8 sm:pt-12">
        {/* profile hero */}
        <section
          className="overflow-hidden rounded-[var(--radius-lg)] lg:rounded-[var(--radius-hero)]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-10">
            <span className="hop-skeleton-dark grid h-20 w-20 flex-shrink-0 place-items-center rounded-full ring-1 ring-white/20" />
            <div className="min-w-0 flex-1">
              <span className="hop-skeleton-dark block h-[11px] w-[90px] rounded-[6px]" />
              <span className="hop-skeleton-dark mt-3 block h-[28px] w-[200px] rounded-[6px]" />
              <span className="hop-skeleton-dark mt-2 block h-[14px] w-[150px] rounded-[6px]" />
            </div>
            <span className="inline-flex flex-shrink-0 self-start rounded-[12px] border border-white/25 px-5 py-2.5 sm:self-center">
              <span className="hop-skeleton-dark block h-[14px] w-[52px] rounded-[6px]" />
            </span>
          </div>
        </section>

        {/* in-page nav pills — one per real anchor, incl. the flag-gated Plan pill */}
        <nav className="mt-8 flex flex-wrap gap-2 border-b border-hair pb-5">
          {NAV_PILLS.map((w, i) => (
            <span
              key={i}
              className="hop-skeleton block rounded-full"
              style={{ width: w, height: 28 }}
            />
          ))}
        </nav>

        {/* two-column section grid */}
        <div className="mt-12 flex flex-col gap-12 xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-16">
          {/* COLUMN A — travel profile: knows, programs, status, trips (4 sections) */}
          <div>
            <Bar className="h-[11px] w-[120px]" />
            <SectionSkeleton className="mt-6" contentClassName="h-[120px] rounded-[16px] border border-border bg-surface" />
            <SectionSkeleton contentClassName="flex flex-wrap gap-2">
              <Bar className="h-[34px] w-[110px] rounded-full" />
              <Bar className="h-[34px] w-[130px] rounded-full" />
              <Bar className="h-[34px] w-[90px] rounded-full" />
            </SectionSkeleton>
            <SectionSkeleton contentClassName="h-[90px] rounded-[16px] border border-border bg-surface" />
            <SectionSkeleton contentClassName="h-[90px] rounded-[16px] border border-border bg-surface" />
          </div>
          {/* COLUMN B — what hop does: watches, (plan), what-if, security
              + a Developers group (mcp + delete) */}
          <div>
            <Bar className="h-[11px] w-[150px]" />
            <SectionSkeleton className="mt-6" contentClassName="h-[100px] rounded-[16px] border border-border bg-surface" />
            {isBillingEnabled() ? (
              <SectionSkeleton contentClassName="h-[90px] rounded-[16px] border border-border bg-surface" />
            ) : null}
            <SectionSkeleton contentClassName="space-y-3">
              <Bar className="h-[48px] w-full rounded-[12px]" />
              <Bar className="h-[48px] w-full rounded-[12px]" />
            </SectionSkeleton>
            <SectionSkeleton contentClassName="space-y-4">
              <Bar className="h-[48px] w-full rounded-[12px]" />
              <Bar className="h-[48px] w-full rounded-[12px]" />
            </SectionSkeleton>

            <Bar className="mt-14 h-[11px] w-[90px]" />
            <div className="mt-6 h-[58px] rounded-[var(--radius)] border border-border bg-surface" />
            <div className="mt-6 h-[84px] rounded-[var(--radius)] border border-border bg-surface" />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
