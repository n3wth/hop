import AppShell from '@/components/AppShell'

// Route-level loading UI for the confirmation page. Shown while the Server
// Component verifies ownership and fetches the order from Duffel. Mirrors the
// confirmed layout — teal hero, itinerary, total — so the real card swaps in
// without a layout shift.
function Bar({ className }: { className?: string }) {
  return <span className={`hop-skeleton block rounded-[6px] ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <AppShell hideSearch>
      <div className="mx-auto max-w-[680px] pb-4 pt-8 sm:pt-12">
        <section
          className="overflow-hidden rounded-[20px] lg:rounded-[24px]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div className="px-6 py-9 sm:px-10">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/15 ring-1 ring-white/20" />
            <span className="mt-5 block h-[34px] w-[220px] rounded-[6px] bg-white/20" />
            <span className="mt-3 block h-[16px] w-[160px] rounded-[6px] bg-white/15" />
            <span className="mt-6 block h-[64px] w-[180px] rounded-[14px] bg-white/10" />
          </div>
        </section>

        <section className="mt-6 rounded-[16px] border border-border bg-surface p-5 sm:p-6">
          <Bar className="h-[15px] w-[100px]" />
          <div className="mt-4 space-y-4">
            <Bar className="h-[40px] w-full" />
            <Bar className="h-[40px] w-full" />
          </div>
        </section>

        <section className="mt-4 rounded-[16px] border border-border bg-surface p-5 sm:p-6">
          <Bar className="h-[13px] w-[80px]" />
          <Bar className="mt-2 h-[16px] w-[60%]" />
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <Bar className="h-[14px] w-[80px]" />
            <Bar className="h-[24px] w-[100px]" />
          </div>
        </section>
      </div>
    </AppShell>
  )
}
