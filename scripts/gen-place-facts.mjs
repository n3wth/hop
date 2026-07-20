// Regenerates lib/place-facts.ts from real, keyless/CC0 sources. Run offline,
// commit the output:
//
//   node scripts/gen-place-facts.mjs > lib/place-facts.ts
//
// Per destination it pulls the currency code + the fact itself from Wikidata
// (CC0), the timezone from Open-Meteo geocoding, and a USD FX snapshot (latest +
// ~1 year ago) from Frankfurter (ECB data). We fetch ONCE here and commit, so the
// live site never calls these. Currency display NAMES and the primary LANGUAGE
// are curated below for accuracy/voice — Wikidata's raw P37 language list is
// noisy (sign languages, de-facto entries) and mislabels a few currencies — while
// the currency CODE, timezone, and FX stay sourced.
//
// Keep DESTS in sync with lib/destinations.ts. Wikidata: CC0. Open-Meteo / ECB
// via Frankfurter: attribute lightly where shown.

const DESTS = [
  ['NRT', 'Tokyo', 'JP'], ['KIX', 'Kyoto', 'JP'], ['ICN', 'Seoul', 'KR'],
  ['BKK', 'Bangkok', 'TH'], ['SIN', 'Singapore', 'SG'], ['DPS', 'Denpasar', 'ID'],
  ['SYD', 'Sydney', 'AU'], ['ZQN', 'Queenstown', 'NZ'], ['CPT', 'Cape Town', 'ZA'],
  ['RAK', 'Marrakesh', 'MA'], ['IST', 'Istanbul', 'TR'], ['ATH', 'Athens', 'GR'],
  ['CDG', 'Paris', 'FR'], ['BCN', 'Barcelona', 'ES'], ['LIS', 'Lisbon', 'PT'],
  ['FCO', 'Rome', 'IT'], ['KEF', 'Reykjavik', 'IS'], ['YVR', 'Vancouver', 'CA'],
  ['MEX', 'Mexico City', 'MX'], ['CTG', 'Cartagena', 'CO'], ['LIM', 'Lima', 'PE'],
  ['EZE', 'Buenos Aires', 'AR'], ['HNL', 'Honolulu', 'US'], ['OGG', 'Kahului', 'US'],
  ['HND', 'Tokyo', 'JP'], ['HKG', 'Hong Kong', 'HK'], ['FRA', 'Frankfurt', 'DE'],
  ['DOH', 'Doha', 'QA'], ['ITM', 'Osaka', 'JP'], ['NCE', 'Nice', 'FR'],
  ['AMS', 'Amsterdam', 'NL'], ['MEL', 'Melbourne', 'AU'], ['GRU', 'Sao Paulo', 'BR'],
]

// Curated for accuracy + voice (see header).
const LANG = { JP:'Japanese',KR:'Korean',TH:'Thai',SG:'English',ID:'Indonesian',AU:'English',NZ:'English',ZA:'English',MA:'Arabic',TR:'Turkish',GR:'Greek',FR:'French',ES:'Spanish',PT:'Portuguese',IT:'Italian',IS:'Icelandic',CA:'English',MX:'Spanish',CO:'Spanish',PE:'Spanish',AR:'Spanish',US:'English',HK:'Cantonese',DE:'German',QA:'Arabic',NL:'Dutch',BR:'Portuguese' }
const CUR_NAME = { JPY:'Japanese yen',KRW:'South Korean won',THB:'Thai baht',SGD:'Singapore dollar',IDR:'Indonesian rupiah',AUD:'Australian dollar',NZD:'New Zealand dollar',ZAR:'South African rand',MAD:'Moroccan dirham',TRY:'Turkish lira',EUR:'Euro',ISK:'Icelandic króna',CAD:'Canadian dollar',MXN:'Mexican peso',COP:'Colombian peso',PEN:'Peruvian sol',ARS:'Argentine peso',USD:'US dollar',HKD:'Hong Kong dollar',QAR:'Qatari riyal',BRL:'Brazilian real' }
const CUR_SYMBOL = { THB:'฿', TRY:'₺', ZAR:'R', SGD:'S$', ISK:'kr', IDR:'Rp', PEN:'S/', ARS:'AR$', COP:'COL$', QAR:'QR', MAD:'DH' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const UA = 'hop-travel/1.0 (https://hop.flights; oliver@newth.ai)'

async function wikidataFacts(iso2s) {
  const values = iso2s.map((c) => `"${c}"`).join(' ')
  const query = `
SELECT ?iso2 ?curCode (SAMPLE(?curLabel) AS ?cur) WHERE {
  VALUES ?iso2 { ${values} }
  ?country wdt:P297 ?iso2.
  OPTIONAL { ?country wdt:P38 ?currency. ?currency wdt:P498 ?curCode.
            ?currency rdfs:label ?curLabel. FILTER(LANG(?curLabel)="en") }
} GROUP BY ?iso2 ?curCode`
  const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), {
    headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`wikidata ${res.status}`)
  const j = await res.json()
  const out = {}
  for (const b of j.results.bindings) {
    const iso2 = b.iso2.value
    if (out[iso2] && !b.curCode) continue
    out[iso2] = { currencyCode: b.curCode?.value ?? null }
  }
  return out
}

