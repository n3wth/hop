import AppShell from '@/components/AppShell'

// Route-level loading UI for /book. Next wraps the page in a Suspense boundary
// with this as the fallback while the Server Component re-fetches a fresh offer
// (Duffel offers expire, so the page re-prices server-side, which takes a beat).
// Mirrors the checkout layout — left form column + right itinerary summary — so
// swapping in the real form causes no layout shift.
function Bar({ className }: { className?: string }) {
  return <span className={`hop-skeleton block rounded-[6px] ${className ?? ''}`} />
}

export default function Loading() {
  return (
    <AppShell hideSearch>
      <div className="mx-auto max-w-[1040px] pb-4 pt-8 sm:pt-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
          {/* LEFT — title + passenger card */}
          <div className="min-w-0">
            <Bar className="h-[34px] w-[260px]" />
            <Bar className="mt-3 h-[16px] w-[80%] max-w-[420px]" />

            <div className="mt-8 rounded-[18px] border border-border bg-surface p-6 sm:p-7">
              <div className="mb-6 flex items-center gap-3 border-b border-hair pb-4">
                <span className="hop-skeleton block h-7 w-7 rounded-full" />
                <Bar className="h-[18px] w-[120px]" />
              </div>
              <div className="grid grid-cols-12 gap-x-4 gap-y-5">
                <Bar className="col-span-12 h-[42px] sm:col-span-3" />
                <Bar className="col-span-6 h-[42px] sm:col-span-5" />
                <Bar className="col-span-6 h-[42px] sm:col-span-4" />
                <Bar className="col-span-7 h-[42px] sm:col-span-4" />
                <Bar className="col-span-5 h-[42px] sm:col-span-2" />
                <Bar className="col-span-12 h-[42px] sm:col-span-6" />
                <Bar className="col-span-12 h-[42px]" />
              </div>
            </div>

            <div className="mt-5 rounded-[18px] border border-border bg-surface p-6 sm:p-7">
              <div className="mb-6 flex items-center gap-3 border-b border-hair pb-4">
                <span className="hop-skeleton block h-7 w-7 rounded-full" />
                <Bar className="h-[18px] w-[100px]" />
              </div>
              <Bar className="h-[48px] w-full" />
            </div>

            <Bar className="mt-6 h-[56px] w-full rounded-[13px]" />
          </div>

          {/* RIGHT — itinerary summary */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[18px] border border-border bg-paper p-6">
              <Bar className="h-[12px] w-[100px]" />
              <div className="mt-4 flex items-center gap-3 border-b border-border pb-5">
                <span className="hop-skeleton block h-10 w-10 rounded-[10px]" />
                <div className="flex-1">
                  <Bar className="h-[15px] w-[60%]" />
                  <Bar className="mt-2 h-[12px] w-[40%]" />
                </div>
              </div>
              <div className="space-y-4 py-5">
                <Bar className="h-[40px] w-full" />
                <Bar className="h-[40px] w-full" />
              </div>
              <div className="space-y-3 border-t border-border pt-5">
                <Bar className="h-[14px] w-full" />
                <Bar className="h-[14px] w-full" />
                <Bar className="h-[24px] w-full" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}
