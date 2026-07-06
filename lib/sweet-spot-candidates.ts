// AI-sourced sweet-spot candidate pipeline (docs/plans/2026-07-05-content-
// candidate-pipeline.md). Mines the SAME trusted engine funnel every search
// uses (assembleSearch) over a curated hub/destination/date grid, scores the
// resulting award options for notability, and drops fresh candidates into the
// existing owner review queue (hop_sweet_spot_drafts) so it fills itself
// instead of waiting on the owner to type facts in by hand.
//
// THESIS ALIGNMENT: every number here — cpp, baseline, miles — comes straight
// off a real assembleSearch() call (lib/cpp.ts arithmetic over live
// cash/award pricing), never estimated or LLM-generated. The one prose string
// this module hands to draftSweetSpotWhy() (`notes`) is itself a deterministic
// template over those same computed numbers — draftSweetSpotWhy()'s existing
// "restate verbatim, never compute" contract is unchanged and unexercised
// beyond that.
//
// Business cabin only in v1 (see the plan §2: seats.aero has no normalized
// First cabin — a First scan would silently score business-labeled data).
// Every auto-sourced row lands `pending_review`, same as an owner-typed one —
// this module never approves anything itself.

import { assembleSearch, POINTS_THRESHOLD_CPP } from '@/lib/search'
import { canonicalizeProgram } from '@/lib/programs'
import { programValue } from '@/lib/valuations'
import { destinations, type Destination } from '@/lib/destinations'
import { sweetSpots, sweetSpotsByProgram, type Cabin } from '@/lib/sweet-spots'
import {
  createSweetSpotDraft,
  draftSweetSpotWhy,
  listSweetSpotDrafts,
  updateSweetSpotDraftWhy,
  type SweetSpotDraft,
} from '@/lib/sweet-spot-drafts'
import type { SearchParams } from '@/lib/types'

// ── Tunables — named + exported so tests assert on them directly ───────────

// A small set of major US hubs — "typical award from the US" is already the
// framing lib/destinations.ts uses for its seed figures. Revisit once a
// data-driven hub list (real search-log volume) is cheap to query — see the
// plan's open question 1.
export const ORIGIN_HUBS = ['SFO', 'JFK', 'ORD', 'LAX'] as const

// Rotate a slice of lib/destinations.ts per run instead of scanning all of it
// daily — bounds upstream call volume to the low hundreds/day (4 hubs × 8
// destinations × 3 sample dates × 2 upstream calls ≈ 192/day) while sweeping
// the full ~30-destination list every ~4-5 days. See the plan's open
// question 2.
export const DESTINATIONS_PER_RUN = 8

// Near-future sample dates (days out from "now"), a few spread points to dodge
// a single day's availability gap rather than one snapshot.
export const SAMPLE_DATE_OFFSETS_DAYS = [30, 45, 60] as const

const DAY_MS = 24 * 60 * 60 * 1000

// The single cabin this pipeline mines for. Two different vocabularies:
// assembleSearch's SearchParams wants the lowercase request enum; the stored
// draft/SweetSpot cabin field wants the display enum.
const REQUEST_CABIN: SearchParams['cabin'] = 'business'
const CANDIDATE_CABIN: Cabin = 'Business'

// Notable when the award clears BOTH the engine's own "worth it" line AND a
// meaningful premium over the program's typical value — a program that's
// merely "good" isn't sweet-spot-page-worthy, an outlier is. Mirrors
// lib/health-checks.ts's naming style for a fixed, documented constant.
export const NOTABILITY_BASELINE_MULTIPLIER = 1.3

// The sentinel's own MAX_ISSUES_PER_RUN pattern: bound how many new rows can
// land in one run so the review queue grows reviewably, not in a flood.
export const MAX_NEW_CANDIDATES_PER_RUN = 3

// Sentinel value for hop_sweet_spot_drafts.created_by on every row this
// pipeline creates — never an owner email. ContentConsole reads this to badge
// auto-sourced cards.
export const CONTENT_CANDIDATES_CREATED_BY = 'auto:content-candidates'

// Program coverage is narrower than the seats.aero universe: createSweetSpotDraft
// hard-rejects any programSlug outside lib/sweet-spots.ts's static program set
// (today just 6). Any mined program outside this map (United, Delta, etc. — no
// sweet-spots page yet) is silently dropped, matching the owner-typed flow's
// own rule that this never creates a brand-new program page. Grows
// automatically as lib/sweet-spots.ts gains programs.
export const PROGRAM_ID_TO_SWEET_SPOT_SLUG: Record<string, string> = {
  'virgin-atlantic': 'virgin-atlantic',
  alaska: 'alaska-atmos',
  aeroplan: 'aeroplan',
  turkish: 'turkish',
  lifemiles: 'lifemiles',
  'avios-ba': 'avios',
}

