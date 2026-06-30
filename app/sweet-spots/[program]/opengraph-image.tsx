import { ImageResponse } from 'next/og'
import { allPrograms, programBySlug } from '@/lib/sweet-spots'
import { OG, Brand, Dot, ogFonts, FONT_DISPLAY, FONT_BODY } from '@/lib/og'

// Per-program social card: the program, how many standout redemptions it carries,
// and its single best one — computed from the seed dataset (counts + pre-ranked
// top spot), never written. Same flat warm-paper poster language and hop type as
// the destination card.

export const dynamicParams = false
export function generateStaticParams(): { program: string }[] {
  return allPrograms().map((program) => ({ program }))
}

export const alt = 'Award sweet spots by program — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ program: string }> }) {
  const { program: slug } = await params
  const program = programBySlug(slug)
  const fonts = await ogFonts()
  if (!program) {
    return new ImageResponse(
      <div style={{ display: 'flex', width: '100%', height: '100%', background: OG.cream }} />,
      { ...size, fonts },
    )
  }

  const top = program.spots[0]
  const count = program.spots.length

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
            AWARD SWEET SPOTS
          </div>

          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 96, fontWeight: 700, color: OG.ink, letterSpacing: '-0.03em', lineHeight: 1.0, marginTop: 14, maxWidth: 1010 }}>
            {program.name}
          </div>

          <div style={{ display: 'flex', fontSize: 34, color: OG.ink2, marginTop: 20 }}>
            {`${count} ${count === 1 ? 'redemption' : 'redemptions'} where points beat cash`}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginTop: 40, fontSize: 36 }}>
            {/* swap the ↔ (no glyph in the brand fonts → emoji fallback) for an en dash */}
            <div style={{ display: 'flex', color: OG.ink, fontWeight: 600 }}>{top.route.replace(/↔/g, '–')}</div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink2 }}>{`${top.cabin}${top.metal ? ` · ${top.metal}` : ''}`}</div>
            <Dot />
            <div style={{ display: 'flex', color: OG.ink2 }}>{`~${top.milesLabel} miles`}</div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
