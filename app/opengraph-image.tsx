import { ImageResponse } from 'next/og'
import { ogFonts, FONT_DISPLAY } from '@/lib/og'

// n3wth family spec for social cards:
// - Black background, white type
// - n3wth cursor mark + one large title only
// - NO chips, NO subtitle (unreadable from far away)
// - 1200×630

export const alt = 'hop.flights'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// n3wth cursor mark — the canonical family logo from github.com/n3wth/n3wth public/brand/bimi.svg
// Scaled and positioned for OG card. Original viewBox 0 0 100 100, path M36 24 → M70 54.
function N3wthMark({ size = 80 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
    >
      <path d="M36 24 L36 68 L47 57 L54 74 L61 71 L54 54 L70 54 Z" fill="#ffffff" />
    </svg>
  )
}

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
          background: '#000000',
          padding: 84,
          justifyContent: 'space-between',
        }}
      >
        <N3wthMark size={80} />

        <div
          style={{
            display: 'flex',
            fontFamily: FONT_DISPLAY,
            fontSize: 180,
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}
        >
          hop
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
