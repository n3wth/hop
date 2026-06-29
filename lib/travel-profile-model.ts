// The user's PERSONAL travel profile — durable facts the concierge remembers
// across conversations (distinct from lib/prefs-model.TravelPrefs, which are
// per-search FLIGHT constraints). The LLM never originates economics here; it
// only records facts the user states about themselves (how many vacation days
// they have, who they travel with, cabin/dietary/accessibility needs, places
// they love or avoid) via the save_profile_fact tool. Every write is clamped
// through validateProfile so a model can never inject unknown fields or absurd
// values, and a hand-edited row can never feed garbage into the prompt.

import { CABINS, type Cabin } from '@/lib/prefs-model'

// Who the user typically travels with — shapes suggestions (solo city break vs.
// family-friendly resort). MINIMAL by design.
export const TRAVEL_PARTIES = ['solo', 'couple', 'family', 'group'] as const
export type TravelParty = (typeof TRAVEL_PARTIES)[number]

// A durable, personal profile. Every field optional — the profile grows as the
// user reveals more. Kept small + high-signal so it fits the prompt cheaply.
export interface TravelProfile {
  // Annual vacation days the user has to spend (shapes trip length + frequency).
  vacationDays?: number
  // Who they usually travel with.
  travelParty?: TravelParty
  // Preferred cabin for long trips (reuses the shared Cabin enum).
  cabin?: Cabin
  // Free-text dietary needs (e.g. "vegetarian", "gluten-free"). Short list.
  dietary?: string[]
  // Free-text accessibility needs (e.g. "step-free", "service animal").
  accessibility?: string[]
  // Destinations (free-text places) the user loves — float these up.
  lovedDestinations?: string[]
  // Destinations the user wants to avoid — never suggest these.
  avoidedDestinations?: string[]
}

// Field-level caps so a model (or a hand-edited row) can't bloat the prompt.
const MAX_LIST = 12
const MAX_STR = 60
const MAX_VACATION_DAYS = 365

// True when the profile carries no actionable signal — the prompt then omits it.
export function isEmptyProfile(p: TravelProfile | undefined | null): boolean {
  if (!p) return true
  return (
    p.vacationDays === undefined &&
    p.travelParty === undefined &&
    p.cabin === undefined &&
    !p.dietary?.length &&
    !p.accessibility?.length &&
    !p.lovedDestinations?.length &&
    !p.avoidedDestinations?.length
  )
}

// Normalize an arbitrary array of unknowns into a clean, deduped, capped string
// list. Trims, drops empties, clamps each entry's length, caps the list size.
function cleanStrList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of raw) {
    if (typeof v !== 'string') continue
    const s = v.trim().slice(0, MAX_STR)
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= MAX_LIST) break
  }
  return out.length ? out : undefined
}

// Clamp/validate an arbitrary object (e.g. AI JSON or a stored row) into a
// strict TravelProfile. NEVER trusts unknown fields. Garbage in → {} out. Pure
// and total: never throws.
export function validateProfile(raw: unknown): TravelProfile {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: TravelProfile = {}

  if (typeof r.vacationDays === 'number' && Number.isFinite(r.vacationDays)) {
    out.vacationDays = Math.max(0, Math.min(MAX_VACATION_DAYS, Math.trunc(r.vacationDays)))
  }

  if (typeof r.travelParty === 'string') {
    const p = r.travelParty.toLowerCase().trim()
    if ((TRAVEL_PARTIES as readonly string[]).includes(p)) out.travelParty = p as TravelParty
  }

  if (typeof r.cabin === 'string') {
    const c = r.cabin.toLowerCase().trim()
    if ((CABINS as readonly string[]).includes(c)) out.cabin = c as Cabin
  }

  const dietary = cleanStrList(r.dietary)
  if (dietary) out.dietary = dietary
  const accessibility = cleanStrList(r.accessibility)
  if (accessibility) out.accessibility = accessibility
  const loved = cleanStrList(r.lovedDestinations)
  if (loved) out.lovedDestinations = loved
  const avoided = cleanStrList(r.avoidedDestinations)
  if (avoided) out.avoidedDestinations = avoided

  return out
}

// Merge a PATCH of new facts onto an existing profile. Scalars overwrite; lists
// UNION (so "I'm also vegan" adds to dietary rather than replacing it). The
// result is re-validated/clamped. Pure: never mutates inputs.
export function mergeProfile(base: TravelProfile, patch: TravelProfile): TravelProfile {
  const merged: TravelProfile = { ...base }
  if (patch.vacationDays !== undefined) merged.vacationDays = patch.vacationDays
  if (patch.travelParty !== undefined) merged.travelParty = patch.travelParty
  if (patch.cabin !== undefined) merged.cabin = patch.cabin
  const unionList = (a?: string[], b?: string[]) =>
    a || b ? [...(a ?? []), ...(b ?? [])] : undefined
  merged.dietary = unionList(base.dietary, patch.dietary)
  merged.accessibility = unionList(base.accessibility, patch.accessibility)
  merged.lovedDestinations = unionList(base.lovedDestinations, patch.lovedDestinations)
  merged.avoidedDestinations = unionList(base.avoidedDestinations, patch.avoidedDestinations)
  return validateProfile(merged)
}

// Render a profile as a compact, prompt-ready summary. Returns '' when empty so
// the caller can omit the whole block. Pure.
export function profileSummary(p: TravelProfile | undefined): string {
  if (isEmptyProfile(p)) return ''
  const prof = p as TravelProfile
  const lines: string[] = []
  if (prof.vacationDays !== undefined) lines.push(`- Vacation days/year: ${prof.vacationDays}`)
  if (prof.travelParty) lines.push(`- Usually travels: ${prof.travelParty}`)
  if (prof.cabin) lines.push(`- Preferred cabin: ${prof.cabin}`)
  if (prof.dietary?.length) lines.push(`- Dietary: ${prof.dietary.join(', ')}`)
  if (prof.accessibility?.length) lines.push(`- Accessibility: ${prof.accessibility.join(', ')}`)
  if (prof.lovedDestinations?.length) lines.push(`- Loves: ${prof.lovedDestinations.join(', ')}`)
  if (prof.avoidedDestinations?.length)
    lines.push(`- Avoid (never suggest): ${prof.avoidedDestinations.join(', ')}`)
  return lines.join('\n')
}
