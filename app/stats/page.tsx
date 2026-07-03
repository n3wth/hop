import Link from 'next/link'
import { getTrustStats } from '@/lib/trust-stats'
import { pageMeta } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = pageMeta({
  title: 'Trust & reliability',
  description: 'How many loyalty programs hop has live-verified pricing for, right now.',
  path: '/stats',
})

function fmtDegradation(n: number | null): string {
  return n === null ? 'unknown' : String(n)
}

export default async function StatsPage() {
  const stats = await getTrustStats()
  const asOfLabel = new Date(stats.asOf).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <div className="mx-auto max-w-[560px] px-4 py-16 sm:px-8">
      <Link href="/" className="text-[14px] text-text3 hover:text-text2">
        &larr; hop
      </Link>

      <h1 className="mt-6 text-balance font-display text-[30px] font-semibold tracking-[-0.02em] text-text">
        Trust &amp; reliability
      </h1>

      <p className="mt-3 max-w-[48ch] text-[16px] leading-[1.55] text-text2">
        hop&rsquo;s engine never fabricates a number and never crashes on a dead upstream — it
        degrades a section instead. These are the real, computed figures behind that claim.
      </p>

      <dl className="mt-10 space-y-6 border-t border-border-soft pt-8">
        <div>
          <dt className="text-[13px] text-text3">Live-verified pricing</dt>
          <dd className="mt-1 font-mono text-[24px] font-semibold tracking-[-0.02em] text-text">
            {stats.verifiedPrograms} of {stats.totalPrograms}
          </dd>
          <p className="mt-1 text-[14px] leading-[1.5] text-text2">
            loyalty programs are currently priced from hop&rsquo;s own observed cash-vs-award data,
            not just the static baseline table.
          </p>
        </div>

        <div>
          <dt className="text-[13px] text-text3">Degraded searches, last 24h</dt>
          <dd className="mt-1 font-mono text-[24px] font-semibold tracking-[-0.02em] text-text">
            cash {fmtDegradation(stats.degradation24h.cash)} · awards{' '}
            {fmtDegradation(stats.degradation24h.awards)}
          </dd>
          <p className="mt-1 text-[14px] leading-[1.5] text-text2">
            counted times a search fell back gracefully because a cash or award source was
            unavailable. &ldquo;unknown&rdquo; means this isn&rsquo;t being tracked right now, not
            that nothing degraded.
          </p>
        </div>
      </dl>

      <p className="mt-10 text-[13px] text-text3">As of {asOfLabel}.</p>
    </div>
  )
}
