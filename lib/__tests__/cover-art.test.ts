import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CoverArt from '@/components/CoverArt'

// CoverArt (components/CoverArt.tsx) is pure SSR SVG: same seed → identical
// markup, forever, and every color it emits comes from a closed palette that
// mirrors app/globals.css tokens. Both invariants matter because the artwork
// is baked into the static /sweet-spots prerender — any nondeterminism (a
// stray Math.random/Date.now) would fail the "same program renders the same
// cover" premise the list tile ↔ detail header pairing depends on.

function render(seed: string) {
  return renderToStaticMarkup(createElement(CoverArt, { seed }))
}

describe('CoverArt', () => {
  it('renders byte-identical markup for the same seed', () => {
    const a = render('virgin-atlantic')
    const b = render('virgin-atlantic')
    expect(a).toBe(b)
  })

  it('renders different markup for different seeds', () => {
    const a = render('virgin-atlantic')
    const b = render('alaska-atmos')
    expect(a).not.toBe(b)
  })

  it('only emits colors from the closed token palette', () => {
    // Mirrors the literal PALETTE in components/CoverArt.tsx — kept as a
    // separate list (not an import) so this test also catches an accidental
    // edit that widens the palette without updating both places deliberately.
    const KNOWN_COLORS = new Set(
      [
        // DARK band
        '#0d6e6e', // --color-brand
        '#0a5757', // --color-brand-deep
        '#073e3e', // --color-brand-ink
        '#2c6f6b', // --color-brand-muted
        '#8f5618', // --color-ok / --color-amber
        '#a8513a', // --color-weak
        '#14201f', // --color-text
        // LIGHT band
        '#ffe7b0', // --color-gold-soft
        '#6ff0d2', // --color-mint-bright
        '#e3f1ef', // --color-brand-light / --color-good-bg
        '#cfe6e2', // --color-brand-mint-deep
        '#eef7f4', // --color-brand-tint
      ].map((h) => h.toLowerCase())
    )

    const seeds = ['virgin-atlantic', 'alaska-atmos', 'united', 'delta', 'aa-jal', 'flying-blue']
    for (const seed of seeds) {
      const markup = render(seed)
      const found = markup.match(/#[0-9a-fA-F]{6}/g) ?? []
      expect(found.length).toBeGreaterThan(0)
      for (const hex of found) {
        expect(KNOWN_COLORS.has(hex.toLowerCase())).toBe(true)
      }
    }
  })

  it('uses only the closed set of arc rotations', () => {
    const markup = render('virgin-atlantic')
    const rotations = [...markup.matchAll(/rotate\((-?\d+)\)/g)].map((m) => Number(m[1]))
    expect(rotations.sort((a, b) => a - b)).toEqual([-14, -6, 10, 22, 34])
  })

  // Regression guard for the specific bug caught in review before this
  // shipped: drawing bg and the carved logo's color from one undifferentiated
  // palette let some seeds render an invisible bunny (logo === bg). Same
  // luminance/ratio math as contrast.test.ts, applied to CoverArt's own
  // output rather than re-deriving it from the component's internals.
  it('always keeps the carved logo readable against the background', () => {
    function luminance(hex: string): number {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    function ratio(a: string, b: string): number {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }

    const seeds = [
      'virgin-atlantic',
      'alaska-atmos',
      'lifemiles',
      'aeroplan',
      'american-aadvantage',
      'delta-skymiles',
      'united-mileageplus',
      'air-canada-aeroplan',
      'avianca-lifemiles',
      'turkish-miles-and-smiles',
    ]
    for (const seed of seeds) {
      const markup = render(seed)
      const bg = markup.match(/<rect[^>]*fill="(#[0-9a-fA-F]{6})"/)?.[1]
      const logoColor = markup.match(/style="color:\s*(#[0-9a-fA-F]{6})"/)?.[1]
      expect(bg).toBeTruthy()
      expect(logoColor).toBeTruthy()
      expect(ratio(bg!, logoColor!)).toBeGreaterThanOrEqual(3)
    }
  })
})
