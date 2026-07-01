// Live valuation overrides — per-program cpp aggregates computed by the
// Cloudflare valuation Worker from hop's own first-party cash-vs-award
// observations (lib/valuation-telemetry.ts), synced into Supabase so
// lib/valuations-live.ts can merge them over the static lib/valuations.ts
// baseline. Service-role client, server-only; degrades gracefully via withDb
// and NEVER throws. Upsert is keyed on program_id, so a resync just replaces
// the prior snapshot for that program.
//
// SQL (run manually — this code does NOT run DDL):
//   CREATE TABLE public.hop_valuation_overrides (
//     program_id   text primary key,
//     cpp          numeric not null,
//     sample_size  integer not null,
//     as_of        timestamptz not null,
//     updated_at   timestamptz default now()
//   );
//   ALTER TABLE public.hop_valuation_overrides ENABLE ROW LEVEL SECURITY;
//   -- service-role bypasses RLS; no anon/auth policy (server-side only).

import { withDb } from '@/lib/supabase-helpers'

const TABLE = 'hop_valuation_overrides'

export interface ValuationOverride {
  programId: string
  cpp: number
  sampleSize: number
  asOf: string
}

interface OverrideRow {
  program_id: string
  cpp: number | string
  sample_size: number | string
  as_of: string
}

interface OverrideInsertRow {
  program_id: string
  cpp: number
  sample_size: number
  as_of: string
  updated_at: string
}

function rowToOverride(row: OverrideRow): ValuationOverride | null {
  if (typeof row.program_id !== 'string' || row.program_id.trim() === '') return null
  const cpp = Number(row.cpp)
  const sampleSize = Number(row.sample_size)
  if (!Number.isFinite(cpp) || !Number.isFinite(sampleSize)) return null
  return {
    programId: row.program_id,
    cpp,
    sampleSize,
    asOf: row.as_of,
  }
}

// Every stored override. Empty on any failure (unconfigured db, query error) —
// callers (lib/valuations-live.ts) fall all the way back to the static baseline.
export async function getValuationOverrides(): Promise<ValuationOverride[]> {
  return withDb<ValuationOverride[]>([], async (db) => {
    const { data, error } = await db
      .from(TABLE)
      .select('program_id, cpp, sample_size, as_of')
    if (error || !data) return []
    return (data as OverrideRow[]).map(rowToOverride).filter((o): o is ValuationOverride => o !== null)
  })
}

// Replace the stored overrides for the given programs (upsert on program_id).
// Returns false on failure or malformed input; never throws. An empty array is
// a true no-op success (nothing to write).
export async function upsertValuationOverrides(rows: ValuationOverride[]): Promise<boolean> {
  if (!Array.isArray(rows)) return false
  if (rows.length === 0) return true
  return withDb(false, async (db) => {
    const now = new Date().toISOString()
    const payload: OverrideInsertRow[] = rows.map((r) => ({
      program_id: r.programId,
      cpp: r.cpp,
      sample_size: r.sampleSize,
      as_of: r.asOf,
      updated_at: now,
    }))
    const { error } = await db
      .from(TABLE)
      .upsert(payload, { onConflict: 'program_id' })
    return !error
  })
}
