// Regenerates lib/climate-normals.ts from real data. Run offline, commit the output.
//
//   node scripts/gen-climate-normals.mjs > lib/climate-normals.ts
//
// For each destination it geocodes the city (Open-Meteo geocoding), pulls 2010–2020
// daily ERA5 reanalysis (Open-Meteo Archive API — keyless), and reduces it to 12
// monthly normals: mean daily temperature (°F) and mean monthly precipitation (mm).
// We fetch ONCE here and commit the result, so the live site never calls Open-Meteo
// (keeps static builds deterministic and stays clear of the free endpoint's
// non-commercial terms — the ERA5 *data* is CC BY 4.0 and redistributable).
//
// Keep DESTS in sync with lib/destinations.ts (code, geocoding city, country).
// Open-Meteo data: CC BY 4.0 — "Weather data by Open-Meteo.com".

const DESTS = [
  ['NRT', 'Tokyo', 'Japan'], ['KIX', 'Kyoto', 'Japan'], ['ICN', 'Seoul', 'South Korea'],
  ['BKK', 'Bangkok', 'Thailand'], ['SIN', 'Singapore', 'Singapore'], ['DPS', 'Denpasar', 'Indonesia'],
  ['SYD', 'Sydney', 'Australia'], ['ZQN', 'Queenstown', 'New Zealand'], ['CPT', 'Cape Town', 'South Africa'],
  ['RAK', 'Marrakesh', 'Morocco'], ['IST', 'Istanbul', 'Turkey'], ['ATH', 'Athens', 'Greece'],
  ['CDG', 'Paris', 'France'], ['BCN', 'Barcelona', 'Spain'], ['LIS', 'Lisbon', 'Portugal'],
  ['FCO', 'Rome', 'Italy'], ['KEF', 'Reykjavik', 'Iceland'], ['YVR', 'Vancouver', 'Canada'],
  ['MEX', 'Mexico City', 'Mexico'], ['CTG', 'Cartagena', 'Colombia'], ['LIM', 'Lima', 'Peru'],
  ['EZE', 'Buenos Aires', 'Argentina'], ['HNL', 'Honolulu', 'United States'], ['OGG', 'Kahului', 'United States'],
  ['HND', 'Tokyo', 'Japan'], ['HKG', 'Hong Kong', 'Hong Kong'], ['FRA', 'Frankfurt', 'Germany'],
  ['DOH', 'Doha', 'Qatar'], ['ITM', 'Osaka', 'Japan'], ['NCE', 'Nice', 'France'],
  ['AMS', 'Amsterdam', 'Netherlands'], ['MEL', 'Melbourne', 'Australia'], ['GRU', 'Sao Paulo', 'Brazil'],
]

const sleep = (ms) => new Promise((res) => setTimeout(res, ms))

async function geocode(city, country) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`
  const j = await (await fetch(url)).json()
  const results = j.results || []
  const m = results.find((x) => (x.country || '').toLowerCase() === country.toLowerCase()) || results[0]
  if (!m) throw new Error(`no geocode for ${city}, ${country}`)
  return { lat: m.latitude, lon: m.longitude, name: m.name, country: m.country || country }
}

async function climate(lat, lon) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=2010-01-01&end_date=2020-12-31&temperature_unit=fahrenheit` +
    `&daily=temperature_2m_mean,precipitation_sum`
  let j
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url)
    if (r.ok) { j = await r.json(); break }
    if (r.status === 429 && attempt < 6) { await sleep(20000 * (attempt + 1)); continue }
    throw new Error(`climate ${r.status}`)
  }
  const { time, temperature_2m_mean: temp, precipitation_sum: precip } = j.daily
  const tSum = Array(12).fill(0), tN = Array(12).fill(0)
  const pByYM = new Map()
  for (let i = 0; i < time.length; i++) {
    const month = parseInt(time[i].slice(5, 7), 10) - 1
    const year = time[i].slice(0, 4)
    if (temp[i] != null) { tSum[month] += temp[i]; tN[month] += 1 }
    if (precip[i] != null) {
      const k = `${year}-${month}`
      pByYM.set(k, (pByYM.get(k) || 0) + precip[i])
    }
  }
  const pSum = Array(12).fill(0), pN = Array(12).fill(0)
  for (const [k, v] of pByYM) {
    const month = parseInt(k.split('-')[1], 10)
    pSum[month] += v; pN[month] += 1
  }
  return {
    tempF: tSum.map((s, m) => (tN[m] ? Math.round((s / tN[m]) * 10) / 10 : null)),
    precipMM: pSum.map((s, m) => (pN[m] ? Math.round(s / pN[m]) : null)),
  }
}

const coords = {}, normals = {}
for (const [code, city, country] of DESTS) {
  const g = await geocode(city, country)
  const c = await climate(g.lat, g.lon)
  coords[code] = { lat: Math.round(g.lat * 1e4) / 1e4, lon: Math.round(g.lon * 1e4) / 1e4, matched: `${g.name}, ${g.country}` }
  normals[code] = c
  console.error(`ok ${code} -> ${g.name}, ${g.country}`)
  await sleep(8000) // pace requests under the per-minute weighted limit
}

const arr = (a) => '[' + a.map((x) => (x == null ? 'null' : x)).join(', ') + ']'
let out = `// lib/climate-normals.ts — GENERATED, committed seed data. Do not hand-edit.
//
// Monthly climate normals (Jan→Dec) per destination IATA code: mean daily
// temperature (°F) and mean monthly precipitation total (mm), averaged over
// 2010–2020 from ERA5 reanalysis via the Open-Meteo Archive API (open-meteo.com,
// CC-BY 4.0). Generated OFFLINE by scripts/gen-climate-normals.mjs and committed,
// so the live site never calls Open-Meteo (keeps static builds deterministic and
// stays clear of the API's non-commercial live-use terms). Re-run the script to
// refresh. Coordinates are recorded for provenance only.
//
// THESIS: this is real measured data. lib/climate.ts derives the "when to go"
// verdict from it deterministically — nothing here or there is LLM-generated.

import type { MonthlyNormals } from './climate'

export interface DestCoord {
  lat: number
  lon: number
  /** The geocoder match this normal was sampled at, for provenance. */
  matched: string
}

export const DEST_COORDS: Record<string, DestCoord> = {
`
for (const code of Object.keys(coords)) {
  const c = coords[code]
  out += `  ${code}: { lat: ${c.lat}, lon: ${c.lon}, matched: ${JSON.stringify(c.matched)} },\n`
}
out += `}\n\nexport const CLIMATE_NORMALS: Record<string, MonthlyNormals> = {\n`
for (const code of Object.keys(normals)) {
  const n = normals[code]
  out += `  ${code}: { tempF: ${arr(n.tempF)}, precipMM: ${arr(n.precipMM)} },\n`
}
out += `}\n`
out += `\nexport const GENERATED_AT = ${JSON.stringify(new Date().toISOString())}\n`
process.stdout.write(out)
