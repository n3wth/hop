// Pure, deterministic issue templates (ADR 0007) — symptom first, then the
// numbers and window, exact file pointers, acceptance criteria. Copy-spec
// voice (docs/design/copy-spec.md): state the answer and the number; no slop,
// no emoji. Every number in a rendered body arrives pre-computed in the
// Detection (counted rows, timestamp math, named constants from
// lib/health-checks.ts) — this module only formats. No LLM anywhere.
//
// The `[hop:<fingerprint>]` title suffix is added at FILING time (lib/linear.ts)
// so the stored title stays clean for the digest to render verbatim.

import type { Detection } from '@/lib/health-checks'

// The exact user-facing line per degraded source — quoted verbatim from
// components/DegradedNote.tsx:13 (quoted, not imported: pulling a client
// component into lib would drag React into every server import of this
// module). If that copy changes, update this quote with it.
const USERS_SEE: Record<string, string> = {
  awards: 'Award data is unavailable right now — showing cash only.',
  cash: 'Cash fares are unavailable right now — showing points only.',
  balances: 'Couldn’t refresh your balances just now — figures may be stale.',
}

const SOURCE_CLIENTS: Record<string, string> = {
  cash: 'lib/duffel.ts (cash fares)',
  awards: 'lib/awards.ts (published saver charts)',
  balances: 'lib/awardwallet.ts + lib/accounts.ts (balances)',
}

const FOOTER = "Auto-filed by hop's health sentinel. Numbers are counted, not guessed."

// One decimal, the way the verdict copy rounds cpp. Defensive: a non-finite
// number renders as '?' — we never fabricate one.
function fmt1(n: number): string {
  if (!Number.isFinite(n)) return '?'
  return String(Math.round(n * 10) / 10)
}

function pct(share: number): string {
  return `${fmt1(share * 100)}%`
}

function joinBody(sections: string[]): string {
  return sections.filter(Boolean).join('\n\n')
}

