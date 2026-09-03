import { ImageResponse } from 'next/og'
import { OG, Brand, ogFonts, FONT_DISPLAY, FONT_BODY } from '@/lib/og'
import { DEFAULT_DESCRIPTION, TAGLINE } from '@/lib/seo'

// hop family OG card: warm cream editorial, bunny mark, brand title + tagline.
// 1200×630, flat editorial design — no shadows, gradients, or glows.

export const alt = 'hop — points or cash, one number'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
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
        <Brand size={100} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 160,
              fontWeight: 700,
              color: OG.ink,
              letterSpacing: '-0.035em',
              lineHeight: 0.95,
            }}
          >
            hop
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 48,
              fontWeight: 600,
              color: OG.teal,
              marginTop: 24,
            }}
          >
            {TAGLINE}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: OG.ink2,
              marginTop: 28,
              maxWidth: 900,
              lineHeight: 1.4,
            }}
          >
            Compares your points to live cash fares. Tells you when points beat cash — and when to pay.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
