// lib/climate.ts
//
// Turns real monthly climate normals into an honest, city-specific "when to go"
// window. THESIS: every word here is COMPUTED from committed climate data
// (ERA5 reanalysis via Open-Meteo, baked offline into lib/climate-normals.ts) —
// never LLM-generated. The summary sentence is a deterministic template filled
// from the numbers, so it can never drift from the data or invent a season.
//
// Method (the standard travel-planning heuristic, made explicit): score each
// month by temperature comfort (a walkable 64–75°F band) plus relative dryness;
// the best window is the peak of that score, and a stretch is flagged "skip"
// only when the data shows it is genuinely hot, cold, or wet — never to shame a
// uniformly pleasant place.

export const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

// 12 entries each, Jan→Dec. A month may be null if the source lacked data.
export interface MonthlyNormals {
  tempF: (number | null)[]
  precipMM: (number | null)[]
}

export interface Seasonality {
  scores: number[] // 0..1 comfort score per month (null/absent months → 0)
  bestMonths: number[] // 0-indexed, the genuinely-best travel window
  avoidMonths: number[] // 0-indexed, only a notably-worse stretch (often empty)
  warmest: number
  coolest: number
  driest: number
  wettest: number
  summary: string // one honest, computed sentence
}

// Comfort from mean temperature (°F): full marks across a walkable 64–75°F band,
// tapering linearly to 0 at 35°F (cold) and 95°F (oppressive).
function tempComfort(t: number): number {
  if (t >= 64 && t <= 75) return 1
  if (t < 64) return Math.max(0, (t - 35) / (64 - 35))
  return Math.max(0, (95 - t) / (95 - 75))
}

