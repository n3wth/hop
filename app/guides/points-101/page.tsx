import Link from 'next/link'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import EditorialHeader from '@/components/EditorialHeader'
import BrandIcon from '@/components/BrandIcon'
import Card from '@/components/ui/Card'
import { pageMeta } from '@/lib/seo'
import { GREEN_TIER_CPP, AMBER_TIER_CPP, POINTS_THRESHOLD_CPP } from '@/lib/cpp'
import { listPrograms, listTransferablePrograms } from '@/lib/programs'

// Evergreen SEO page — the docs/content-plan.md §1 "Beginner education" P1
// content type (unbuilt as of 2026-07-15): what points/miles are, transferable
// vs. locked currencies, why cpp beats a flat cash-back rate. Deliberately
// drops the content-plan's "alliance basics" bullet — no structured
// alliance-membership data exists anywhere in lib/* (only free-text "Star
// Alliance" mentions in destinations.ts/sweet-spots.ts), and this page never
// invents a fact lib/* doesn't already know. No per-request data (every number
// is a lib/cpp.ts constant or a live .map()/.filter() over lib/programs.ts's
// PROGRAMS registry), so it prerenders like its /guides/point-value sibling.
export const dynamic = 'force-static'

export const metadata = pageMeta({
  title: 'Points 101: how points, miles, and cpp actually work',
  description:
    'New to points? Which currencies are transferable, which are locked to one airline or hotel, and why cents-per-point (cpp) beats a flat cash-back rate — before your first redemption.',
  path: '/guides/points-101',
})

