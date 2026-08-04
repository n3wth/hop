// "Add to calendar" — build a Google Calendar "create event" template URL for a
// hop trip search. hop's first real ACTION: the win you found becomes a thing on
// your calendar, in one tap, no account connection.
//
// INVARIANTS:
//   - NO economics leaves hop. A calendar event is a user-owned reminder of WHEN
//     + WHERE — never hop's computed figures. cpp/miles/price/verdict are LIVE and
//     would go stale the instant they're copied into a static event, so only
//     route + dates + city + cabin travel to the calendar. (The caller must pass
//     trip facts, never `summary`/`pick.cpp`/`pick.miles`/`pick.cashPrice`.)
//   - Pure + total. Malformed dates → null so the caller hides the affordance;
//     never throws.
//   - All-day. A hop search carries dates, not a wall-clock departure time, so the
//     event is all-day. Per the iCal / Google all-day rule the end date is
//     EXCLUSIVE, so a round trip blocks depart..return INCLUSIVE (end = return + 1).

export interface TripCalendarEvent {
  fromCode: string
  toCode: string
  fromCity?: string
  toCity?: string
  depart: string // 'YYYY-MM-DD'
  return?: string // 'YYYY-MM-DD' | undefined (one-way)
  cabin?: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

// 'YYYY-MM-DD' → 'YYYYMMDD', or null if malformed. Pure.
function compact(iso: string | undefined): string | null {
  if (!iso || !ISO_DATE.test(iso)) return null
  return iso.replace(/-/g, '')
}

// The given date + `days`, as 'YYYYMMDD'. Parsed via Date.UTC so month/year
// rollover is correct and there is no timezone day-drift. null if malformed.
function compactPlusDays(iso: string | undefined, days: number): string | null {
  if (!iso || !ISO_DATE.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

// Build the Google Calendar template URL, or null if the dates are unusable (so
// the caller can hide the affordance). Pure + total. Carries route + dates + city
// (+ cabin) ONLY — no economics.
export function googleCalendarUrl(ev: TripCalendarEvent): string | null {
  const start = compact(ev.depart)
  if (!start) return null
  // End is exclusive: round trip → day after return; one-way → day after depart.
  const end = compactPlusDays(ev.return && ISO_DATE.test(ev.return) ? ev.return : ev.depart, 1)
  if (!end) return null

  const dest = (ev.toCity || ev.toCode || '').trim()
  const origin = (ev.fromCity || ev.fromCode || '').trim()
  if (!dest) return null

  const details = [
    origin ? `${origin} (${ev.fromCode}) → ${dest} (${ev.toCode})` : `${dest} (${ev.toCode})`,
    ev.cabin ? `Cabin: ${cap(ev.cabin)}` : null,
    'Planned with hop.\n\nSet a price alert for this trip: https://hop.flights/search?' +
      new URLSearchParams({
        from: ev.fromCode,
        to: ev.toCode,
        depart: ev.depart,
        ...(ev.return ? { return: ev.return } : {}),
        alert: '1',
      }).toString(),
  ]
    .filter(Boolean)
    .join('\n')

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Trip to ${dest}`,
    dates: `${start}/${end}`,
    details,
    location: dest,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}
