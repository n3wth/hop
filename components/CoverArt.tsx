import Logo from './Logo'

// Generative program cover art — an Apple-Music-shelf-style abstract tile,
// entirely server-rendered SVG. No client JS, no canvas, no Math.random/
// Date.now — the same `seed` must render byte-identical markup on every
// request and every build (SSR determinism), so the artwork is safe to
// prerender on the static /sweet-spots tree.
//
// Everything is picked from a CLOSED, hand-curated set: nothing is invented
// per-seed. The hash only selects WHICH member of the palette/rotation set a
// given seed gets, so every tile stays inside the flat-editorial system (no
// gradients, no arbitrary colors).

// Closed palette — literal copies of hex values in app/globals.css `@theme`.
// CoverArt renders server-side before any stylesheet exists, so it cannot
// read CSS custom properties at runtime; keep these in sync by hand if those
// tokens change. Every color CoverArt ever emits is a member of one of the
// two bands below.
//
// Split into a DARK band (canvas + recessive arcs) and a LIGHT band (the
// carved logo + accent arcs), rather than one undifferentiated set, because
// every DARK×LIGHT pair clears >=3.8:1 luminance contrast (checked by hand
// against contrast.test.ts's ratio()) while several same-band pairs don't —
// drawing bg and logoColor from the same flat list let some seeds render an
// invisible bunny (logo == bg) or a muddy near-match. Background always
// comes from DARK, the logo always from LIGHT, so the two can never collide.
const DARK = [
  '#0d6e6e', // --color-brand
  '#0a5757', // --color-brand-deep
  '#073e3e', // --color-brand-ink
  '#2c6f6b', // --color-brand-muted
  '#8f5618', // --color-ok / --color-amber
  '#a8513a', // --color-weak
  '#14201f', // --color-text
] as const

const LIGHT = [
  '#ffe7b0', // --color-gold-soft
  '#6ff0d2', // --color-mint-bright
  '#e3f1ef', // --color-brand-light / --color-good-bg
  '#cfe6e2', // --color-brand-mint-deep
  '#eef7f4', // --color-brand-tint
] as const

// Closed set of arc rotations (degrees) — every tile uses exactly these five
// positions, always in this order. Only the color/radius assignment per
// position varies by seed; the geometry itself never does.
const ARC_ROTATIONS = [-14, -6, 10, 22, 34] as const

// djb2 — deterministic 32-bit string hash. Picked over Math.random()/crypto
// specifically because it's pure and synchronous: same input, same output,
// forever, on server and client alike.
function djb2(seed: string): number {
  let hash = 5381
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33 + seed.charCodeAt(i)) >>> 0
  }
  return hash >>> 0
}

export interface CoverArtProps {
  /** Deterministic seed — a program slug, route, or other stable id. The same
      seed always renders the same artwork (list tile and detail header share
      one seed on purpose, so a program's cover art reads as one object). */
  seed: string
  /** Rendered size in px (square tile). */
  size?: number
  /** Human label for the accessible name; falls back to the raw seed. */
  label?: string
  /** Decorative mode: when CoverArt sits inside an element that already
      names the record (e.g. a program `<Link>` with its own heading), hide
      the SVG from the a11y tree instead of doubling the announcement.
      Defaults to a labelled standalone image. */
  decorative?: boolean
  className?: string
}

export default function CoverArt({
  seed,
  size = 160,
  label,
  decorative = false,
  className,
}: CoverArtProps) {
  const hash = djb2(seed)
  const bg = DARK[hash % DARK.length]
  const logoColor = LIGHT[(hash >>> 5) % LIGHT.length]

  const arcs = ARC_ROTATIONS.map((rotation, i) => {
    const radius = 44 - i * 8 // 44, 36, 28, 20, 12 — fixed, closed radii
    // Alternate bands by position (recessive/dark, then accent/light) so
    // every tile has both a subtle blended ring and a couple that pop —
    // never all-recessive (invisible against bg) or all-accent (no depth).
    const band = i % 2 === 0 ? DARK : LIGHT
    const color = band[(hash >>> (i * 3 + 2)) % band.length]
    const circumference = 2 * Math.PI * radius
    const visible = circumference * 0.52 // a little over half the ring — an arc, not a full circle
    return { rotation, radius, color, circumference, visible }
  })

  // Logo carve trick (components/Logo.tsx): the bunny mark's negative space
  // (eyes, ear gaps) is cut via a real SVG <mask>, not painted over, so
  // whatever sits behind it — here, the arcs — shows through. Reusing the
  // component directly (rather than re-implementing the mask) is the trick:
  // one carved mark, applied to any generated backdrop.
  const logoUnits = 46
  const logoOffset = (100 - logoUnits) / 2

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      {...(decorative
        ? { 'aria-hidden': true }
        : { role: 'img', 'aria-label': `Cover art — ${label ?? seed}` })}
    >
      <rect x="0" y="0" width="100" height="100" fill={bg} />
      <g transform="translate(50 50)">
        {arcs.map((arc, i) => (
          <circle
            key={i}
            r={arc.radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${arc.visible} ${arc.circumference}`}
            transform={`rotate(${arc.rotation})`}
          />
        ))}
      </g>
      <Logo
        decorative
        size={logoUnits}
        x={logoOffset}
        y={logoOffset}
        style={{ color: logoColor }}
      />
    </svg>
  )
}