export default function Points101Page() {
  // Live off the same registry the transfer-partner guides use — never a
  // hand-typed list, so a new program added to PROGRAMS shows up here for free.
  const transferable = listTransferablePrograms()
  const locked = listPrograms().filter((p) => !p.transferable)
  const lockedAirlines = locked.filter((p) => p.kind === 'airline')
  const lockedHotels = locked.filter((p) => p.kind === 'hotel')

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)]">
        <nav aria-label="Breadcrumb" className="mx-auto max-w-[var(--container-sm)] pt-8 text-[13px] text-text3">
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Program guides
          </Link>
          <span aria-hidden className="px-1.5">
            /
          </span>
          <span className="text-text2">Points 101</span>
        </nav>

        <EditorialHeader
          eyebrow="Beginner guide"
          title="New to points? Start here."
          titleMaxW="max-w-[22ch]"
          intro="Airlines, hotels, and banks all hand out points and miles, but what a balance is actually worth depends entirely on how you redeem it. Two things are worth knowing before your first redemption: which currencies stay flexible, and how to tell a good redemption from a bad one."
          introMaxW="max-w-[58ch]"
        />

        {/* what points/miles are — plain, definitional, no invented history */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            What points and miles actually are
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            A point or a mile is a unit of credit. Airlines and hotels award them for flying or
            staying with them; banks award them for spending on a rewards card. Either way you bank
            a balance, then redeem it later for a flight, a hotel stay, or occasionally cash back.
            Redeeming it well is a computation, not a guess — that computation is cents per point
            (cpp), covered below.
          </p>
        </section>

        {/* the core, data-backed section — transferable vs. locked, live off
            lib/programs.ts's PROGRAMS registry */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Transferable points vs. locked miles
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            Not all points work the same way. A handful of bank currencies stay flexible until you
            move them; everything else is committed to one airline or hotel program the moment you
            earn it.
          </p>

          <h3 className="mt-6 text-[13px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
            Transferable — {transferable.length} bank currencies, move to multiple partners
          </h3>
          <div className="mt-3 divide-y divide-hair border-y border-border">
            {transferable.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-3">
                <BrandIcon code={p.code} name={p.name} size={28} />
                <span className="text-[14.5px] font-medium text-text">{p.name}</span>
              </div>
            ))}
          </div>

          <h3 className="mt-8 text-[13px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
            Locked — {locked.length} airline and hotel programs, earned into one program only
          </h3>
          <p className="mt-2 text-[13px] text-text3">
            {lockedAirlines.length} airline programs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lockedAirlines.map((p) => (
              <Card
                key={p.id}
                surface="paper"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
              >
                <BrandIcon code={p.code} name={p.name} size={22} />
                <span className="text-[13.5px] font-medium text-text">{p.name}</span>
              </Card>
            ))}
          </div>
          <p className="mt-4 text-[13px] text-text3">
            {lockedHotels.length} hotel programs
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {lockedHotels.map((p) => (
              <Card
                key={p.id}
                surface="paper"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3"
              >
                <BrandIcon code={p.code} name={p.name} size={22} />
                <span className="text-[13.5px] font-medium text-text">{p.name}</span>
              </Card>
            ))}
          </div>

          <p className="mt-6 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            The difference matters at redemption time. A transferable point keeps every partner&rsquo;s
            options open until you actually move it — you pick the redemption first, then transfer
            into it. An airline or hotel mile is already home; its value is capped by what that one
            program pays out. See exactly where each transferable currency reaches in the{' '}
            <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
              program guides
            </Link>
            .
          </p>
        </section>

        {/* cpp vs. flat cash back — reuses lib/cpp.ts constants exactly like
            /guides/point-value; the formula itself lives there, not here */}
        <section className="mx-auto mt-10 max-w-[var(--container-sm)]">
          <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.01em] text-text">
            Why cents-per-point beats a flat cash-back rate
          </h2>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            A cash-back card pays one fixed rate on every dollar you spend, printed right on the
            card. It never changes — simple, but there&rsquo;s no upside for booking well.
          </p>
          <p className="mt-3 max-w-[62ch] text-[15.5px] leading-relaxed text-text2">
            A points balance doesn&rsquo;t work that way. The same balance can be worth a lot or a
            little depending on what you redeem it for. hop computes the real rate — cents per point
            (cpp) — for every redemption it prices, rather than publishing one static number per
            program. See{' '}
            <Link href="/guides/point-value" className="font-semibold text-brand hover:text-brand-deep">
              the full formula walkthrough
            </Link>{' '}
            for how.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold"
              style={{
                background: 'var(--color-good-bg)',
                color: 'var(--color-good)',
                borderColor: 'var(--color-brand-mint-deep)',
              }}
            >
              ≥ {GREEN_TIER_CPP.toFixed(1)}¢/pt — strong value
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold"
              style={{
                background: 'var(--color-ok-bg)',
                color: 'var(--color-ok)',
                borderColor: 'var(--color-gold-soft)',
              }}
            >
              {AMBER_TIER_CPP.toFixed(1)}–&lt;{GREEN_TIER_CPP.toFixed(1)}¢/pt — fair value
            </span>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold"
              style={{
                background: 'var(--color-sunk)',
                color: 'var(--color-text3)',
                borderColor: 'var(--color-border)',
              }}
            >
              &lt; {AMBER_TIER_CPP.toFixed(1)}¢/pt — weak, pay cash instead
            </span>
          </div>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-text2">
            hop&rsquo;s own &ldquo;use your points&rdquo; call kicks in once the best award clears{' '}
            <b className="font-semibold text-text2">{POINTS_THRESHOLD_CPP.toFixed(1)}¢/pt</b>. Below
            that, you&rsquo;re usually behind a decent cash-back rate — cpp is how you tell a good
            redemption from a bad one, before you book it.
          </p>
        </section>

        {/* internal-link mesh -> reference page + live tools */}
        <div className="mx-auto mt-10 flex max-w-[var(--container-sm)] flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <span className="text-text3">Next:</span>
          <Link href="/guides/point-value" className="font-semibold text-brand hover:text-brand-deep">
            The full cpp methodology
          </Link>
          <Link href="/guides" className="font-semibold text-brand hover:text-brand-deep">
            Program-specific guides
          </Link>
          <Link href="/sweet-spots" className="font-semibold text-brand hover:text-brand-deep">
            Sweet spots by program
          </Link>
          <Link href="/search" className="font-semibold text-brand hover:text-brand-deep">
            Try it live — price a real trip
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
