import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'Support — hop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="Support"
        title="How can we help?"
        description="Questions about hop, your account, or how we calculate points value. Contact hop@n3wth.com."
      />
    ),
    { ...size, fonts },
  )
}
