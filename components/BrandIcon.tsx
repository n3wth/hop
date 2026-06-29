// Shared brand mark for airlines AND loyalty programs. Real SVGs from
// /public (airlines + programs) are recolored to a MUTED brand hue via CSS
// masking (mask-image uses alpha only, so it works regardless of the file's
// own fill). Rendered in a soft tinted chip that fits the cream/teal canvas.
//
// Any carrier WITHOUT a logo still gets a clean, intentional mark: its 2-letter
// IATA code in a per-airline muted hue derived deterministically from the code,
// so a row of mixed carriers reads as a cohesive set — never a blank chip.
//
// Brand data + resolution live in lib/brands.ts (pure, unit-tested).

import {
  BRANDS,
  lighten,
  monogramGlyph,
  monogramHue,
  resolveBrand,
  type BrandSlug,
} from '@/lib/brands'

export type { BrandSlug }
export { resolveBrand }

export interface BrandIconProps {
  slug?: BrandSlug
  code?: string
  name?: string
  /** Tile edge length in px. */
  size?: number
  /** 'light' chip (cream/paper, default) or 'dark' chip (for the wallet). */
  surface?: 'light' | 'dark'
  className?: string
}

export default function BrandIcon({
  slug,
  code,
  name,
  size = 44,
  surface = 'light',
  className = '',
}: BrandIconProps) {
  const resolved = resolveBrand({ slug, code, name })
  const def = resolved ? BRANDS[resolved] : undefined
  const radius = Math.round(size * 0.27)
  const glyph = Math.round(size * 0.58)

  const monogram = def?.mono ?? monogramGlyph(code, name)

  // Muted brand hue for known brands; a deterministic per-carrier hue otherwise.
  const baseHue = def?.hue ?? monogramHue(monogram)
  const glyphColor = surface === 'dark' ? lighten(baseHue) : baseHue

  // Soft tinted chip: the muted hue at low opacity on the surface.
  const chipBg =
    surface === 'dark'
      ? 'rgba(255,255,255,0.08)'
      : `color-mix(in srgb, ${baseHue} 12%, var(--color-surface))`
  const chipRing =
    surface === 'dark'
      ? 'none'
      : `1px solid color-mix(in srgb, ${baseHue} 18%, var(--color-border))`

  // Scale the monogram type to the chip so 2 letters always fit cleanly.
  const monoSize = Math.max(10, Math.round(size * (monogram.length >= 2 ? 0.3 : 0.36)))

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size, borderRadius: radius, background: chipBg, border: chipRing }}
    >
      {def?.src ? (
        <span
          aria-label={name ?? resolved}
          role="img"
          style={{
            width: glyph,
            height: glyph,
            backgroundColor: glyphColor,
            WebkitMaskImage: `url(${def.src})`,
            maskImage: `url(${def.src})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      ) : (
        <span
          aria-label={name ?? code}
          role="img"
          className="font-display font-bold leading-none tracking-tight"
          style={{ color: glyphColor, fontSize: monoSize }}
        >
          {monogram}
        </span>
      )}
    </div>
  )
}
