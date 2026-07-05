// Rolling depart/return clamp shared by the /search page and /api/search.
// The seed default outlives any deploy, so the clamp floors a missing,
// malformed, or past depart at local-midnight today — a bare /search or
// /api/search never runs a permanently stale date. Pure + total.

export const DEFAULT_DEPART = '2026-07-09'

// Local-midnight ISO for today — the floor for any valid depart/return date.
export function todayISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// True for a well-formed "YYYY-MM-DD" string.
export function isValidISO(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
}

// Clamp a raw depart/return pair. Missing/malformed/past depart rises to
// today (or the seed default while that is still in the future). Return is
// one-way when absent and dropped when malformed or before depart.
export function clampTravelDates(
  departRaw: string | undefined,
  returnRaw: string | undefined,
): { depart: string; return?: string } {
  const floor = todayISO()
  let depart = isValidISO(departRaw) ? departRaw : DEFAULT_DEPART
  if (depart < floor) depart = floor > DEFAULT_DEPART ? floor : DEFAULT_DEPART
  const ret =
    returnRaw === undefined
      ? undefined
      : isValidISO(returnRaw) && returnRaw >= depart
        ? returnRaw
        : undefined
  return ret === undefined ? { depart } : { depart, return: ret }
}
