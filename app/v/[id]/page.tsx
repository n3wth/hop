import { notFound } from 'next/navigation'
import Link from 'next/link'
import Logo from '@/components/Logo'
import BrandIcon from '@/components/BrandIcon'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Button from '@/components/ui/Button'
import { pageMeta } from '@/lib/seo'
import { formatValue } from '@/lib/cpp'
import { isShareReceiptsEnabled } from '@/lib/env'
import { getSharedVerdict, type VerdictSnapshot } from '@/lib/shared-verdicts'

// The one dynamic OG route in the repo (see app/v/[id]/opengraph-image.tsx) —
// params is a Promise (Next 16), and there is NO generateStaticParams: every
// id is a real, unpredictable receipt, so the page renders dynamically off a
// single indexed DB read. Public, noindex (social spread, not SEO — see
// lib/seo-routes.ts, which deliberately omits /v/*), and gated: the flag off
// AND a missing/revoked/malformed row both 404 the same way.

// Force dynamic rendering explicitly rather than relying on Next inferring it
// from the Neon HTTP driver's internal fetch — see the identical note on
// opengraph-image.tsx. A revoked or freshly-minted receipt must never read a
// stale cached response.
export const dynamic = 'force-dynamic'

function fmt(n: number | undefined): string {
  return n != null ? n.toLocaleString('en-US') : '—'
}

function unitFor(program: string | undefined): string {
  return program?.toLowerCase().includes('southwest') ? 'points' : 'miles'
}

function dateRange(depart: string, ret: string | undefined): string {
  const fmtDate = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }
  return ret ? `${fmtDate(depart)} – ${fmtDate(ret)}` : fmtDate(depart)
}

function pricedOn(asOf: string): string {
  const d = new Date(asOf)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function runItYourselfUrl(snap: VerdictSnapshot): string {
  const q = new URLSearchParams({
    from: snap.from,
    to: snap.to,
    depart: snap.depart,
    adults: String(snap.adults),
    ref: 'receipt',
  })
  if (snap.return) q.set('return', snap.return)
  if (snap.cabin) q.set('cabin', snap.cabin)
  return `/search?${q.toString()}`
}

async function loadReceipt(id: string): Promise<VerdictSnapshot | null> {
  if (!isShareReceiptsEnabled()) return null
  return getSharedVerdict(id)
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snap = await loadReceipt(id)
  if (!snap) return {}
  const title =
    snap.verdict === 'use-points'
      ? `${snap.route} — use points, save $${fmt(snap.summary.saveVsCash)}`
      : `${snap.route} — pay cash`
  return {
    ...pageMeta({
      title,
      description: `hop's verdict for ${snap.route}, priced ${pricedOn(snap.asOf)}. Every number computed, never generated.`,
      path: `/v/${id}`,
    }),
    // Social spread, not SEO — a receipt permalink is thin, single-purpose
    // content. robots is page metadata ONLY (no robots.txt disallow): a
    // disallowed path is never fetched, so this directive would never be
    // seen and a bare URL posted on reddit could still get reference-indexed.
    robots: { index: false, follow: true },
  }
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snap = await loadReceipt(id)
  if (!snap) notFound()

  const usingPoints = snap.verdict === 'use-points'
  const unit = unitFor(snap.pick.program)
  const cash = snap.summary.cheapestCash

  return (
    <AppShell user={null} hideSearch>
      <div className="mx-auto max-w-[560px] px-4 py-10 sm:px-8 sm:py-16">
        <Link href="/" aria-label="hop — home" className="mb-8 flex justify-center">
          <Logo size={44} className="text-brand" />
        </Link>

        <div className="rounded-[20px] border border-border bg-paper px-6 py-8 sm:px-9 sm:py-10">
          <span className="text-[12px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
            The verdict
          </span>

          {usingPoints ? (
            <h1 className="mt-3 text-balance font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text sm:text-[34px]">
              Use points.
              <br />
              Save ${fmt(snap.summary.saveVsCash)} vs cash.
            </h1>
          ) : (
            <h1 className="mt-3 text-balance font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em] text-text sm:text-[34px]">
              Pay cash.
              <br />
              {snap.pick.cpp != null
                ? `Points are only worth ${snap.pick.cpp.toFixed(1)}¢ here.`
                : 'No award seats matched this trip.'}
            </h1>
          )}

          {/* Provenance line: program (or airline) · route · dates · cabin */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px] text-text2">
            <BrandIcon name={snap.pick.program ?? snap.pick.airline} size={20} />
            <span className="font-medium text-text">{snap.pick.program ?? snap.pick.airline}</span>
            <span aria-hidden className="text-text3">
              ·
            </span>
            <span>{snap.route}</span>
            <span aria-hidden className="text-text3">
              ·
            </span>
            <span>{dateRange(snap.depart, snap.return)}</span>
            {snap.pick.cabin ? (
              <>
                <span aria-hidden className="text-text3">
                  ·
                </span>
                <span>{snap.pick.cabin}</span>
              </>
            ) : null}
          </div>

          {/* Stat row */}
          <div className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-6 sm:flex sm:flex-wrap sm:gap-10">
            {snap.pick.miles != null ? (
              <Stat label="You pay" value={`${fmt(snap.pick.miles)}`} unit={unit} />
            ) : null}
            {snap.pick.cpp != null ? (
              <Stat label="Value" value={formatValue(snap.pick.cpp)} tier={snap.pick.tier} />
            ) : null}
            {cash != null ? <Stat label="Cash" value={`$${fmt(cash)}`} /> : null}
            {usingPoints ? (
              <Stat label="You save" value={`$${fmt(snap.summary.saveVsCash)}`} accent />
            ) : null}
          </div>

          <p className="mt-7 border-t border-border pt-5 text-[12.5px] leading-[1.5] text-text3">
            Priced {pricedOn(snap.asOf)} — computed from live cash fares and award space. Fares
            move.
          </p>

          <Button href={runItYourselfUrl(snap)} className="mt-6">
            Run this route yourself
          </Button>
        </div>

        <div className="mt-6 text-center text-[12.5px] leading-[1.6] text-text3">
          <p>hop compares cash, miles, and transfer partners in one search.</p>
          <p>Every number computed, never generated — by the same engine any AI agent can call.</p>
        </div>
      </div>
      <SiteFooter />
    </AppShell>
  )
}

function Stat({
  label,
  value,
  unit,
  tier,
  accent,
}: {
  label: string
  value: string
  unit?: string
  tier?: 'green' | 'amber' | 'muted'
  accent?: boolean
}) {
  const tierColor =
    tier === 'green' ? 'text-good' : tier === 'amber' ? 'text-amber' : tier === 'muted' ? 'text-text3' : undefined
  return (
    <div>
      <div className="mb-[6px] text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
        {label}
      </div>
      <div
        className={`hop-price text-[22px] ${accent ? 'text-brand' : tierColor ? tierColor : 'text-text'}`}
      >
        {value}
        {unit ? <small className="text-[13px] font-medium text-text3"> {unit}</small> : null}
      </div>
    </div>
  )
}
