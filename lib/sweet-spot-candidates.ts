import 'server-only'

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
//
// TIMEOUT SAFETY: the full hub × destination × date grid is dozens of routes —
// too slow to mine in full before persisting anything inside one serverless
// invocation (app/api/cron/sweet-spot-candidates/route.ts sets
// maxDuration=300). runSweetSpotCandidatePipeline() therefore:
//   (a) prices one route's SAMPLE_DATE_OFFSETS_DAYS CONCURRENTLY (bounded to
//       that many in-flight assembleSearch calls per route — never the whole
//       grid at once, never fully sequential either — see scoreRoute()),
//   (b) checks a wall-clock deadline before starting each new route so a slow
//       run returns whatever it found/created instead of being killed
//       mid-grid, and
//   (c) persists each notable candidate AS SOON AS it's found, stopping
//       mining the instant MAX_NEW_CANDIDATES_PER_RUN drafts exist, rather
//       than scoring the entire grid before creating anything.
// Tradeoff: candidates are "first found, in hub/destination iteration order"
// rather than a strict global top-N — inherent to being able to stop early.

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
import { CONTENT_CANDIDATES_CREATED_BY } from '@/lib/sweet-spot-constants'
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
// a single day's availability gap rather than one snapshot. Also the per-route
// concurrency bound (see scoreRoute()) — sampled together, never one at a
// time and never the whole grid at once.
export const SAMPLE_DATE_OFFSETS_DAYS = [30, 45, 60] as const

const DAY_MS = 24 * 60 * 60 * 1000

// Vercel's ceiling for this route is maxDuration=300s
// (app/api/cron/sweet-spot-candidates/route.ts). Stop STARTING new routes
// once this many ms have elapsed since the run began — leaves ~80s headroom
// under the ceiling for the current route's in-flight searches and draft
// persistence to finish cleanly rather than being killed mid-request.
export const MINING_TIME_BUDGET_MS = 220_000

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
// land in one run so the review queue grows reviewably, not in a flood — and,
// per the timeout-safety note above, the signal to stop mining early.
export const MAX_NEW_CANDIDATES_PER_RUN = 3

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
  // Destination's own country/region (lib/destinations.ts) — carried through
  // solely so the static-seed half of dedup (staticRouteAliasKeys) can
  // recognize a mined airport pair against lib/sweet-spots.ts's region-string
  // route vocabulary. Never shown to the owner or persisted on the draft.
  destCountry: string
  destRegion: string
}