function present(n: (number | null)[]): { i: number; v: number }[] {
  return n
    .map((v, i) => ({ i, v: v as number }))
    .filter((x) => x.v != null && Number.isFinite(x.v))
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Group 0-indexed months into human ranges, honoring the Dec→Jan wrap.
// [2,3,4] → "Mar–May"; [11,0,1] → "Dec–Feb"; [2,9] → "Mar and Oct".
export function monthRanges(months: number[]): string {
  if (months.length === 0) return ''
  const set = new Set(months)
  const seen = new Set<number>()
  const runs: number[][] = []
  for (let start = 0; start < 12; start++) {
    if (!set.has(start) || seen.has(start)) continue
    if (set.has((start + 11) % 12)) continue // not a run start (predecessor present)
    const run: number[] = []
    let m = start
    while (set.has(m) && !seen.has(m)) {
      run.push(m)
      seen.add(m)
      m = (m + 1) % 12
    }
    runs.push(run)
  }
  if (seen.size < set.size) {
    // A full ring (every month present) leaves no run-start; emit it as one span.
    runs.push(months.filter((m) => !seen.has(m)).sort((a, b) => a - b))
  }
  const fmt = (run: number[]) =>
    run.length === 1
      ? MONTH_ABBR[run[0]]
      : `${MONTH_ABBR[run[0]]}–${MONTH_ABBR[run[run.length - 1]]}`
  return runs.map(fmt).join(' and ')
}

function tempWord(t: number): string {
  if (t < 46) return 'cold'
  if (t < 58) return 'cool'
  if (t < 64) return 'crisp'
  if (t <= 75) return 'mild'
  if (t <= 84) return 'warm'
  return 'hot'
}

// Compute the seasonality verdict from monthly normals. Pure + deterministic.
export function computeSeasonality(normals: MonthlyNormals): Seasonality | null {
  const temps = present(normals.tempF)
  const precs = present(normals.precipMM)
  if (temps.length < 6) return null // too sparse to be honest about

  const minP = precs.length ? Math.min(...precs.map((x) => x.v)) : 0
  const maxP = precs.length ? Math.max(...precs.map((x) => x.v)) : 0
  const precipBy = new Map(precs.map((x) => [x.i, x.v]))
  const spread = maxP - minP
  // A <35mm month-to-month range is meteorological noise, not a wet/dry signal —
  // don't let it manufacture a "rainy season" for a uniformly even climate.
  const rainMeaningful = spread >= 35
  const dryOf = (m: number): number => {
    if (!rainMeaningful) return 0.5
    const p = precipBy.get(m)
    return p == null ? 0.5 : (maxP - p) / spread
  }

  const scores = new Array(12).fill(0)
  for (const { i, v } of temps) {
    scores[i] = Math.round((0.62 * tempComfort(v) + 0.38 * dryOf(i)) * 1000) / 1000
  }

  const scored = temps.map((x) => ({ i: x.i, s: scores[x.i] }))
  const maxS = Math.max(...scored.map((x) => x.s))
  const minS = Math.min(...scored.map((x) => x.s))

  // Best window: every month within a small band of the peak score.
  const bestMonths = scored
    .filter((x) => x.s >= maxS - 0.1)
    .map((x) => x.i)
    .sort((a, b) => a - b)

  const tAll = temps.map((x) => x.v)
  const tMax = Math.max(...tAll)
  const tMin = Math.min(...tAll)
  const tRangeYear = tMax - tMin

  // Avoid: one coherent worst stretch, flagged only when clearly hot/cold/wet.
  let avoidMonths: number[] = []
  let reason = ''
  if (maxS - minS >= 0.28) {
    const worst = scored.reduce((a, b) => (b.s < a.s ? b : a))
    const wt = normals.tempF[worst.i] as number
    const cause: 'hot' | 'cold' | 'wet' =
      wt >= 80 && tRangeYear > 10 ? 'hot' : wt <= 41 && tRangeYear > 10 ? 'cold' : 'wet'
    const low = minS + 0.1
    const shares = (m: number): boolean => {
      const tm = normals.tempF[m]
      if (tm == null) return false
      if (cause === 'hot') return tm >= 80
      if (cause === 'cold') return tm <= 40
      return scores[m] <= low
    }
    const run = [worst.i]
    for (let step = 1; step < 12; step++) {
      const m = (worst.i + step) % 12
      if (shares(m)) run.push(m)
      else break
    }
    for (let step = 1; step < 12; step++) {
      const m = (worst.i - step + 12) % 12
      if (shares(m)) run.push(m)
      else break
    }
    const stretch = [...new Set(run)].sort((a, b) => a - b)
    const avgT = stretch.reduce((s, m) => s + (normals.tempF[m] as number), 0) / stretch.length
    const avgDry = stretch.reduce((s, m) => s + dryOf(m), 0) / stretch.length
    const avgP = rainMeaningful
      ? stretch.reduce((s, m) => s + (precipBy.get(m) ?? 0), 0) / stretch.length
      : 0
    const clearlyBad =
      (cause === 'hot' && avgT >= 81) ||
      (cause === 'cold' && avgT <= 42) ||
      (cause === 'wet' && rainMeaningful && avgDry < 0.4 && avgP >= 85)
    if (clearlyBad) {
      avoidMonths = stretch
      reason =
        cause === 'hot'
          ? avgDry < 0.42
            ? 'peak heat and rain'
            : 'peak heat'
          : cause === 'cold'
            ? avgT <= 35
              ? 'deep winter cold'
              : 'winter cold'
            : 'the wet season'
    }
  }

  const warmest = temps.reduce((a, b) => (b.v > a.v ? b : a)).i
  const coolest = temps.reduce((a, b) => (b.v < a.v ? b : a)).i
  const driest = precs.length ? precs.reduce((a, b) => (b.v < a.v ? b : a)).i : warmest
  const wettest = precs.length ? precs.reduce((a, b) => (b.v > a.v ? b : a)).i : coolest

  // ---- Compose one honest sentence from the computed values ----
  const bestAvgTemp =
    bestMonths.reduce((s, m) => s + (normals.tempF[m] as number), 0) / bestMonths.length
  const lo = Math.round(Math.min(...bestMonths.map((m) => normals.tempF[m] as number)))
  const hi = Math.round(Math.max(...bestMonths.map((m) => normals.tempF[m] as number)))
  const tRange = lo === hi ? `around ${lo}°F` : `${lo}–${hi}°F`
  const bestDry = bestMonths.reduce((s, m) => s + dryOf(m), 0) / bestMonths.length
  const dryClause = rainMeaningful && bestDry >= 0.6 ? ' and among the drier stretches' : ''

  let summary =
    bestMonths.length >= 10
      ? `${cap(tempWord(bestAvgTemp))} nearly year-round (${tRange})${dryClause}.`
      : `${monthRanges(bestMonths)} is the sweet spot — ${tempWord(bestAvgTemp)} (${tRange})${dryClause}.`
  if (avoidMonths.length) summary += ` Skip ${monthRanges(avoidMonths)} — ${reason}.`

  return { scores, bestMonths, avoidMonths, warmest, coolest, driest, wettest, summary }
}
