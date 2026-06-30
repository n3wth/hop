import { ImageResponse } from 'next/og'
import { destinations, destinationByCode, computeCpp } from '@/lib/destinations'
import { tier } from '@/lib/cpp'
import { OG, tierColor, Brand, Dot, ogFonts, FONT_DISPLAY, FONT_BODY } from '@/lib/og'

// Per-destination social card — the "thinking image". Flat warm-paper editorial
// in hop's own type (Bricolage Grotesque display, General Sans body): the bunny
// mark up top, the place name dominant, and ONE computed line (miles · cash ·
// cpp in its tier color). No photos/panels/gradients — stays legible when a chat
// app shrinks it to a small rounded preview.

export const dynamicParams = false
export function generateStaticParams(): { city: string }[] {
  return destinations.map((d) => ({ city: d.code.toLowerCase() }))
}

export const alt = 'Points vs cash for this destination — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function milesLabel(miles: number): string {
  const k = miles / 1000
  return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
}

export default async function Image({ params }: { params: Promise<{ city: string }> }) {
  const { city } = await params
  const d = destinationByCode(city)
  const fonts = await ogFonts()
  if (!d) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: OG.cream }} />,
      { ...size, fonts },
    )
  }

  const value = computeCpp(d)
  const valueColor = tierColor(tier(value))
  const vibe = d.vibe.charAt(0).toUpperCase() + d.vibe.slice(1)

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
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, color: OG.teal, letterSpacing: '0.12em' }}>
            {`${d.country.toUpperCase()} · ${d.region.toUpperCase()}`}
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 134, fontWeight: 700, color: OG.ink, letterSpacing: '-0.035em', lineHeight: 0.96, marginTop: 14 }}>
            {d.city}
          </div>

          <div style={{ display: 'flex', fontSize: 38, color: OG.ink2, marginTop: 20, maxWidth: 940 }}>{vibe}</div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 42, fontSize: 42 }}>
            <div style={{ display: 'flex', color: OG.ink, fontWeight: 600 }}>{`${milesLabel(d.typicalAwardMiles)} miles`}</div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink, fontWeight: 600 }}>{`$${Math.round(d.typicalCashUSD).toLocaleString('en-US')} cash`}</div>
            <Dot />
            <div style={{ display: 'flex', color: valueColor, fontWeight: 700 }}>
              {value !== undefined ? `${value.toFixed(1)}¢/pt` : '—'}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
