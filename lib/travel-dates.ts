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

// Resolve a canonical decimal day offset against a supplied ISO base date.
// The default base uses the same local-calendar "today" convention as the
// clamp, while UTC arithmetic prevents daylight-saving transitions from
// shifting the resulting calendar day. Invalid input is simply ignored.
export function resolveRelativeDate(
  offsetRaw: string | undefined,
  baseISO: string = todayISO(),
): string | undefined {
  if (!offsetRaw || !/^(0|[1-9]\d{0,2})$/.test(offsetRaw)) return undefined
  const offset = Number(offsetRaw)
  if (offset > 365) return undefined

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(baseISO)
  if (!match) return undefined
  const [, yearRaw, monthRaw, dayRaw] = match
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const base = new Date(Date.UTC(year, month - 1, day))
  if (
    base.getUTCFullYear() !== year ||
    base.getUTCMonth() !== month - 1 ||
    base.getUTCDate() !== day
  ) {
    return undefined
  }

  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

// Exact dates win whenever their query key is present. Relative intent only
// fills an omitted exact value, then the caller applies the existing clamp.
export function resolveTravelDateIntent(
  departRaw: string | undefined,
  returnRaw: string | undefined,
  departInRaw: string | undefined,
  returnInRaw: string | undefined,
  baseISO: string = todayISO(),
): { depart?: string; return?: string } {
  return {
    depart: departRaw ?? resolveRelativeDate(departInRaw, baseISO),
    return: returnRaw ?? resolveRelativeDate(returnInRaw, baseISO),
  }
}

export type TravelDateQueryIntent = {
  depart?: string
  return?: string
  ret?: string
  departIn?: string
  returnIn?: string
}

// Parse the /search date query contract in one testable seam. A non-empty
// canonical `return` wins over the legacy `ret` alias; either exact value wins
// over `returnIn`. The resolved pair then goes through the shared clamp so bad
// or stale links remain total and safe.
export function parseTravelDateQuery(
  intent: TravelDateQueryIntent,
  baseISO: string = todayISO(),
): { depart: string; return?: string } {
  const exactReturn = intent.return?.trim()
    ? intent.return
    : intent.ret?.trim()
      ? intent.ret
      : undefined
  const resolved = resolveTravelDateIntent(
    intent.depart,
    exactReturn,
    intent.departIn,
    intent.returnIn,
    baseISO,
  )
  return clampTravelDates(resolved.depart, resolved.return)
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
