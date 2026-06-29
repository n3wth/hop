// Brand resolution + chip styling for airlines AND loyalty programs.
// Pure (no JSX) so it's unit-testable; consumed by components/BrandIcon.tsx.
//
// Any carrier WITHOUT a logo still gets a clean, intentional mark: its 2-letter
// IATA code in a per-airline muted hue derived deterministically from the code,
// so a row of mixed carriers reads as a cohesive set — never a blank chip.

export type BrandSlug =
  | 'alaska'
  | 'southwest'
  | 'united'
  | 'american'
  | 'british'
  | 'delta'
  | 'jetblue'
  | 'aircanada'
  | 'lufthansa'
  | 'airfrance'
  | 'klm'
  | 'virginatlantic'
  | 'emirates'
  | 'qatar'
  | 'etihad'
  | 'singapore'
  | 'ana'
  | 'cathay'
  | 'qantas'
  | 'turkish'
  | 'amex'
  | 'chase'
  | 'bilt'
  | 'frontier'

export interface BrandDef {
  // path under /public, or null for a monogram-only brand (e.g. Bilt)
  src: string | null
  // muted/desaturated brand hue — recognizable but soft on cream
  hue: string
  mono: string // monogram fallback letter(s)
}

// Muted brand hues — derived from the real brand colors, desaturated toward
// the warm/teal palette so a row of chips reads as a tasteful, cohesive set.
export const BRANDS: Record<BrandSlug, BrandDef> = {
  alaska: { src: '/airlines/alaska.svg', hue: '#3a5a7a', mono: 'AS' }, // #01426A muted
  southwest: { src: '/airlines/southwest.svg', hue: '#5566a8', mono: 'WN' }, // #304CB2 muted
  united: { src: '/airlines/united.svg', hue: '#3d5170', mono: 'UA' }, // #002244 muted
  american: { src: '/airlines/american.svg', hue: '#b05568', mono: 'AA' }, // #C8102E muted
  british: { src: '/airlines/british.svg', hue: '#4a6a96', mono: 'BA' }, // #2E5C99 muted
  delta: { src: '/airlines/delta.svg', hue: '#9a5566', mono: 'DL' }, // #C8102E/#003366 muted
  jetblue: { src: '/airlines/jetblue.svg', hue: '#3f6ea0', mono: 'B6' }, // #003876 muted
  aircanada: { src: '/airlines/aircanada.svg', hue: '#a8545e', mono: 'AC' }, // #D8232A muted
  lufthansa: { src: '/airlines/lufthansa.svg', hue: '#3a5577', mono: 'LH' }, // #05164D muted
  airfrance: { src: '/airlines/airfrance.svg', hue: '#4a5e9a', mono: 'AF' }, // #002157 muted
  klm: { src: '/airlines/klm.svg', hue: '#4a7aa6', mono: 'KL' }, // #00A1DE muted
  virginatlantic: { src: '/airlines/virginatlantic.svg', hue: '#a8545e', mono: 'VS' }, // #E10A0A muted
  emirates: { src: '/airlines/emirates.svg', hue: '#9a5560', mono: 'EK' }, // #D71921 muted
  qatar: { src: '/airlines/qatar.svg', hue: '#7d4a60', mono: 'QR' }, // #5C0632 muted
  etihad: { src: '/airlines/etihad.svg', hue: '#9a7a55', mono: 'EY' }, // #BD8B13 muted
  singapore: { src: '/airlines/singapore.svg', hue: '#3a5577', mono: 'SQ' }, // navy muted
  ana: { src: '/airlines/ana.svg', hue: '#3f5e96', mono: 'NH' }, // #13256B muted
  cathay: { src: '/airlines/cathay.svg', hue: '#3f7a72', mono: 'CX' }, // #006564 muted
  qantas: { src: '/airlines/qantas.svg', hue: '#a8545e', mono: 'QF' }, // #E40000 muted
  turkish: { src: '/airlines/turkish.svg', hue: '#a8545e', mono: 'TK' }, // #C8102E muted
  amex: { src: '/programs/amex.svg', hue: '#3f7aa6', mono: 'AX' }, // #006FCF muted
  chase: { src: '/programs/chase.svg', hue: '#3f7aa6', mono: 'UR' }, // #117ACA muted
  bilt: { src: null, hue: '#5a5750', mono: 'B' }, // neutral dark, no brand icon
  frontier: { src: null, hue: '#3f7a5e', mono: 'F9' }, // muted green, monogram-only (no logo)
}

