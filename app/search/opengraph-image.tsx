import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Search flights — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Search"
        title="Points vs cash — one search"
        description="Live cash fares vs published saver charts. hop calculates cents per point and tells you which one wins."
      />
    ),
    { ...size, fonts },
  )
}
