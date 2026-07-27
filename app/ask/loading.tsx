import AppShell from '@/components/AppShell'
import { getSessionNavUser } from '@/lib/nav-user'

// Route-level loading UI for /ask. The concierge is now ONE fixed surface: a quiet
// control rail on top, a single scroll region in the middle (the empty state
// centers a calm greeting), and the composer DOCKED at the floor. This placeholder
// mirrors that skeleton exactly — greeting centered, chips + composer docked — so
// the real surface swaps in with no layout jump. Static text bars use the shared
// .hop-skeleton shimmer (the house light-surface convention, visible on cream);
// the composer/chips/tiles read via border-border on the paper canvas.
//
// user is resolved here (cheap session read, no balances) so signed-in visitors
// see their own avatar from the first paint instead of a "Sign in" link that
// pops to the avatar the instant the real page's slower data lands.
export default async function Loading() {
  const user = await getSessionNavUser()
  return (
    <AppShell user={user} hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <div className="flex min-h-0 flex-1 flex-col px-5 sm:px-8 lg:px-12 xl:px-16">
          {/* control rail — a quiet strip, right-aligned at the header frame */}
          <div className="hop-ask-frame flex flex-shrink-0 items-center justify-end pb-2 pt-1">
            <span className="h-[28px] w-[130px] rounded-full hop-skeleton" />
          </div>

          {/* middle — the greeting centered in the scroll region. Same overflow-
              safe structure as the real surface: plain scroller outside,
              min-h-full centering inside (never items-center on the scroller). */}
          <div className="relative min-h-0 flex-1">
            <div className="h-full overflow-y-auto py-8">
              <div className="flex min-h-full items-center justify-center">
              <div className="hop-ask-measure flex flex-col items-center text-center">
                {/* eyebrow */}
                <span className="block h-[14px] w-[150px] rounded-full hop-skeleton" />

                {/* heading — one line ("Where to next?"), like the real h1 */}
                <span className="mt-5 block h-[34px] w-[58%] max-w-[300px] rounded-[var(--radius)] hop-skeleton sm:h-[44px]" />

                {/* subhead — wraps to two lines at the 46ch measure */}
                <span className="mt-4 block h-[14px] w-[72%] max-w-[430px] rounded-full hop-skeleton" />
                <span className="mt-2 block h-[14px] w-[52%] max-w-[320px] rounded-full hop-skeleton" />

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
