import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Pricing — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Pricing"
        title="Search is free. Pro is the watchlist."
        description="The points-vs-cash verdict stays free. Pro alerts you when the math changes on routes you care about."
      />
    ),
    { ...size, fonts },
  )
}
