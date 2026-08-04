// Tiny single-series trend line for stat tiles. Server-renderable pure SVG in
// the flat-editorial language: one 2px brand-colored line, zero-based scale
// (honest for counts — a flat week is a flat line), an endpoint dot, no fills,
// no gradients, no axes. Identity comes from the tile's label, so there is no
// legend; the values ride along for assistive tech and as a native tooltip.
export default function Sparkline({
  data,
  label,
  width = 96,
  height = 28,
}: {
  /** Weekly counts, oldest → newest (lib/business-digest bucketWeeks order). */
  data: number[]
  /** What the series counts, for the accessible name — e.g. "Active users". */
  label: string
  width?: number
  height?: number
}) {
  if (data.length < 2) return null

  const max = Math.max(...data)
  const pad = 3 // keeps the endpoint dot + 2px stroke inside the viewBox
  const x = (i: number) => pad + (i * (width - pad * 2)) / (data.length - 1)
  // Zero-based y: 0 sits on the baseline, max at the top. All-zero → baseline.
  const y = (v: number) => height - pad - (max === 0 ? 0 : (v / max) * (height - pad * 2))
  const points = data.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = data[data.length - 1]
  const desc = `${label}, last ${data.length} weeks: ${data.join(', ')}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={desc}
      className={max === 0 ? 'text-border' : 'text-brand'}
    >
      <title>{desc}</title>
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(data.length - 1)} cy={y(last)} r="2.5" fill="currentColor" />
    </svg>
  )
}
