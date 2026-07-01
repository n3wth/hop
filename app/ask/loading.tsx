import AppShell from '@/components/AppShell'

// Route-level loading UI for /ask. The concierge IS the page — its empty state is
// now a CALM CREAM editorial start (components/concierge/AskStart), not a dark
// photographic hero. This placeholder mirrors that start's shape (eyebrow,
// heading, subhead, the paper composer, one row of paper starter chips) on the
// cream canvas so the real start swaps in with no flash of a dark hero. Static
// placeholders in sunk/hair tones — calm, flat, on the light surface.
export default function Loading() {
  return (
    <AppShell hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
          <div className="hop-ask-measure flex flex-col items-center text-center">
            {/* eyebrow */}
            <span className="block h-[14px] w-[150px] rounded-full bg-sunk" />

            {/* heading — two calm lines */}
            <span className="mt-5 block h-[34px] w-[70%] max-w-[360px] rounded-[var(--radius)] bg-sunk sm:h-[44px]" />
            <span className="mt-2.5 block h-[34px] w-[46%] max-w-[240px] rounded-[var(--radius)] bg-sunk sm:h-[44px]" />

            {/* subhead */}
            <span className="mt-4 block h-[14px] w-[62%] max-w-[380px] rounded-full bg-sunk" />

            {/* composer — a paper bar with the border-2 the real composer wears */}
            <div className="mt-7 w-full max-w-[600px]">
              <span className="block h-[52px] w-full rounded-[var(--radius-lg)] border-2 border-border bg-paper" />
            </div>

            {/* one row of paper starter chips */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {['180px', '150px', '170px', '210px'].map((w, i) => (
                <span
                  key={i}
                  className="h-[38px] rounded-full border border-border bg-paper"
                  style={{ width: w }}
                />
              ))}
            </div>

            {/* slim destination strip */}
            <div className="mt-8 flex flex-wrap justify-center gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-[78px] w-[92px] rounded-[var(--radius)] border border-border bg-paper"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
