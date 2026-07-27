// Owner-only, on-demand LLM narration of admin ops data (ADR 0007's class-(b):
// the model narrates numbers the engine already computed, it never computes,
// ranks, or thresholds anything itself). Routed through the same Vercel AI
// Gateway path as the concierge/support-reply drafts (lib/ai-gateway.ts),
// gated on the caller passing engine data — see app/actions/admin-analysis.ts,
// which re-derives that data server-side rather than trusting a client payload.

import { callGatewayText } from '@/lib/ai-gateway'

const SYSTEM = [
  "You are hop's internal ops assistant, helping the site owner read a section of the admin dashboard.",
  'hop is a points-vs-cash flight optimizer. The JSON you receive is monitoring data the engine already computed (cron heartbeats, upstream degradation counts, self-improvement findings) — never your own invention.',
  'HARD RULES:',
  '- Narrate and interpret ONLY. Never invent, recompute, or contradict a number in the data.',
  '- The literal string "unavailable (read failed)" means that data source is currently degraded/unknown — say so plainly. NEVER treat it as zero, healthy, or absent-therefore-fine.',
  '- Be terse: 2-4 sentences, plain text, no headers, no bullet points, no emoji, no marketing language.',
  "- Say what stands out — good or bad — and one concrete next step if something needs attention. If it all looks healthy, say so briefly; don't manufacture concern.",
].join('\n')

// null in engine data means "this read failed" (never a fake zero) — see
// lib/cron-heartbeat.ts#listHeartbeats, lib/degradation-telemetry.ts
// #getDegradationWindowCounts. JSON.stringify silently drops that distinction
// (null looks identical to "nothing to report"), so replace it with an
// explicit sentinel the SYSTEM prompt is told never to read as healthy.
function markUnavailable(_key: string, value: unknown): unknown {
  return value === null ? 'unavailable (read failed)' : value
}

// Narrate one admin section for the owner. `data` must already be
// engine-computed (never raw user free text). Returns null when the gateway
// is unconfigured or the call fails — NEVER throws.
export async function analyzeAdminData(label: string, data: unknown): Promise<string | null> {
  const json = JSON.stringify(data, markUnavailable, 2).slice(0, 6000)
  const user = `Section: ${label}\n\nData (JSON):\n${json}\n\nWhat stands out, and does anything need the owner's attention?`
  const text = await callGatewayText({ system: SYSTEM, user, maxTokens: 300 })
  return text ? text.slice(0, 2000) : null
}
