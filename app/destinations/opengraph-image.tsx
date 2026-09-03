import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Destinations — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Destinations"
        title="Where your points can take you"
        description="Destination guides with points-vs-cash context. Typical award miles, cash fares, and cents per point for every route."
      />
    ),
    { ...size, fonts },
  )
}
