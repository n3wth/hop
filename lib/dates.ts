// Local-date helpers for SEEDING search forms with near-future defaults.
//
// We format from LOCAL date components — never `toISOString()`, which is UTC and
// drifts the seeded date by a day for users whose local time + offset crosses a
// UTC day boundary (e.g. an evening in the Americas seeds tomorrow's date). The
// search form speaks local calendar dates, so the seed must too.

/** A Date → 'YYYY-MM-DD' using the date's LOCAL components. */
export function localISO(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** 'YYYY-MM-DD' for `today + days`, in the user's local calendar. */
export function isoOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return localISO(d)
}
