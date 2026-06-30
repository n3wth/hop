import { describe, it, expect } from 'vitest'
import { averageColorHex, blurhashToDataUri } from '@/lib/blurhash'

// The canonical BlurHash example string (woltapp/blurhash docs).
const SAMPLE = 'LEHV6nWB2yk8pyo0adR*.7kCMdnj'

describe('averageColorHex', () => {
  it('decodes the DC term to a valid hex color', () => {
    const hex = averageColorHex(SAMPLE)
    expect(hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns null on a malformed hash', () => {
    expect(averageColorHex('')).toBeNull()
    expect(averageColorHex('!!!')).toBeNull()
    expect(averageColorHex('L')).toBeNull()
  })

  it('returns null when the length does not match the component count', () => {
    expect(averageColorHex('LEHV6nWB')).toBeNull() // valid prefix, wrong length
  })
})

describe('blurhashToDataUri', () => {
  it('produces an inline SVG data URI', () => {
    const uri = blurhashToDataUri(SAMPLE)
    expect(uri).not.toBeNull()
    expect(uri!.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    // Decodes to an SVG with a blur filter and a grid of rects.
    const svg = decodeURIComponent(uri!.replace('data:image/svg+xml;utf8,', ''))
    expect(svg).toContain('feGaussianBlur')
    expect((svg.match(/<rect /g) ?? []).length).toBe(48) // default 8×6 grid
    expect(svg).toMatch(/fill="#[0-9a-f]{6}"/)
  })

  it('returns null on a bad hash', () => {
    expect(blurhashToDataUri('nope')).toBeNull()
  })
})
