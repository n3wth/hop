// THE memory resolver — one place every surface reads personalization from,
// mirroring how lib/accounts.ts#getUserBalances unified balances. It composes the
// four memory axes hop now holds — STATED (travel_profile), the rolling
// conversation SUMMARY, INFERRED ("hop noticed") facts, and OBSERVED outcomes —
// into a single graceful object, so the home, /deals, and /ask all personalize
// from the same read instead of each re-deriving it.
//
// INVARIANTS:
//   - NEVER throws. Every sub-read already degrades (getProfile → {}, the gated
//     reads → '' / []); this just Promise.all's them. Signed-out callers use
//     EMPTY_MEMORY_CONTEXT and skip the read entirely.
//   - Memory shapes PROSE + ORDERING only — never a number. The affinity helpers
//     here reorder/omit destinations the ENGINE priced; they never touch cpp/
//     miles/cash (those stay computed by lib/*). A surface that reorders by
//     affinity still shows only engine-computed figures on each card.
//   - Cheap when dark. The three gated sub-reads short-circuit to '' / [] BEFORE
//     any DB hit when their flag is off, so an unenabled deployment pays only the
//     one always-on profile read.
//   - STATED preferences (loved/avoided) are always-on (M1) — the ordering they
//     drive needs no flag and degrades to today's exact order when unset.

import { getProfile } from '@/lib/travel-profile'
import { getConversationMemory } from '@/lib/conversation-memory'
import { listPendingInferredFacts, type InferredFact } from '@/lib/inferred-facts'
import { listObservations, type Observation } from '@/lib/memory-outcomes'
import type { TravelProfile } from '@/lib/travel-profile-model'
import type { Destination } from '@/lib/destinations'

export interface MemoryContext {
  profile: TravelProfile
  // Rolling conversation summary ('' when the seam is off / none).
  summary: string
  // Pending "hop noticed" suggestions ([] when off / none).
  inferred: InferredFact[]
  // Derived "hop observed" reflections ([] when off / none).
  observations: Observation[]
  // Stated place affinities (always-on) — the ordering signal surfaces use.
  loved: string[]
  avoided: string[]
}

// The signed-out / no-op context. Surfaces render exactly today's behavior from it.
export const EMPTY_MEMORY_CONTEXT: MemoryContext = {
  profile: {},
  summary: '',
  inferred: [],
  observations: [],
  loved: [],
  avoided: [],
}

// Read the unified memory context for a user. Composes the four axes concurrently;
// never throws (every sub-read degrades to a fallback). The gated axes no-op
// cheaply when their flag is off.
export async function getMemoryContext(userId: string): Promise<MemoryContext> {
  const [profile, summary, inferred, observations] = await Promise.all([
    getProfile(userId),
    getConversationMemory(userId),
    listPendingInferredFacts(userId),
    listObservations(userId),
  ])
  return {
    profile,
    summary,
    inferred,
    observations,
    loved: (profile.lovedDestinations ?? []).map((s) => s.trim()).filter(Boolean),
    avoided: (profile.avoidedDestinations ?? []).map((s) => s.trim()).filter(Boolean),
  }
}

// --- Value feed, minus what you rejected (pure) -------------------------------

function norm(s: string): string {
  return s.trim().toLowerCase()
}

// Does a curated destination match a free-text place name the user stated? Exact
// (not substring) on city / country / countryCode so "India" can't match
// "Indianapolis" and a stray token can't sweep a whole region. Pure + total.
export function matchesPlace(dest: Destination, place: string): boolean {
  const p = norm(place)
  if (!p) return false
  return p === norm(dest.city) || p === norm(dest.country) || p === norm(dest.countryCode)
}

// Remove the places the member said to AVOID (matched exactly on city / country /
// countryCode), preserving the engine's VALUE ranking for everything that
// remains. We deliberately do NOT float "loved" places to the front: hop leads
// with VALUE, always — burying a higher-cpp redemption behind a loved-but-lower-
// value one would betray the core promise (and would make every "ranked by value"
// label a lie). So a loved place shapes what the concierge SAYS in prose, never
// how the value feed RANKS. A strict no-op returning the input UNCHANGED when
// nothing is avoided, so an empty/typical profile sees today's exact order.
// Never mutates the input; numbers are untouched — this only omits.
export function withoutAvoided(dests: Destination[], avoided: string[]): Destination[] {
  const drop = avoided.map(norm).filter(Boolean)
  if (!drop.length) return dests
  return dests.filter((d) => !drop.some((a) => matchesPlace(d, a)))
}