export interface SweetSpotCandidate {
  route: string // mined as an airport pair, e.g. "SFO → NRT"
  programSlug: string
  program: string // display name, from lib/sweet-spots.ts's own program table
  cabin: Cabin
  milesOw: number
  milesLabel: string
  cpp: number // mean observed cpp across sample dates
  baseline: number // lib/valuations.ts static baseline for this program
  sampleCount: number
  notes: string // deterministic — see buildNotes()
}

// Notable if the observed cpp clears the engine's own "use points" line AND is
// a meaningful (30%) premium over the program's typical baseline value. Pure;
// both gates are required (a program with a low baseline could otherwise clear
// the multiplier at a cpp that's still unremarkable in absolute terms).
export function isNotable(cpp: number, baselineCpp: number): boolean {
  if (!Number.isFinite(cpp) || !Number.isFinite(baselineCpp) || baselineCpp <= 0) return false
  return cpp >= POINTS_THRESHOLD_CPP && cpp >= baselineCpp * NOTABILITY_BASELINE_MULTIPLIER
}

// Stable identity for a {route, program, cabin} combo — the same shape
// hop_sweet_spot_drafts and lib/sweet-spots.ts's static table both carry.
// Case/whitespace-insensitive so a mined route and a hand-typed one with
// different casing still collide.
export function draftKey(route: string, programSlug: string, cabin: string): string {
  return `${route.trim().toLowerCase()}|${programSlug.trim().toLowerCase()}|${cabin.trim().toLowerCase()}`
}

// Every combo the owner has already seen (any draft status) or that's already
// in the static seed table — the pipeline's whole dedup history. Pure: callers
// supply the rows, so tests never need to mock the db.
export function buildExistingKeys(
  drafts: Pick<SweetSpotDraft, 'route' | 'programSlug' | 'cabin'>[],
  staticSpots: Pick<(typeof sweetSpots)[number], 'route' | 'programSlug' | 'cabin'>[] = sweetSpots,
): Set<string> {
  const keys = new Set<string>()
  for (const d of drafts) keys.add(draftKey(d.route, d.programSlug, d.cabin))
  for (const s of staticSpots) keys.add(draftKey(s.route, s.programSlug, s.cabin))
  return keys
}

// Drop any candidate whose {route, programSlug, cabin} the owner has already
// seen in any status, or that's already a static seed row.
export function filterNewCandidates(
  candidates: SweetSpotCandidate[],
  existingKeys: Set<string>,
): SweetSpotCandidate[] {
  return candidates.filter((c) => !existingKeys.has(draftKey(c.route, c.programSlug, c.cabin)))
}

// Rank survivors by how far above baseline they run (cpp/baseline, descending)
// and cap to MAX_NEW_CANDIDATES_PER_RUN. Pure — does not mutate the input.
export function rankAndCapCandidates(
  candidates: SweetSpotCandidate[],
  max: number = MAX_NEW_CANDIDATES_PER_RUN,
): SweetSpotCandidate[] {
  return [...candidates].sort((a, b) => b.cpp / b.baseline - a.cpp / a.baseline).slice(0, max)
}

// Which slice of lib/destinations.ts to scan today — a stable, deterministic
// rotation keyed on the calendar day (not random), so a re-run on the same day
// (e.g. the owner's manual "Find candidates now" right after the cron) covers
// the same destinations rather than a different random slice.
export function destinationsForRun(now: Date): Destination[] {
  const sliceSize = Math.max(1, DESTINATIONS_PER_RUN)
  const totalSlices = Math.max(1, Math.ceil(destinations.length / sliceSize))
  const dayIndex = Math.floor(now.getTime() / DAY_MS)
  const slice = ((dayIndex % totalSlices) + totalSlices) % totalSlices
  return destinations.slice(slice * sliceSize, slice * sliceSize + sliceSize)
}

