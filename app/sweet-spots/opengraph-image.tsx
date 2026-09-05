import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Sweet spots — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Sweet spots"
        title="Best uses of your miles"
        description="The standout award redemptions by program. Every figure is a researched seed reference — verify live before booking."
      />
    ),
    { ...size, fonts },
  )
}
