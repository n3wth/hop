import { ImageResponse } from 'next/og'
import { OG, Brand, Dot, ogFonts, tierColor, FONT_DISPLAY, FONT_BODY } from '@/lib/og'
import { formatValue } from '@/lib/cpp'
import { isShareReceiptsEnabled } from '@/lib/env'
import { getSharedVerdict } from '@/lib/shared-verdicts'

// The repo's FIRST dynamic OG route: no generateStaticParams/dynamicParams —
// every receipt id is a real DB row, not a fixed set. Renders the SAME stored
// snapshot the page reads (zero upstream calls, card can never disagree with
// the page — the whole point of snapshot-at-share-time). Missing/revoked/
// invalid/flag-off → a plain cream fallback card (the sweet-spots OG pattern),
// never a broken image.

// Force dynamic rendering explicitly rather than relying on Next inferring it
// from the Neon HTTP driver's internal fetch — a per-id DB read must never be
// cached indefinitely (the default under the legacy caching model with no
// Request-time API called directly), or a revoked/freshly-minted receipt
// could serve a stale card forever.
export const dynamic = 'force-dynamic'
export const alt = "hop's verdict receipt"
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function fmt(n: number | undefined): string {
  return n != null ? n.toLocaleString('en-US') : '—'
}

function creamFallback() {
  return new ImageResponse(
    <div style={{ display: 'flex', width: '100%', height: '100%', background: OG.cream }} />,
    size,
  )
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snap = isShareReceiptsEnabled() ? await getSharedVerdict(id) : null
  if (!snap) return creamFallback()

  // Guards the F12 risk named in docs/plans/2026-07-02-viral-differentiation.md
  // §5/§8: this is the repo's first DYNAMIC OG route, so a vendored-font
  // tracing failure (unlike the sibling static OG routes, which would fail at
  // build time) would otherwise throw on every live request. Fall through to
  // the cream card — which renders no text and so needs no fonts — rather
  // than 500ing the unfurl.
  let fonts: Awaited<ReturnType<typeof ogFonts>>
  try {
    fonts = await ogFonts()
  } catch {
    return creamFallback()
  }

  const usingPoints = snap.verdict === 'use-points'
  const cash = snap.summary.cheapestCash

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          background: OG.cream,
          padding: 84,
          justifyContent: 'space-between',
          fontFamily: FONT_BODY,
        }}
      >
        <Brand />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              fontWeight: 600,
              color: OG.teal,
              letterSpacing: '0.12em',
            }}
          >
            THE VERDICT
          </div>

          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 72,
              fontWeight: 700,
              color: OG.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
              marginTop: 16,
              maxWidth: 1010,
            }}
          >
            {usingPoints ? `Use points. Save $${fmt(snap.summary.saveVsCash)} vs cash.` : 'Pay cash.'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 28, fontSize: 32 }}>
            <div style={{ display: 'flex', color: OG.ink, fontWeight: 600 }}>
              {snap.pick.program ?? snap.pick.airline}
            </div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink2 }}>{snap.route}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 40, gap: 56 }}>
            {snap.pick.miles != null ? (
              <StatBlock label="MILES" value={fmt(snap.pick.miles)} />
            ) : null}
            {snap.pick.cpp != null ? (
              <StatBlock
                label="VALUE"
                value={formatValue(snap.pick.cpp)}
                color={tierColor(snap.pick.tier)}
              />
            ) : null}
            {cash != null ? <StatBlock label="CASH" value={`$${fmt(cash)}`} /> : null}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: OG.ink3, letterSpacing: '0.08em' }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          fontFamily: FONT_DISPLAY,
          fontSize: 44,
          fontWeight: 700,
          color: color ?? OG.ink,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  )
}
