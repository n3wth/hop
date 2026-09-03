import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Deals — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Deals"
        title="Where your miles go furthest"
        description="High-value award redemptions worth your miles right now, ranked by cents per point."
      />
    ),
    { ...size, fonts },
  )
}
