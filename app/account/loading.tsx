import AppShell from '@/components/AppShell'

// Route-level loading UI for /account. Mirrors the real page's hero, nav row,
// and two-column section layout so the real content swaps in with no layout shift.
function Bar({ className }: { className?: string }) {
  return <span className={`hop-skeleton block rounded-[6px] ${className ?? ''}`} />
}

function SectionSkeleton({
  contentClassName,
  children,
}: {
  contentClassName?: string
  children?: React.ReactNode
}) {
  return (
    <div className="mt-10 first:mt-6">
      <Bar className="h-[11px] w-[90px]" />
      <Bar className="mt-3 h-[18px] w-[160px]" />
      <Bar className="mt-2 h-[14px] w-[85%]" />
      <Bar className="mt-1 h-[14px] w-[55%]" />
      <div className={`mt-4 ${contentClassName ?? ''}`}>{children}</div>
    </div>
  )
}

export default function Loading() {
  return (
    <AppShell hideSearch>
      <div className="mx-auto max-w-[var(--container-sm)] pb-4 pt-8 sm:pt-12">
        {/* profile hero */}
        <section
          className="overflow-hidden rounded-[20px] lg:rounded-[24px]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-10">
            <span className="grid h-20 w-20 flex-shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/20" />
            <div className="min-w-0 flex-1">
              <span className="block h-[11px] w-[90px] rounded-[6px] bg-white/15" />
              <span className="mt-3 block h-[28px] w-[200px] rounded-[6px] bg-white/20" />
              <span className="mt-2 block h-[14px] w-[150px] rounded-[6px] bg-white/15" />
            </div>
            <span className="inline-flex flex-shrink-0 self-start rounded-[12px] border border-white/25 px-5 py-2.5 sm:self-center">
              <span className="block h-[14px] w-[52px] rounded-[6px] bg-white/20" />
            </span>
          </div>
        </section>

        {/* in-page nav pills */}
        <nav className="mt-8 flex flex-wrap gap-2 border-b border-hair pb-5">
          {['72px', '88px', '64px', '56px', '76px', '68px', '92px'].map((w, i) => (
            <span
              key={i}
              className="hop-skeleton block rounded-full"
              style={{ width: w, height: 28 }}
            />
          ))}
        </nav>

        {/* two-column section grid */}
        <div className="mt-12 grid grid-cols-1 items-start gap-x-12 xl:grid-cols-2">
          <div>
            <SectionSkeleton contentClassName="h-[120px] rounded-[16px] border border-border bg-surface" />
            <SectionSkeleton contentClassName="flex flex-wrap gap-2">
              <Bar className="h-[34px] w-[110px] rounded-full" />
              <Bar className="h-[34px] w-[130px] rounded-full" />
              <Bar className="h-[34px] w-[90px] rounded-full" />
            </SectionSkeleton>
            <SectionSkeleton contentClassName="h-[90px] rounded-[16px] border border-border bg-surface" />
          </div>
          <div className="mt-14 xl:mt-0">
            <SectionSkeleton contentClassName="space-y-3">
              <Bar className="h-[48px] w-full rounded-[12px]" />
              <Bar className="h-[48px] w-full rounded-[12px]" />
            </SectionSkeleton>
            <SectionSkeleton contentClassName="h-[100px] rounded-[16px] border border-border bg-surface" />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
