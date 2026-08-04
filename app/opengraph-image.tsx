import { ImageResponse } from 'next/og'
import { TAGLINE } from '@/lib/seo'
import { OG, Brand, ogFonts, FONT_DISPLAY, FONT_BODY } from '@/lib/og'

// The card sub-line — the value prop, not a repeat of the headline/tagline.
const OG_SUBLINE = 'Points or cash — the verdict on every flight'

// Default social card for the whole site (1200×630). Same flat warm-paper poster
// language and hop type as the per-page cards: the bunny mark up top, a big
// display line anchored low, one teal accent. No panels, gradients, or shadows.
// Wired as both og:image and twitter:image via the opengraph-image convention.

export const alt = 'hop — your personal travel agent'
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
        <Brand />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 100, fontWeight: 700, color: OG.ink, letterSpacing: '-0.035em', lineHeight: 1.0, maxWidth: 1010 }}>
            {TAGLINE}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 30 }}>
            <div style={{ display: 'flex', width: 44, height: 6, background: OG.teal, borderRadius: 3 }} />
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 500, color: OG.teal }}>{OG_SUBLINE}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
