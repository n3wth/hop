// The product funnel's FIVE events — Linear N-301 / roadmap R0.5. This module
// is pure constants + types (no I/O, no SDK), safe to import from client and
// server alike. Capture goes through exactly two seams:
//
//   client — lib/analytics-client.ts (posthog-js, lazy, NEXT_PUBLIC-gated):
//     search_ran, verdict_viewed (components/SearchAnalytics.tsx)
//   server — lib/posthog-server.ts#captureFunnelEvent (plain fetch, key-gated):
//     signed_up (lib/auth.ts user-create hook), first_program_added
//     (app/actions/accounts.ts), outclick (lib/outclicks.ts, beside the ledger
//     insert)
//
// EXACTLY these five — no pageviews, no autocapture, no extra product events.
// Adding a sixth is a product decision, not a code convenience.

export const FUNNEL_EVENTS = {
  signedUp: 'signed_up',
  firstProgramAdded: 'first_program_added',
  searchRan: 'search_ran',
  verdictViewed: 'verdict_viewed',
  outclick: 'outclick',
} as const

export type FunnelEventName = (typeof FUNNEL_EVENTS)[keyof typeof FUNNEL_EVENTS]

// Payload contract per event. Every value is computed/known data (IATA codes,
// engine verdicts, canonical program names) — never LLM output, never PII
// beyond the Better Auth user id used as the PostHog distinct_id.
export interface FunnelEventProperties {
  // Identity lives in distinct_id (the Better Auth user id); no properties.
  signed_up: Record<string, never>
  // The canonical program name the user's first manual program resolved to.
  first_program_added: { program: string }
  // IATA codes of the executed search.
  search_ran: { origin: string; destination: string }
  // The engine's verdict for the rendered hero + the pick's economics.
  verdict_viewed: { verdict: string; cpp: number | null; program: string | null }
  // Mirrors the hop_outclicks ledger row (anonymous by design — no user id).
  outclick: { kind: string; target: string; url: string; program: string | null }
}
