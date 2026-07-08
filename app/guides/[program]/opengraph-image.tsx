import { ImageResponse } from 'next/og'
import { allProgramGuideSlugs, programGuideBySlug } from '@/lib/program-guides'
import { OG, Brand, Dot, ogFonts, FONT_DISPLAY, FONT_BODY } from '@/lib/og'

// Per-currency social card: the currency, its partner count, and its single
// best transfer — computed from the transfer graph + baseline valuations
// (pre-ranked top partner), never written. Same flat warm-paper poster
// language as the sweet-spots and destination cards.

export const dynamicParams = false
export function generateStaticParams(): { program: string }[] {
  return allProgramGuideSlugs().map((program) => ({ program }))
}

export const alt = 'Best use of your points, currency by currency — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ program: string }> }) {
  const { program: slug } = await params
  const guide = programGuideBySlug(slug)
  const fonts = await ogFonts()
  if (!guide) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: OG.cream }} />,
      { ...size, fonts },
    )
  }

  const top = guide.partners[0]

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
            BEST USE OF YOUR POINTS
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 96, fontWeight: 700, color: OG.ink, letterSpacing: '-0.03em', lineHeight: 1.0, marginTop: 14, maxWidth: 1010 }}>
            {guide.name}
          </div>

          <div style={{ display: 'flex', fontSize: 34, color: OG.ink2, marginTop: 20 }}>
            {`${guide.partners.length} transfer partners, ranked by value`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 40, fontSize: 36 }}>
            <div style={{ display: 'flex', color: OG.ink, fontWeight: 600 }}>{top.name}</div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink2 }}>{top.ratio}</div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink2 }}>{`${top.baselineCpp.toFixed(2)}¢ baseline`}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
