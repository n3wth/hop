import { ImageResponse } from 'next/og'
import { PageOgCard, ogFonts } from '@/lib/og'

export const alt = 'hop for AI agents (MCP)'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await ogFonts()
  return new ImageResponse(
    (
      <PageOgCard
        eyebrow="For AI agents"
        title="The points engine, as a tool call"
        description="Six tools, deterministic math, no LLM-generated numbers. Computed cpp, transfer paths, and sweet spots."
      />
    ),
    { ...size, fonts },
  )
}
