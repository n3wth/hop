import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Points — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Points"
        title="What can you do with your points?"
        description="Explore destinations by point balance. See where your miles can actually take you."
      />
    ),
    { ...size, fonts },
  )
}
