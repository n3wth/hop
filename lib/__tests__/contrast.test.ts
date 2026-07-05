import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// WCAG contrast guard for the on-dark (teal hero / dark wallet) text tiers.
// R1.7 lightened --color-hero-label / --color-hero-eyebrow to clear AA against
// --color-brand; this test reads app/globals.css directly so a token tweak
// that regresses contrast fails CI instead of shipping an unreadable hero.
// Small-text tiers must clear 4.5:1; display-only accents (gold-soft,
// mint-bright — rendered ≥20px semibold) must clear the large-text 3:1 bar.

const css = readFileSync(resolve(__dirname, '../../app/globals.css'), 'utf8')

function tokenHex(name: string): string {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!m) throw new Error(`token ${name} not found in app/globals.css`)
  return m[1].toLowerCase()
}

// Relative luminance per WCAG 2.x (sRGB).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

describe('on-teal text tiers — WCAG AA against --color-brand', () => {
  const brand = tokenHex('--color-brand')

  it.each([
    ['--color-hero-body', 4.5],
    ['--color-hero-label', 4.5],
    ['--color-hero-eyebrow', 4.5],
    ['--color-hero-cream', 4.5],
  ])('%s clears %s:1 (small text)', (token, min) => {
    expect(ratio(tokenHex(token), brand)).toBeGreaterThanOrEqual(min as number)
  })

  it.each([
    ['--color-gold-soft', 3.0],
    ['--color-mint-bright', 3.0],
  ])('%s clears %s:1 (display sizes only)', (token, min) => {
    expect(ratio(tokenHex(token), brand)).toBeGreaterThanOrEqual(min as number)
  })

  it('the darker hero surfaces only raise contrast (brand is the binding bg)', () => {
    // brand-deep / brand-ink are darker than brand, so any tier that passes on
    // brand passes there too — assert the premise so a palette inversion trips.
    expect(luminance(tokenHex('--color-brand-deep'))).toBeLessThanOrEqual(
      luminance(tokenHex('--color-brand')),
    )
    expect(luminance(tokenHex('--color-brand-ink'))).toBeLessThanOrEqual(
      luminance(tokenHex('--color-brand')),
    )
  })
})
