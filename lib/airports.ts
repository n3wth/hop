// Bundled airport list for autocomplete — major global hubs. No external dep.
// Enough to cover the vast majority of real searches; extend as needed.

export interface Airport {
  code: string // IATA
  city: string
  name: string
  country: string
}

export const AIRPORTS: Airport[] = [
  // US
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco Intl', country: 'US' },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles Intl', country: 'US' },
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy Intl', country: 'US' },
  { code: 'EWR', city: 'Newark', name: 'Newark Liberty Intl', country: 'US' },
  { code: 'LGA', city: 'New York', name: 'LaGuardia', country: 'US' },
  { code: 'ORD', city: 'Chicago', name: "O'Hare Intl", country: 'US' },
  { code: 'MDW', city: 'Chicago', name: 'Midway Intl', country: 'US' },
  { code: 'SEA', city: 'Seattle', name: 'Seattle–Tacoma Intl', country: 'US' },
  { code: 'DEN', city: 'Denver', name: 'Denver Intl', country: 'US' },
  { code: 'BOS', city: 'Boston', name: 'Logan Intl', country: 'US' },
  { code: 'ATL', city: 'Atlanta', name: 'Hartsfield–Jackson', country: 'US' },
  { code: 'MIA', city: 'Miami', name: 'Miami Intl', country: 'US' },
  { code: 'FLL', city: 'Fort Lauderdale', name: 'Fort Lauderdale–Hollywood', country: 'US' },
  { code: 'DFW', city: 'Dallas', name: 'Dallas/Fort Worth Intl', country: 'US' },
  { code: 'DAL', city: 'Dallas', name: 'Love Field', country: 'US' },
  { code: 'IAH', city: 'Houston', name: 'George Bush Intercontinental', country: 'US' },
  { code: 'LAS', city: 'Las Vegas', name: 'Harry Reid Intl', country: 'US' },
  { code: 'PHX', city: 'Phoenix', name: 'Sky Harbor Intl', country: 'US' },
  { code: 'SAN', city: 'San Diego', name: 'San Diego Intl', country: 'US' },
  { code: 'PDX', city: 'Portland', name: 'Portland Intl', country: 'US' },
  { code: 'SLC', city: 'Salt Lake City', name: 'Salt Lake City Intl', country: 'US' },
  { code: 'MSP', city: 'Minneapolis', name: 'Minneapolis–St. Paul', country: 'US' },
  { code: 'DTW', city: 'Detroit', name: 'Detroit Metro', country: 'US' },
  { code: 'PHL', city: 'Philadelphia', name: 'Philadelphia Intl', country: 'US' },
  { code: 'CLT', city: 'Charlotte', name: 'Charlotte Douglas', country: 'US' },
  { code: 'AUS', city: 'Austin', name: 'Austin–Bergstrom', country: 'US' },
  { code: 'BNA', city: 'Nashville', name: 'Nashville Intl', country: 'US' },
  { code: 'DCA', city: 'Washington', name: 'Reagan National', country: 'US' },
  { code: 'IAD', city: 'Washington', name: 'Dulles Intl', country: 'US' },
  { code: 'HNL', city: 'Honolulu', name: 'Daniel K. Inouye Intl', country: 'US' },
  { code: 'OGG', city: 'Maui', name: 'Kahului', country: 'US' },
  { code: 'ANC', city: 'Anchorage', name: 'Ted Stevens Intl', country: 'US' },
  { code: 'OAK', city: 'Oakland', name: 'Oakland Intl', country: 'US' },
  { code: 'SJC', city: 'San Jose', name: 'Norman Y. Mineta', country: 'US' },
  { code: 'MCO', city: 'Orlando', name: 'Orlando Intl', country: 'US' },
  { code: 'TPA', city: 'Tampa', name: 'Tampa Intl', country: 'US' },
  // Canada
  { code: 'YYZ', city: 'Toronto', name: 'Pearson Intl', country: 'CA' },
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver Intl', country: 'CA' },
  { code: 'YUL', city: 'Montreal', name: 'Trudeau Intl', country: 'CA' },
  { code: 'YYC', city: 'Calgary', name: 'Calgary Intl', country: 'CA' },
  // Europe
  { code: 'LHR', city: 'London', name: 'Heathrow', country: 'GB' },
  { code: 'LGW', city: 'London', name: 'Gatwick', country: 'GB' },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'FR' },
  { code: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'NL' },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt am Main', country: 'DE' },
  { code: 'MUC', city: 'Munich', name: 'Munich', country: 'DE' },
  { code: 'MAD', city: 'Madrid', name: 'Barajas', country: 'ES' },
  { code: 'BCN', city: 'Barcelona', name: 'El Prat', country: 'ES' },
  { code: 'FCO', city: 'Rome', name: 'Fiumicino', country: 'IT' },
  { code: 'ZRH', city: 'Zurich', name: 'Zurich', country: 'CH' },
  { code: 'DUB', city: 'Dublin', name: 'Dublin', country: 'IE' },
  { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'PT' },
  { code: 'CPH', city: 'Copenhagen', name: 'Kastrup', country: 'DK' },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul', country: 'TR' },
  // Middle East
  { code: 'DXB', city: 'Dubai', name: 'Dubai Intl', country: 'AE' },
  { code: 'DOH', city: 'Doha', name: 'Hamad Intl', country: 'QA' },
  // Asia-Pacific
  { code: 'NRT', city: 'Tokyo', name: 'Narita Intl', country: 'JP' },
  { code: 'HND', city: 'Tokyo', name: 'Haneda', country: 'JP' },
  { code: 'ICN', city: 'Seoul', name: 'Incheon Intl', country: 'KR' },
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong Intl', country: 'HK' },
  { code: 'SIN', city: 'Singapore', name: 'Changi', country: 'SG' },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'TH' },
  { code: 'SYD', city: 'Sydney', name: 'Kingsford Smith', country: 'AU' },
  { code: 'MEL', city: 'Melbourne', name: 'Melbourne', country: 'AU' },
  { code: 'AKL', city: 'Auckland', name: 'Auckland', country: 'NZ' },
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi Intl', country: 'IN' },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji', country: 'IN' },
  { code: 'PEK', city: 'Beijing', name: 'Capital Intl', country: 'CN' },
  { code: 'PVG', city: 'Shanghai', name: 'Pudong Intl', country: 'CN' },
  // Latin America
  { code: 'MEX', city: 'Mexico City', name: 'Benito Juárez', country: 'MX' },
  { code: 'CUN', city: 'Cancún', name: 'Cancún Intl', country: 'MX' },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos', country: 'BR' },
  { code: 'BOG', city: 'Bogotá', name: 'El Dorado', country: 'CO' },
  { code: 'SCL', city: 'Santiago', name: 'Arturo Merino Benítez', country: 'CL' },
]

const byCode = new Map(AIRPORTS.map((a) => [a.code, a]))

export function airportByCode(code: string): Airport | undefined {
  return byCode.get(code.toUpperCase())
}

// Rank: exact code > code prefix > city prefix > city/name substring.
export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase()
  if (!q) return AIRPORTS.slice(0, limit)
  const scored = AIRPORTS.map((a) => {
    const code = a.code.toLowerCase()
    const city = a.city.toLowerCase()
    const name = a.name.toLowerCase()
    let score = -1
    if (code === q) score = 100
    else if (code.startsWith(q)) score = 80
    else if (city.startsWith(q)) score = 60
    else if (city.includes(q)) score = 40
    else if (name.includes(q)) score = 20
    else if (code.includes(q)) score = 10
    return { a, score }
  })
    .filter((s) => s.score >= 0)
    .sort((x, y) => y.score - x.score)
  return scored.slice(0, limit).map((s) => s.a)
}

// "San Francisco" display for a code, falling back to the code itself.
export function cityForCode(code: string): string {
  return airportByCode(code)?.city ?? code
}
