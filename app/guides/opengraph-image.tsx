import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Program guides — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Guides"
        title="Loyalty program guides"
        description="Everything you need to know about points programs — earning, redeeming, and getting the best value."
      />
    ),
    { ...size, fonts },
  )
}