// IATA code -> slug for carriers/programs we have a real logo (or curated def) for.
const CODE_TO_SLUG: Record<string, BrandSlug> = {
  AS: 'alaska',
  WN: 'southwest',
  UA: 'united',
  AA: 'american',
  BA: 'british',
  DL: 'delta',
  B6: 'jetblue',
  AC: 'aircanada',
  LH: 'lufthansa',
  AF: 'airfrance',
  KL: 'klm',
  VS: 'virginatlantic',
  EK: 'emirates',
  QR: 'qatar',
  EY: 'etihad',
  SQ: 'singapore',
  NH: 'ana',
  CX: 'cathay',
  QF: 'qantas',
  TK: 'turkish',
  AX: 'amex',
  UR: 'chase',
  BR: 'bilt',
  F9: 'frontier',
}

// name substring -> slug, ordered most-specific first.
const NAME_TO_SLUG: Array<[string, BrandSlug]> = [
  ['alaska', 'alaska'],
  ['southwest', 'southwest'],
  ['united', 'united'],
  ['american airlines', 'american'],
  ['british', 'british'],
  ['delta', 'delta'],
  ['jetblue', 'jetblue'],
  ['air canada', 'aircanada'],
  ['lufthansa', 'lufthansa'],
  ['air france', 'airfrance'],
  ['klm', 'klm'],
  ['virgin atlantic', 'virginatlantic'],
  ['emirates', 'emirates'],
  ['qatar', 'qatar'],
  ['etihad', 'etihad'],
  ['singapore', 'singapore'],
  ['cathay', 'cathay'],
  ['qantas', 'qantas'],
  ['turkish', 'turkish'],
  ['frontier', 'frontier'],
  // program names
  ['american express', 'amex'],
  ['membership rewards', 'amex'],
  ['amex', 'amex'],
  ['ultimate rewards', 'chase'],
  ['chase', 'chase'],
  ['bilt', 'bilt'],
]

// Tolerant resolver: explicit slug wins; else match by code, then name.
export function resolveBrand(opts: {
  slug?: BrandSlug
  code?: string
  name?: string
}): BrandSlug | undefined {
  if (opts.slug) return opts.slug
  const code = opts.code?.toUpperCase()
  if (code && CODE_TO_SLUG[code]) return CODE_TO_SLUG[code]
  const n = (opts.name ?? '').toLowerCase()
  // ANA's name is ambiguous ("All Nippon Airways"); match before generic loop.
  if (n.includes('nippon')) return 'ana'
  for (const [needle, slug] of NAME_TO_SLUG) {
    if (n.includes(needle)) return slug
  }
  return undefined
}

// Deterministic muted hue for carriers WITHOUT a logo, so each gets a stable,
// cohesive chip color. Hashes the glyph to a hue band that lives in the
// warm/teal-friendly range (avoids garish primaries) at fixed muted S/L.
export function monogramHue(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  // Two cohesive hue bands on the cream/teal canvas: teal-blue (172-215) and
  // warm clay (18-39). Pick a band by the hash, then a hue within it.
  const useWarm = h % 5 === 0 // ~1 in 5 chips are warm — keeps the set teal-leaning
  const hue = useWarm ? 18 + (h % 22) : 172 + (h % 44)
  return `hsl(${hue}, 32%, 42%)`
}

// The glyph shown in a monogram chip: prefer the 2-letter IATA code, else the
// first two alpha chars of the name, else a single char. Always uppercase.
export function monogramGlyph(code?: string, name?: string): string {
  const c = (code ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  if (c.length >= 2) return c.slice(0, 2)
  const letters = (name ?? '').replace(/[^A-Za-z]/g, '')
  if (letters.length >= 2) return letters.slice(0, 2).toUpperCase()
  return (c || letters || name || code || '?').slice(0, 1).toUpperCase()
}

// Lighten a color toward white for legibility on dark chips. Handles hex and
// hsl() (deterministic monogram hues) by bumping lightness; passes others through.
export function lighten(color: string): string {
  if (color.startsWith('#')) {
    const m = color.replace('#', '')
    if (m.length !== 6) return color
    const r = parseInt(m.slice(0, 2), 16)
    const g = parseInt(m.slice(2, 4), 16)
    const b = parseInt(m.slice(4, 6), 16)
    const mix = (c: number) => Math.round(c + (255 - c) * 0.55)
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
  }
  const hsl = color.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/)
  if (hsl) {
    const h = hsl[1]
    const s = hsl[2]
    const l = Math.min(82, parseInt(hsl[3], 10) + 34)
    return `hsl(${h}, ${s}%, ${l}%)`
  }
  return color
}
