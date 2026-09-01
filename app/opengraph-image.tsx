import { ImageResponse } from 'next/og'
import { ogFonts, FONT_DISPLAY } from '@/lib/og'

// n3wth family spec (kit#17): centered stack, dart + title, #08090b background.
// 1200×630, no chips, no subtitle, no bunny.

export const alt = 'hop.flights'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// n3wth dart — canonical family mark from n3wth.com public/favicon.svg.
function N3wthDart({ size = 80 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
    >
      <path
        d="M9.4 6.6 25.2 14a1.5 1.5 0 0 1-.15 2.78l-6.1 1.78a2 2 0 0 0-1.32 1.24l-2.2 6.1c-.5 1.36-2.42 1.27-2.78-.15L8.0 8.2A1.6 1.6 0 0 1 9.4 6.6Z"
        fill="#ffffff"
      />
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
          background: '#08090b',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <N3wthDart size={96} />

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
