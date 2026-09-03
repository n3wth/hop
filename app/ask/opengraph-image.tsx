import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Ask hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Ask hop"
        title="Points or cash?"
        description="Tell hop a vibe, a budget, or a city. It reads saver charts and cash for the same trip and tells you which one wins."
      />
    ),
    { ...size, fonts },
  )
}
