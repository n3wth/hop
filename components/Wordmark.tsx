// Custom hand-drawn "hop" wordmark — option A "rising baseline".
// Monoline SVG letterforms (not a font): even stroke weight + round terminals
// matched to the line-art bunny, with each letter's baseline stepping up
// (h→o→p) so the word itself spells the upward leap.
// Single <path>, stroke uses currentColor so it inherits text color.
// Source of truth: scratchpad/wordmark-custom.html → wordA / h() / o() / p().

// viewBox 0 0 209 120. Stroke 18, round caps/joins → even weight by construction.
const HOP_PATH =
  'M11 18 L11 96 M11 59.6 C11 49 23 43 33 43 C43 43 55 49 55 59.6 L55 96 ' +
  'M96 30 C110.3598 30 122 41.6402 122 56 C122 70.3598 110.3598 82 96 82 C81.6402 82 70 70.3598 70 56 C70 41.6402 81.6402 30 96 30 Z ' +
  'M135 16 L135 92 M135 16 C161 15 187 27.6402 187 42 C187 56.3598 161 69 135 68'

const VB_W = 209
const VB_H = 120

export interface WordmarkProps {
  /** Rendered height in px (sets width via the wordmark's aspect ratio). */
  size?: number
  className?: string
}

export default function Wordmark({ size = 28, className }: WordmarkProps) {
  const width = (VB_W / VB_H) * size
  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      fill="none"
      role="img"
      aria-label="hop"
      className={className}
    >
      <path
        d={HOP_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