export function renderFinding(d: Detection): { title: string; body: string } {
  switch (d.kind) {
    case 'cron-dead': {
      const { lastRunAt, ageHours, expectedIntervalHours, staleAfterHours } = d.data
      return {
        title: `${d.subject} cron has not completed in ${fmt1(ageHours)}h`,
        body: joinBody([
          [
            'What was observed',
            `- Last heartbeat ${lastRunAt} — ${fmt1(ageHours)}h ago. This job runs about every ${fmt1(expectedIntervalHours)}h; a heartbeat older than ${fmt1(staleAfterHours)}h (HEARTBEAT_STALE_FACTOR × the interval) counts as dead.`,
          ].join('\n'),
          [
            'Where to look',
            `- app/api/cron/${d.subject}/route.ts`,
            '- vercel.json (the schedule)',
            '- lib/health-checks.ts (CRON_JOBS, HEARTBEAT_STALE_FACTOR)',
          ].join('\n'),
          [
            'Acceptance',
            '- The cron records a fresh heartbeat again; the finding auto-resolves on the next sentinel run.',
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
    case 'upstream-spike': {
      const { count24h, priorDailyMean, threshold } = d.data
      const usersSee = USERS_SEE[d.subject]
      return {
        title: `${d.subject} degraded ${count24h} times in 24h (prior daily mean ${fmt1(priorDailyMean)})`,
        body: joinBody([
          usersSee ? ['Users see', `- "${usersSee}"`].join('\n') : '',
          [
            'What was observed',
            `- ${count24h} degraded ${d.subject} fetches in the last 24h against a prior-week daily mean of ${fmt1(priorDailyMean)}. Spike line: ${fmt1(threshold)} — max(SPIKE_MIN_EVENTS, SPIKE_FACTOR × mean).`,
          ].join('\n'),
          [
            'Where to look',
            `- ${SOURCE_CLIENTS[d.subject] ?? 'the upstream client for this source'}`,
            '- lib/search.ts (the assembleSearch fan-out that records degraded[])',
            '- lib/health-checks.ts (SPIKE_MIN_EVENTS, SPIKE_FACTOR)',
          ].join('\n'),
          [
            'Acceptance',
            `- The 24h degraded count for ${d.subject} falls back under the spike line; the finding auto-resolves.`,
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
    case 'flag-drift': {
      const keys = d.data.missingKeys
      const verb = keys.length === 1 ? 'is' : 'are'
      return {
        title: `${d.subject} is on but ${keys.join(' + ')} ${verb} missing`,
        body: joinBody([
          [
            'What was observed',
            `- The ${d.subject} flag is set while ${keys.join(' + ')} ${verb} absent, so the seam reads as live but is silently inert (its is*Enabled() helper stays false).`,
          ].join('\n'),
          [
            'Where to look',
            "- lib/env.ts (the seam's flag helper and its required keys)",
            "- The deployment's environment settings (env changes are owner-only — ADR 0007 class c)",
          ].join('\n'),
          [
            'Acceptance',
            '- Set the missing key(s) or turn the flag off; the finding auto-resolves on the next sentinel run.',
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
    case 'dataset-stale': {
      const { file, generatedAt, ageDays, staleAfterDays } = d.data
      return {
        title: `${d.subject} dataset is ${ageDays} days old`,
        body: joinBody([
          [
            'What was observed',
            `- ${file} was generated ${generatedAt} — ${ageDays} days ago, past the ${staleAfterDays}-day line (DATASET_STALE_DAYS).`,
          ].join('\n'),
          [
            'Where to look',
            `- ${file}`,
            `- scripts/gen-${d.subject}.mjs (keyless regenerator; needs network egress, runs outside the app)`,
          ].join('\n'),
          [
            'Acceptance',
            '- Regenerate and commit (human-reviewed diff); the stamp resets and the finding auto-resolves.',
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
    case 'valuation-drift': {
      const { observedCpp, baselineCpp, sampleSize, sampleGate, driftShare, thresholdShare } = d.data
      return {
        title: `${d.subject} live cpp ${fmt1(observedCpp)} vs baseline ${fmt1(baselineCpp)} (${sampleSize} samples)`,
        body: joinBody([
          [
            'What was observed',
            `- The observed trimmed-mean cpp for ${d.subject} sits ${pct(driftShare)} off the curated baseline — over the ${pct(thresholdShare)} line (VALUATION_DRIFT_THRESHOLD) — on ${sampleSize} first-party samples (trust gate: ${sampleGate}, MIN_SAMPLES_TO_TRUST).`,
          ].join('\n'),
          [
            'Where to look',
            '- lib/valuations.ts (BASELINE_CPP — this pipeline never writes it; a human updates it)',
            '- lib/valuations-live.ts (the merge and the ADR 0005 trust gate)',
            '- docs/content-plan.md (sweet-spots copy grounded on the baseline)',
          ].join('\n'),
          [
            'Acceptance',
            '- The baseline is updated through normal review, or drift falls back under the threshold; the finding auto-resolves.',
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
    case 'dead-watches': {
      const { count, staleAfterDays } = d.data
      return {
        title: `Active watches have zero alerts in ${staleAfterDays} days (${count} counted)`,
        body: joinBody([
          [
            'What was observed',
            `- There are ${count} active, unalerted watches in the system that are at least ${staleAfterDays} days old (WATCH_DEAD_DAYS). They have fired zero alerts in their entire window.`,
          ].join('\n'),
          [
            'Where to look',
            '- lib/standing-orders.ts (active watches query)',
            '- lib/health-checks.ts (WATCH_DEAD_DAYS constant)',
          ].join('\n'),
          [
            'Acceptance',
            '- These watches are either modified, cancelled, or fire an alert, bringing the count of old dead watches back to 0; the finding auto-resolves on the next sentinel run.',
          ].join('\n'),
          FOOTER,
        ]),
      }
    }
  }
}
