// Regenerates lib/airport-coords.json from OurAirports (CC0). Run offline,
// commit the output:
//
//   node scripts/gen-airport-coords.mjs
//
// Same source as lib/airports-data.json. Lat/lon are fetch-once so quoteChart
// can compute great-circle miles for any IATA hop already knows, without a
// live geography API. The live site never calls OurAirports.
//
// OurAirports: https://ourairports.com/data/ (CC0 / public domain).

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC =
  'https://davidmegginson.github.io/ourairports-data/airports.csv'
const OUT = join(ROOT, 'lib/airport-coords.json')
const AIRPORTS = join(ROOT, 'lib/airports-data.json')
const UA = 'hop-travel/1.0 (https://hop.flights; oliver@newth.ai)'

const TYPE_RANK = {
  large_airport: 3,
  medium_airport: 2,
  small_airport: 1,
}

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

async function main() {
  const known = new Set(
    JSON.parse(readFileSync(AIRPORTS, 'utf8')).map((row) => row[0]),
  )
  const res = await fetch(SRC, { headers: { 'user-agent': UA } })
  if (!res.ok) throw new Error(`OurAirports ${res.status}`)
  const text = await res.text()
  const lines = text.split(/\r?\n/)
  const header = parseCsvLine(lines[0] ?? '')
  const idx = (name) => {
    const i = header.indexOf(name)
    if (i < 0) throw new Error(`missing column ${name}`)
    return i
  }
  const iType = idx('type')
  const iLat = idx('latitude_deg')
  const iLon = idx('longitude_deg')
  const iIata = idx('iata_code')
  const iSched = idx('scheduled_service')

  /** @type {Map<string, { lat: number, lon: number, rank: number, sched: number }>} */
  const best = new Map()
  for (let n = 1; n < lines.length; n++) {
    const line = lines[n]
    if (!line) continue
    const cells = parseCsvLine(line)
    const iata = (cells[iIata] ?? '').trim().toUpperCase()
    if (!/^[A-Z]{3}$/.test(iata) || !known.has(iata)) continue
    const lat = Number(cells[iLat])
    const lon = Number(cells[iLon])
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue
    const type = cells[iType] ?? ''
    const rank = TYPE_RANK[type] ?? 0
    if (rank === 0) continue
    const sched = cells[iSched] === 'yes' ? 1 : 0
    const prev = best.get(iata)
    if (
      !prev ||
      sched > prev.sched ||
      (sched === prev.sched && rank > prev.rank)
    ) {
      best.set(iata, { lat, lon, rank, sched })
    }
  }

  const out = {}
  for (const code of [...best.keys()].sort()) {
    const { lat, lon } = best.get(code)
    out[code] = [Number(lat.toFixed(4)), Number(lon.toFixed(4))]
  }

  const missing = [...known].filter((c) => !out[c]).sort()
  writeFileSync(OUT, `${JSON.stringify(out)}\n`)
  console.log(
    `wrote ${Object.keys(out).length} coords (${missing.length} known IATA without a usable OurAirports row)`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
