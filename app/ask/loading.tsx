import AppShell from '@/components/AppShell'

// Route-level loading UI for /ask. The concierge is now ONE fixed surface: a quiet
// control rail on top, a single scroll region in the middle (the empty state
// centers a calm greeting), and the composer DOCKED at the floor. This placeholder
// mirrors that skeleton exactly — greeting centered, chips + composer docked — so
// the real surface swaps in with no layout jump. Static text bars use the shared
// .hop-skeleton shimmer (the house light-surface convention, visible on cream);
// the composer/chips/tiles read via border-border on the paper canvas.
export default function Loading() {
  return (
    <AppShell hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-4 sm:px-8 lg:px-16">
          {/* control rail — a quiet strip, right-aligned at the header frame */}
          <div className="hop-ask-frame flex flex-shrink-0 items-center justify-end pb-2 pt-1">
            <span className="h-[28px] w-[130px] rounded-full hop-skeleton" />
          </div>

          {/* middle — the greeting centered in the scroll region */}
          <div className="relative min-h-0 flex-1">
            <div className="flex h-full items-center justify-center py-8">
              <div className="hop-ask-measure flex flex-col items-center text-center">
                {/* eyebrow */}
                <span className="block h-[14px] w-[150px] rounded-full hop-skeleton" />

                {/* heading — two calm lines */}
                <span className="mt-5 block h-[34px] w-[70%] max-w-[360px] rounded-[var(--radius)] hop-skeleton sm:h-[44px]" />
                <span className="mt-2.5 block h-[34px] w-[46%] max-w-[240px] rounded-[var(--radius)] hop-skeleton sm:h-[44px]" />

                {/* subhead */}
                <span className="mt-4 block h-[14px] w-[62%] max-w-[380px] rounded-full hop-skeleton" />

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

          {/* docked dock — hairline at the header frame; chips + composer at the
              reading measure inside, matching the real dock exactly */}
          <div className="hop-ask-frame flex-shrink-0 border-t border-hair pb-5 pt-3">
            <div className="hop-ask-measure">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {['180px', '150px', '170px', '210px'].map((w, i) => (
                  <span
                    key={i}
                    className="h-[32px] rounded-full border border-border bg-paper"
                    style={{ width: w }}
                  />
                ))}
              </div>
              {/* composer — a paper bar with the border-2 the real composer wears */}
              <span className="block h-[52px] w-full rounded-[var(--radius-lg)] border-2 border-border bg-paper" />
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
