// The "What hop knows about you" projection — a pure, total view over the user's
// durable TravelProfile (lib/travel-profile-model). It flattens the stored
// profile into source-tagged, forgettable rows grouped by life-area (not DB
// field), so the /account glass box can render exactly what hop remembers and
// let the user confirm / forget it.
//
// Invariants this upholds:
//   - NO economics. cpp / verdict / miles never appear here — these are durable
//     personal facts only.
//   - Source-tagged. Every row carries provenance. Today everything the profile
//     holds is STATED (the user said it via save_profile_fact). The shape is
//     forward-compatible: later milestones add source 'noticed' (inferred) and
//     'observed' rows without changing this contract.
//   - Pure + total. Empty / garbage profile → []. Never throws.
//
// Airline elite statuses are intentionally NOT projected here — they already
// have a dedicated editor on /account (AirlineStatusManager) and surfacing them
// in two places would let the two views drift out of sync.

import type { TravelProfile, TravelParty } from '@/lib/travel-profile-model'
import type { Cabin } from '@/lib/prefs-model'

// A life-area grouping for the glass box. Rhythm = how/how-often they travel;
// style = how they like to fly; places = where they lean toward or away from.
export type MemoryGroup = 'rhythm' | 'style' | 'places'

// Which provenance produced a fact. Only 'stated' exists today; the union is
// declared whole so the rendering + later milestones share one contract.
export type MemorySource = 'stated' | 'noticed' | 'observed'

// The scalar/list profile fields a fact can come from. A fact's `kind` + `value`
// is enough for the forget action to remove exactly that field or list entry.
export type MemoryKind =
  | 'vacationDays'
  | 'travelParty'
  | 'cabin'
  | 'dietary'
  | 'accessibility'
  | 'lovedDestinations'
  | 'avoidedDestinations'

export interface MemoryFact {
  // Stable per-row id (kind + normalized value) — drives React keys + forget.
  id: string
  kind: MemoryKind
  group: MemoryGroup
  // Short human label for the row ("Vacation days", "Loves").
  label: string
  // The value as the user would read it ("25 days", "Business", "Lisbon").
  value: string
  // For list kinds, the exact stored entry to forget (omitted for scalars).
  entry?: string
  source: MemorySource
  // Every fact hop holds today is user-correctable.
  editable: boolean
}

// Whether a profile carries no kinds this view projects (statuses excluded).
const SCALARS: { kind: MemoryKind; group: MemoryGroup; label: string }[] = [
  { kind: 'vacationDays', group: 'rhythm', label: 'Vacation days' },
  { kind: 'travelParty', group: 'rhythm', label: 'Usually travels' },
  { kind: 'cabin', group: 'style', label: 'Preferred cabin' },
]

const LISTS: { kind: MemoryKind; group: MemoryGroup; label: string }[] = [
  { kind: 'dietary', group: 'style', label: 'Dietary' },
  { kind: 'accessibility', group: 'style', label: 'Accessibility' },
  { kind: 'lovedDestinations', group: 'places', label: 'Loves' },
  { kind: 'avoidedDestinations', group: 'places', label: 'Avoids' },
]

// Sentence-case the travel party / cabin enum for display ("couple" → "Couple").
function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function scalarValue(kind: MemoryKind, profile: TravelProfile): string | undefined {
  switch (kind) {
    case 'vacationDays': {
      const n = profile.vacationDays
      return typeof n === 'number' ? `${n} ${n === 1 ? 'day' : 'days'}` : undefined
    }
    case 'travelParty': {
      const p: TravelParty | undefined = profile.travelParty
      return p ? titleCase(p) : undefined
    }
    case 'cabin': {
      const c: Cabin | undefined = profile.cabin
      return c ? titleCase(c) : undefined
    }
    default:
      return undefined
  }
}

function listEntries(kind: MemoryKind, profile: TravelProfile): string[] {
  switch (kind) {
    case 'dietary':
      return profile.dietary ?? []
    case 'accessibility':
      return profile.accessibility ?? []
    case 'lovedDestinations':
      return profile.lovedDestinations ?? []
    case 'avoidedDestinations':
      return profile.avoidedDestinations ?? []
    default:
      return []
  }
}

// Flatten a (validated) TravelProfile into source-tagged rows. One row per scalar
// field that's set, and one row PER ENTRY for list fields (so each loved place is
// its own forgettable row). Pure + total: an empty / garbage profile yields [].
export function projectProfile(profile: TravelProfile | undefined | null): MemoryFact[] {
  if (!profile) return []
  const out: MemoryFact[] = []

  for (const { kind, group, label } of SCALARS) {
    const value = scalarValue(kind, profile)
    if (value === undefined) continue
    out.push({ id: kind, kind, group, label, value, source: 'stated', editable: true })
  }

  for (const { kind, group, label } of LISTS) {
    for (const entry of listEntries(kind, profile)) {
      const trimmed = typeof entry === 'string' ? entry.trim() : ''
      if (!trimmed) continue
      out.push({
        id: `${kind}:${trimmed.toLowerCase()}`,
        kind,
        group,
        label,
        value: trimmed,
        entry: trimmed,
        source: 'stated',
        editable: true,
      })
    }
  }

  return out
}

// Group projected facts in a stable display order (rhythm → style → places),
// dropping empty groups. Convenience for the renderer.
export const MEMORY_GROUP_ORDER: { group: MemoryGroup; title: string }[] = [
  { group: 'rhythm', title: 'How you travel' },
  { group: 'style', title: 'How you like to fly' },
  { group: 'places', title: 'Places' },
]

export function groupFacts(facts: MemoryFact[]): { group: MemoryGroup; title: string; facts: MemoryFact[] }[] {
  return MEMORY_GROUP_ORDER.map(({ group, title }) => ({
    group,
    title,
    facts: facts.filter((f) => f.group === group),
  })).filter((g) => g.facts.length > 0)
}
