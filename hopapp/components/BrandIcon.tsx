// Shared brand mark for airlines AND loyalty programs. Real SVGs from
// /public (airlines + programs) are recolored to a MUTED brand hue via CSS
// masking (mask-image uses alpha only, so it works regardless of the file's
// own fill). Rendered in a soft tinted chip that fits the cream/teal canvas.

export type BrandSlug =
  | 'alaska'
  | 'southwest'
  | 'united'
  | 'american'
  | 'british'
  | 'amex'
  | 'chase'
  | 'bilt'

interface BrandDef {
  // path under /public, or null for a monogram-only brand (e.g. Bilt)
  src: string | null
  // muted/desaturated brand hue — recognizable but soft on cream
  hue: string
  mono: string // monogram fallback letter
}

// Muted brand hues — derived from the real brand colors, desaturated toward
// the warm palette so a row of chips reads as a tasteful, cohesive set.
const BRANDS: Record<BrandSlug, BrandDef> = {
  alaska: { src: '/airlines/alaska.svg', hue: '#3a5a7a', mono: 'A' }, // #01426A muted
  southwest: { src: '/airlines/southwest.svg', hue: '#5566a8', mono: 'W' }, // #304CB2 muted
  united: { src: '/airlines/united.svg', hue: '#3d5170', mono: 'U' }, // #002244 muted
  american: { src: '/airlines/american.svg', hue: '#b05568', mono: 'A' }, // #C8102E muted
  british: { src: '/airlines/british.svg', hue: '#4a6a96', mono: 'B' }, // #2E5C99 muted
  amex: { src: '/programs/amex.svg', hue: '#3f7aa6', mono: 'A' }, // #006FCF muted
  chase: { src: '/programs/chase.svg', hue: '#3f7aa6', mono: 'C' }, // #117ACA muted
  bilt: { src: null, hue: '#5a5750', mono: 'B' }, // neutral dark, no brand icon
}

// Tolerant resolver: explicit slug wins; else match by code/name.
export function resolveBrand(opts: {
  slug?: BrandSlug
  code?: string
  name?: string
}): BrandSlug | undefined {
  if (opts.slug) return opts.slug
  const code = opts.code?.toUpperCase()
  const byCode: Record<string, BrandSlug> = {
    AS: 'alaska',
    WN: 'southwest',
    UA: 'united',
    AA: 'american',
    BA: 'british',
    AX: 'amex',
    UR: 'chase',
    BR: 'bilt',
  }
  if (code && byCode[code]) return byCode[code]
  const n = (opts.name ?? '').toLowerCase()
  if (n.includes('alaska')) return 'alaska'
  if (n.includes('southwest')) return 'southwest'
  if (n.includes('united')) return 'united'
  if (n.includes('american')) return 'american'
  if (n.includes('british')) return 'british'
  if (n.includes('amex') || n.includes('american express') || n.includes('membership rewards'))
    return 'amex'
  if (n.includes('chase') || n.includes('ultimate rewards')) return 'chase'
  if (n.includes('bilt')) return 'bilt'
  return undefined
}

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

  // Muted brand hue, lightened for dark chips so it reads on the wallet bg.
  const hue = def?.hue ?? 'var(--color-brand)'
  const glyphColor = surface === 'dark' ? lighten(hue) : hue

  // Soft tinted chip: the muted hue at low opacity on the surface.
  const chipBg =
    surface === 'dark'
      ? 'rgba(255,255,255,0.08)'
      : `color-mix(in srgb, ${hue} 12%, var(--color-surface))`
  const chipRing =
    surface === 'dark' ? 'none' : `1px solid color-mix(in srgb, ${hue} 18%, var(--color-border))`

  const monogram = def?.mono ?? (code ?? name ?? '?').slice(0, 1).toUpperCase()

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
          className="font-display text-[13px] font-bold"
          style={{ color: glyphColor }}
        >
          {monogram}
        </span>
      )}
    </div>
  )
}

// Lighten a hex toward white for legibility on dark chips.
function lighten(hex: string): string {
  const m = hex.replace('#', '')
  if (m.length !== 6) return hex
  const r = parseInt(m.slice(0, 2), 16)
  const g = parseInt(m.slice(2, 4), 16)
  const b = parseInt(m.slice(4, 6), 16)
  const mix = (c: number) => Math.round(c + (255 - c) * 0.55)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
