// Turns the committed place facts (lib/place-facts) into terse, honest UI: the
// "essentials" chips and a computed "how far your dollar goes" line. Pure +
// deterministic — every figure comes from the committed snapshot, date-stamped,
// never generated.

import { PLACE_FACTS, CURRENCY, FX, type Currency } from './place-facts'

export interface Essentials {
  currency: (Currency & { code: string }) | null
  language: string | null
  utcOffset: string | null
}

// The currency / language / local-time facts for a destination, or nulls.
export function essentials(code: string): Essentials {
  const f = PLACE_FACTS[code]
  if (!f) return { currency: null, language: null, utcOffset: null }
  const cur = f.currencyCode ? CURRENCY[f.currencyCode] : undefined
  return {
    currency: cur && f.currencyCode ? { ...cur, code: f.currencyCode } : null,
    language: f.language || null,
    utcOffset: f.utcOffset,
  }
}

// Render a "units per USD" rate at a sensible precision for its magnitude.
function formatRate(n: number): string {
  if (n >= 1000) return Math.round(n).toLocaleString('en-US')
  if (n >= 100) return String(Math.round(n))
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

// The month label of the FX snapshot, for the "as of" stamp (e.g. "Jun 2026").
export function fxAsOf(): string {
  const [y, m] = FX.date.split('-')
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    parseInt(m, 10) - 1
  ]
  return `${month} ${y}`
}

// A computed "how far your dollar goes" line — the live-ish rate plus a
// one-year trend from the same ECB/Frankfurter snapshot. Null when there's no
// conversion (USD destinations) or no rate on file (currency outside ECB cover).
export function dollarSignal(code: string): string | null {
  const f = PLACE_FACTS[code]
  if (!f?.currencyCode || f.currencyCode === 'USD') return null
  const cur = CURRENCY[f.currencyCode]
  const now = FX.rates[f.currencyCode]
  if (!cur || now == null) return null

  const rate = `${cur.symbol}${formatRate(now)}`
  const ago = FX.agoRates[f.currencyCode]
  let trend = ''
  if (ago != null && ago > 0) {
    const pct = Math.round(((now - ago) / ago) * 100)
    if (pct >= 4) trend = ` — up ${pct}% over the past year, so your money goes further here`
    else if (pct <= -4) trend = ` — down ${Math.abs(pct)}% over the past year`
    else trend = ' — about flat over the past year'
  }
  return `$1 ≈ ${rate}${trend}.`
}