export interface PipelineResult {
  created: number
  found: number
  /** The drafts actually persisted this run, in persist order — lets
   *  ContentConsole splice them into client state without a reload. */
  drafts: SweetSpotDraft[]
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

// lib/sweet-spots.ts's static seed table describes routes as region strings
// ("US ↔ Japan", "US ↔ Asia"), never as airport pairs — a mined "SFO → NRT"
// can never exact-match one of those by draftKey() alone, which made the
// static half of dedup dead code in practice (every mining hub is a US
// airport, so "US ↔ <country/region>" is the vocabulary to reproduce). This
// returns every key a candidate could plausibly collide under: its own exact
// (mined or hand-typed) route, plus a "US ↔ <country>" and "US ↔ <region>"
// alias derived from the destination. Known gap: a handful of pre-existing
// static rows use bespoke phrasing outside that pattern (e.g. "Short-haul
// Europe (off-peak)", "Middle East ↔ region / to US") and won't be caught —
// acceptable since those are hand-authored legacy rows, not new pipeline
// output, and this still closes the common case the plan promised.
export function staticRouteAliasKeys(
  candidate: Pick<SweetSpotCandidate, 'route' | 'programSlug' | 'cabin' | 'destCountry' | 'destRegion'>,
): string[] {
  const keys = [draftKey(candidate.route, candidate.programSlug, candidate.cabin)]
  if (candidate.destCountry) {
    keys.push(draftKey(`US ↔ ${candidate.destCountry}`, candidate.programSlug, candidate.cabin))
  }
  if (candidate.destRegion) {
    keys.push(draftKey(`US ↔ ${candidate.destRegion}`, candidate.programSlug, candidate.cabin))
  }
  return keys
}

// Drop any candidate whose {route, programSlug, cabin} the owner has already
// seen in any status, or that's already a static seed row (matched via
// staticRouteAliasKeys — see its doc comment for why an exact route match
// alone isn't enough).
export function filterNewCandidates(
  candidates: SweetSpotCandidate[],
  existingKeys: Set<string>,
): SweetSpotCandidate[] {
  return candidates.filter((c) => !staticRouteAliasKeys(c).some((k) => existingKeys.has(k)))
}

// Rank by how far above baseline a candidate runs (cpp/baseline, descending)
// and cap. Pure — does not mutate the input. Used both to order the (usually
// single, occasionally several) qualifying program(s) found on one route
// before persisting, and as a directly-testable unit.
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

interface RouteProgramSample {
  programId: string
  samples: { cpp: number; miles: number }[]
}

// Price one hub→destination route across SAMPLE_DATE_OFFSETS_DAYS
// CONCURRENTLY (bounded to that many in-flight assembleSearch calls — never
// the whole grid at once, never one at a time either) and bucket the priced
// Business-cabin awards by mapped program slug.
async function scoreRoute(
  hub: string,
  dest: Destination,
  now: Date,
): Promise<Map<string, RouteProgramSample>> {
  const perProgram = new Map<string, RouteProgramSample>()

  const results = await Promise.all(
    SAMPLE_DATE_OFFSETS_DAYS.map((offsetDays) => {
      const depart = isoDatePlusDays(now, offsetDays)
      const params: SearchParams = { from: hub, to: dest.code, depart, adults: 1, cabin: REQUEST_CABIN }
      // recordTelemetry:false — this is synthetic scan volume, not a real
      // user search: it must not feed the live valuation worker's cpp trust
      // gate (ADR 0005), and a burst of mining calls hitting a rate-limited
      // upstream must not read as a live-traffic degradation spike to the
      // health sentinel's D2 detector (lib/health-checks.ts).
      return assembleSearch(params, [], undefined, { recordTelemetry: false })
    }),
  )

  for (const result of results) {
    for (const o of result.allAwards ?? []) {
      // seats.aero's cabin fallback (lib/seatsaero.ts#pickCabin) can return an
      // Economy/Premium-Economy row even when Business was requested, if
      // Business space wasn't available on that record. Score only rows
      // actually labeled Business — never infer the requested cabin was what
      // was served.
      if (o.cabin !== CANDIDATE_CABIN) continue
      if (typeof o.cpp !== 'number' || !Number.isFinite(o.cpp) || o.cpp <= 0) continue
      if (typeof o.miles !== 'number' || !Number.isFinite(o.miles) || o.miles <= 0) continue
      if (!o.program) continue
      const def = canonicalizeProgram(o.program)
      if (!def) continue
      const slug = PROGRAM_ID_TO_SWEET_SPOT_SLUG[def.id]
      if (!slug) continue // program has no sweet-spots page — never guess one

      const entry = perProgram.get(slug) ?? { programId: def.id, samples: [] }
      entry.samples.push({ cpp: o.cpp, miles: o.miles })
      perProgram.set(slug, entry)
    }
  }

  return perProgram
}

// Pure: one route+program's samples -> a scored candidate, or null when it
// doesn't clear notability (or the slug map/program table can't resolve it —
// defensive, should be unreachable given scoreRoute()'s own filtering).
function toCandidate(
  route: string,
  slug: string,
  entry: RouteProgramSample,
  destCountry: string,
  destRegion: string,
): SweetSpotCandidate | null {
  const meanCpp = mean(entry.samples.map((s) => s.cpp))
  const baseline = programValue(entry.programId)
  if (!isNotable(meanCpp, baseline)) return null
  const program = sweetSpotsByProgram().find((p) => p.slug === slug)
  if (!program) return null
  const milesOw = Math.round(mean(entry.samples.map((s) => s.miles)))
  return {
    route,
    programSlug: slug,
    program: program.name,
    cabin: CANDIDATE_CABIN,
    milesOw,
    milesLabel: formatMilesLabel(milesOw),
    cpp: Math.round(meanCpp * 10) / 10,
    baseline,
    sampleCount: entry.samples.length,
    notes: buildNotes(meanCpp, baseline, entry.samples.length),
    destCountry,
    destRegion,
  }
}

// Persist one candidate as a pending_review draft — the facts via the
// existing, unchanged createSweetSpotDraft() (createdBy is the sentinel
// value, never an owner email), then draftSweetSpotWhy() to fill the
// why-line from the deterministic `notes` computed above. NEVER
// auto-approves. NEVER throws: every function this calls already degrades
// via withDb/gateway-absent. Returns the persisted row (for the caller's
// optimistic UI splice), or null when the draft itself couldn't be created.
async function persistCandidate(c: SweetSpotCandidate): Promise<SweetSpotDraft | null> {
  const id = await createSweetSpotDraft({
    route: c.route,
    programSlug: c.programSlug,
    cabin: c.cabin,
    milesOw: c.milesOw,
    milesLabel: c.milesLabel,
    confidence: 'med',
    createdBy: CONTENT_CANDIDATES_CREATED_BY,
  })
  if (!id) return null

  const why = await draftSweetSpotWhy({
    route: c.route,
    program: c.program,
    cabin: c.cabin,
    milesLabel: c.milesLabel,
    milesOw: c.milesOw,
    notes: c.notes,
  })
  if (why) await updateSweetSpotDraftWhy(id, why)

  return {
    id,
    seq: 0, // DB-assigned; unknown here — matches NewDraftForm's own optimistic-insert placeholder
    route: c.route,
    program: c.program,
    programSlug: c.programSlug,
    metal: null,
    cabin: c.cabin,
    milesOw: c.milesOw,
    milesLabel: c.milesLabel,
    why: why ?? '',
    confidence: 'med',
    status: 'pending_review',
    createdBy: CONTENT_CANDIDATES_CREATED_BY,
  }
}

// Mine assembleSearch over today's hub/destination/date grid and persist
// notable Business-cabin candidates AS THEY'RE FOUND, up to
// MAX_NEW_CANDIDATES_PER_RUN — the single entry point the cron route and the
// owner's "Find candidates now" action both call. NEVER throws
// (assembleSearch, listSweetSpotDrafts, and everything else this calls are
// all documented never-throw).
//
// `opts.deadlineAt` (epoch ms, default `now + MINING_TIME_BUDGET_MS`) is
// checked before starting each new route's searches — past it, mining stops
// and whatever was found/created so far is returned, rather than risking the
// invocation being killed mid-grid. Passed explicitly (not just derived from
// `now`) so a caller/test can inject an already-past deadline deterministically.
export async function runSweetSpotCandidatePipeline(
  now: Date = new Date(),
  opts?: { deadlineAt?: number },
): Promise<PipelineResult> {
  const deadlineAt = opts?.deadlineAt ?? now.getTime() + MINING_TIME_BUDGET_MS
  const runDestinations = destinationsForRun(now)

  const existingDrafts = (await listSweetSpotDrafts()) ?? []
  const existingKeys = buildExistingKeys(existingDrafts)

  let found = 0
  let created = 0
  const drafts: SweetSpotDraft[] = []

  routes: for (const hub of ORIGIN_HUBS) {
    for (const dest of runDestinations) {
      if (created >= MAX_NEW_CANDIDATES_PER_RUN) break routes
      if (Date.now() >= deadlineAt) break routes // stop STARTING new searches past the budget
      if (dest.code.toUpperCase() === hub.toUpperCase()) continue

      const route = `${hub} → ${dest.code}`
      const perProgram = await scoreRoute(hub, dest, now)

      const routeCandidates: SweetSpotCandidate[] = []
      for (const [slug, entry] of perProgram) {
        const candidate = toCandidate(route, slug, entry, dest.country, dest.region)
        if (candidate) routeCandidates.push(candidate)
      }

      // A single route can surface more than one qualifying program (e.g. two
      // partners both clear notability) — rank just THIS route's survivors so
      // the strongest persists first if the global cap is about to bind.
      const fresh = rankAndCapCandidates(
        filterNewCandidates(routeCandidates, existingKeys),
        routeCandidates.length,
      )

      for (const candidate of fresh) {
        found++
        const draft = await persistCandidate(candidate)
        if (draft) {
          created++
          drafts.push(draft)
          // Defensive: a route is only ever visited once per run, so this
          // combo can't recur — but keeps existingKeys honest if that changes.
          existingKeys.add(draftKey(candidate.route, candidate.programSlug, candidate.cabin))
          if (created >= MAX_NEW_CANDIDATES_PER_RUN) break routes
        }
      }
    }
  }

  return { created, found, drafts }
}