function isoDatePlusDays(now: Date, days: number): string {
  return new Date(now.getTime() + days * DAY_MS).toISOString().slice(0, 10)
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// e.g. 45000 -> "45k", 102500 -> "102.5k". Deterministic, single-figure —
// unlike the static table's hand-curated ranges/bands, this pipeline only ever
// has one observed figure per combo.
function formatMilesLabel(milesOw: number): string {
  if (milesOw < 1000) return String(Math.round(milesOw))
  const k = Math.round((milesOw / 1000) * 10) / 10
  return `${k}k`
}

// The ONLY prose this module produces — a deterministic template over numbers
// already computed above, never LLM text. Fed to draftSweetSpotWhy() as
// `notes`, whose contract already forbids computing a new figure and only
// permits restating one given verbatim — this string IS that given figure.
function buildNotes(meanCpp: number, baselineCpp: number, sampleCount: number): string {
  const dates = sampleCount === 1 ? '1 sampled date' : `${sampleCount} sampled dates`
  return `Observed ~${meanCpp.toFixed(1)}¢/pt over ${dates} vs ~${baselineCpp.toFixed(1)}¢/pt typical for this program.`
}

interface RawSample {
  route: string
  programSlug: string
  programId: string
  samples: { cpp: number; miles: number }[]
}

// Mine assembleSearch over today's hub/destination/date grid and return a
// ranked, capped, deduped list of notable Business-cabin award candidates.
// NEVER throws (assembleSearch, listSweetSpotDrafts, and everything else this
// calls are all documented never-throw); degrades to [] when pricing is
// unavailable (no keys, upstream down, or nothing notable this run) — the
// caller (the cron route / the owner action) decides what "no candidates
// today" means, this function just reports it honestly.
export async function findSweetSpotCandidates(now: Date = new Date()): Promise<SweetSpotCandidate[]> {
  const runDestinations = destinationsForRun(now)
  const byKey = new Map<string, RawSample>()

  for (const hub of ORIGIN_HUBS) {
    for (const dest of runDestinations) {
      if (dest.code.toUpperCase() === hub.toUpperCase()) continue
      for (const offsetDays of SAMPLE_DATE_OFFSETS_DAYS) {
        const depart = isoDatePlusDays(now, offsetDays)
        const params: SearchParams = { from: hub, to: dest.code, depart, adults: 1, cabin: REQUEST_CABIN }
        // recordTelemetry:false — this is synthetic scan volume, not a real
        // user search: it must not feed the live valuation worker's cpp
        // trust gate (ADR 0005), and a burst of mining calls hitting a
        // rate-limited upstream must not read as a live-traffic degradation
        // spike to the health sentinel's D2 detector (lib/health-checks.ts).
        const result = await assembleSearch(params, [], undefined, { recordTelemetry: false })

        for (const o of result.allAwards ?? []) {
          // seats.aero's cabin fallback (lib/seatsaero.ts#pickCabin) can
          // return an Economy/Premium-Economy row even when Business was
          // requested, if Business space wasn't available on that record.
          // Score only rows actually labeled Business — never infer the
          // requested cabin was what was served.
          if (o.cabin !== CANDIDATE_CABIN) continue
          if (typeof o.cpp !== 'number' || !Number.isFinite(o.cpp) || o.cpp <= 0) continue
          if (typeof o.miles !== 'number' || !Number.isFinite(o.miles) || o.miles <= 0) continue
          if (!o.program) continue
          const def = canonicalizeProgram(o.program)
          if (!def) continue
          const slug = PROGRAM_ID_TO_SWEET_SPOT_SLUG[def.id]
          if (!slug) continue // program has no sweet-spots page — never guess one

          const route = `${hub} → ${dest.code}`
          const key = `${route}|${slug}`
          const entry = byKey.get(key) ?? { route, programSlug: slug, programId: def.id, samples: [] }
          entry.samples.push({ cpp: o.cpp, miles: o.miles })
          byKey.set(key, entry)
        }
      }
    }
  }

  const scored: SweetSpotCandidate[] = []
  for (const entry of byKey.values()) {
    const meanCpp = mean(entry.samples.map((s) => s.cpp))
    const baseline = programValue(entry.programId)
    if (!isNotable(meanCpp, baseline)) continue
    const program = sweetSpotsByProgram().find((p) => p.slug === entry.programSlug)
    if (!program) continue // defensive — the slug map should always resolve
    const milesOw = Math.round(mean(entry.samples.map((s) => s.miles)))
    scored.push({
      route: entry.route,
      programSlug: entry.programSlug,
      program: program.name,
      cabin: CANDIDATE_CABIN,
      milesOw,
      milesLabel: formatMilesLabel(milesOw),
      cpp: Math.round(meanCpp * 10) / 10,
      baseline,
      sampleCount: entry.samples.length,
      notes: buildNotes(meanCpp, baseline, entry.samples.length),
    })
  }

  const drafts = (await listSweetSpotDrafts()) ?? []
  const fresh = filterNewCandidates(scored, buildExistingKeys(drafts))
  return rankAndCapCandidates(fresh)
}

// Persist candidates as pending_review drafts — the facts via the existing,
// unchanged createSweetSpotDraft() (createdBy is the sentinel value, never an
// owner email), then draftSweetSpotWhy() to fill the why-line from the
// deterministic `notes` computed above. NEVER auto-approves — every row this
// creates lands pending_review, same as an owner-typed one. NEVER throws:
// every function this calls already degrades via withDb/gateway-absent.
export async function createCandidateDrafts(
  candidates: SweetSpotCandidate[],
): Promise<{ created: number }> {
  let created = 0
  for (const c of candidates) {
    const id = await createSweetSpotDraft({
      route: c.route,
      programSlug: c.programSlug,
      cabin: c.cabin,
      milesOw: c.milesOw,
      milesLabel: c.milesLabel,
      confidence: 'med',
      createdBy: CONTENT_CANDIDATES_CREATED_BY,
    })
    if (!id) continue
    created++

    const why = await draftSweetSpotWhy({
      route: c.route,
      program: c.program,
      cabin: c.cabin,
      milesLabel: c.milesLabel,
      milesOw: c.milesOw,
      notes: c.notes,
    })
    if (why) await updateSweetSpotDraftWhy(id, why)
  }
  return { created }
}