async function cityTimezone(city, iso2) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`)
  const j = await r.json()
  const m = (j.results || []).find((x) => (x.country_code || '').toUpperCase() === iso2) || (j.results || [])[0]
  const tz = m?.timezone || null
  let offset = null
  if (tz) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date(Date.UTC(2026, 0, 15)))
      offset = parts.find((p) => p.type === 'timeZoneName')?.value?.replace('GMT', 'UTC') ?? null
    } catch {}
  }
  return { tz, offset }
}

async function fxSnapshot(codes) {
  const symbols = [...new Set(codes.filter(Boolean))].join(',')
  const latest = await (await fetch(`https://api.frankfurter.dev/v1/latest?base=USD&symbols=${symbols}`)).json()
  const d = latest.date
  const y = `${parseInt(d.slice(0, 4), 10) - 1}${d.slice(4)}`
  const ago = await (await fetch(`https://api.frankfurter.dev/v1/${y}?base=USD&symbols=${symbols}`)).json()
  return { date: latest.date, rates: latest.rates, agoDate: ago.date, agoRates: ago.rates }
}

function symbol(code) {
  let s = code
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0)
    s = parts.find((p) => p.type === 'currency')?.value ?? code
  } catch {}
  return s === code && CUR_SYMBOL[code] ? CUR_SYMBOL[code] : s
}

const iso2s = [...new Set(DESTS.map((d) => d[2]))]
const wiki = await wikidataFacts(iso2s)
console.error('wikidata:', Object.keys(wiki).length, 'countries')

const perCode = {}
for (const [code, city, iso2] of DESTS) {
  const currencyCode = wiki[iso2]?.currencyCode ?? null
  const { tz, offset } = await cityTimezone(city, iso2)
  perCode[code] = { iso2, currencyCode, language: LANG[iso2] ?? '', timezone: tz, utcOffset: offset }
  console.error(`ok ${code} ${city} ${iso2} ${currencyCode} ${offset}`)
  await sleep(400)
}
const fx = await fxSnapshot(Object.values(perCode).map((p) => p.currencyCode))
console.error('fx', fx.date, 'vs', fx.agoDate)

const codes = [...new Set(Object.values(perCode).map((p) => p.currencyCode).filter(Boolean))].sort()
const fmt = (o) => '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${v}`).join(', ') + ' }'

let out = `// lib/place-facts.ts — GENERATED, committed seed data. Do not hand-edit.
//
// Real, looked-up facts per destination IATA code: currency, primary language,
// timezone, plus a USD FX snapshot. Sources, all keyless/free: currency code +
// the fact itself from Wikidata (CC0); timezone from Open-Meteo geocoding; FX
// (latest + ~1 year ago) from Frankfurter (ECB data). Currency display names and
// the primary language are curated for accuracy/voice (Wikidata's raw language
// list is noisy) — see scripts/gen-place-facts.mjs. Generated OFFLINE and
// committed, so the live site never calls these APIs.
//
// THESIS: real data, looked up and date-stamped — never generated. lib/place-info
// turns it into terse chips + a computed "how far your dollar goes" line.

export interface PlaceFacts {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso2: string
  /** ISO 4217 currency code, or null if unknown. */
  currencyCode: string | null
  /** Primary language a traveler meets. */
  language: string
  /** IANA timezone, e.g. 'Asia/Tokyo'. */
  timezone: string | null
  /** Standard-time UTC offset label, e.g. 'UTC+9'. */
  utcOffset: string | null
}

export interface Currency {
  name: string
  symbol: string
}

export interface FxSnapshot {
  /** Rates are units of the currency per 1 USD. */
  date: string
  agoDate: string
  rates: Record<string, number>
  agoRates: Record<string, number>
}

export const CURRENCY: Record<string, Currency> = {
`
for (const c of codes) out += `  ${c}: { name: ${JSON.stringify(CUR_NAME[c] ?? c)}, symbol: ${JSON.stringify(symbol(c))} },\n`
out += `}\n\nexport const PLACE_FACTS: Record<string, PlaceFacts> = {\n`
for (const [code] of DESTS) {
  const p = perCode[code]
  out += `  ${code}: { iso2: ${JSON.stringify(p.iso2)}, currencyCode: ${p.currencyCode ? JSON.stringify(p.currencyCode) : 'null'}, language: ${JSON.stringify(p.language)}, timezone: ${p.timezone ? JSON.stringify(p.timezone) : 'null'}, utcOffset: ${p.utcOffset ? JSON.stringify(p.utcOffset) : 'null'} },\n`
}
out += `}\n\nexport const FX: FxSnapshot = {
  date: ${JSON.stringify(fx.date)},
  agoDate: ${JSON.stringify(fx.agoDate)},
  rates: ${fmt(fx.rates)},
  agoRates: ${fmt(fx.agoRates)},
}\n`
out += `\nexport const GENERATED_AT = ${JSON.stringify(new Date().toISOString())}\n`
process.stdout.write(out)
