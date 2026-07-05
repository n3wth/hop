// Static seed table + owner-approved drafts, merged — mirrors lib/valuations.ts
// (static floor) + lib/valuations-live.ts (observed ceiling) for the same
// reason: lib/sweet-spots.ts stays pure hand-transcribed data with no I/O, and
// the DB-backed additions from the HITL review queue (lib/sweet-spot-drafts.ts)
// layer on top here. Only the two live-rendered /sweet-spots pages read this
// module; sitemap/OG-image/destinations keep reading the static table directly
// (see lib/sweet-spots.ts — no change in blast radius for those).

import {
  sweetSpots,
  type Program,
  type SweetSpot,
} from '@/lib/sweet-spots'
import { getApprovedDraftSpots } from '@/lib/sweet-spot-drafts'

const CABIN_RANK: Record<SweetSpot['cabin'], number> = { First: 0, Business: 1, Economy: 2 }

function byValue(a: SweetSpot, b: SweetSpot): number {
  const c = CABIN_RANK[a.cabin] - CABIN_RANK[b.cabin]
  if (c !== 0) return c
  const ma = a.milesOW ?? Number.POSITIVE_INFINITY
  const mb = b.milesOW ?? Number.POSITIVE_INFINITY
  if (ma !== mb) return ma - mb
  return a.id - b.id
}

// The static table plus any approved drafts. Draft rows always target an
// existing programSlug (enforced at creation — lib/sweet-spot-drafts.ts), so
// this never introduces a program the static table doesn't already have a
// page for.
export async function getAllSweetSpots(): Promise<SweetSpot[]> {
  const drafted = await getApprovedDraftSpots()
  return drafted.length ? [...sweetSpots, ...drafted] : sweetSpots
}

// sweetSpotsByProgram(), but over the merged (static + approved-draft) table.
export async function getSweetSpotsByProgram(): Promise<Program[]> {
  const all = await getAllSweetSpots()
  const groups = new Map<string, Program>()
  for (const s of all) {
    const g = groups.get(s.programSlug)
    if (g) {
      g.spots.push(s)
    } else {
      groups.set(s.programSlug, { slug: s.programSlug, name: s.program, spots: [s] })
    }
  }
  const out = [...groups.values()]
  for (const g of out) g.spots.sort(byValue)
  return out.sort((a, b) => b.spots.length - a.spots.length || a.name.localeCompare(b.name))
}

// programBySlug(), but over the merged table. Undefined for an unknown slug —
// callers keep notFound()'ing exactly as they do today.
export async function getProgramBySlug(slug: string): Promise<Program | undefined> {
  return (await getSweetSpotsByProgram()).find((p) => p.slug === slug)
}
