# PostHog Self-driving setup report

Run: 2026-07-11, via the `self-driving-setup` skill (wizard v1.29.1 flow, executed headless).
Project: [n3wth (223560)](https://us.posthog.com/project/223560) · [Self-driving inbox](https://us.posthog.com/project/223560/inbox)

## Summary

PostHog Self-driving is on for this project. Eight signal sources were enabled (scout gate, error
tracking ×3, session replay, support, Linear, GitHub Issues) and the scout troop was materialized
and tuned to 3 active scouts. Findings start appearing in the
[Self-driving inbox](https://us.posthog.com/project/223560/inbox) within ~30 minutes of the first
coordinator tick.

## AI data processing

Approved (session replay's analysis source accepted the default sample rate with no AI-approval
rejection).

## GitHub

Connected — already connected before this run (integration id 155247, org `n3wth`).

## Products enabled

| Product | State |
|---|---|
| Error tracking | already enabled — active issues exist in the project |
| Session replay | already enabled — recordings exist (retention 365d) |
| Support (Conversations) | source enabled, product state unverified — the `products-enable` tool is not exposed on this MCP connection; see follow-ups |

`posthog.init` override check (this repo, `lib/posthog-client.ts`): clean — neither
`disable_session_recording` nor `capture_exceptions: false` is set, so no code change was needed.

## Signal sources

| source_product / source_type | Action | Config id |
|---|---|---|
| `signals_scout` / `cross_source_issue` | enabled (scout gate) | 019f535a-2086-70e0-a23f-406c27f1001e |
| `error_tracking` / `issue_created` | enabled | 019f535a-6397-7535-bcc8-738d54f6c4e1 |
| `error_tracking` / `issue_reopened` | enabled | 019f535a-ae28-7879-aa2d-468252ad1981 |
| `error_tracking` / `issue_spiking` | enabled | 019f535a-e46a-706a-9185-ce52ee65048b |
| `session_replay` / `session_analysis_cluster` | enabled (server default `sample_rate: 0.1`) | 019f535b-5520-7a99-945b-ed3f9cab12f4 |
| `conversations` / `ticket` | enabled — idle until an inbound channel is connected | 019f535b-9378-7f37-95a2-16a4d03f4308 |
| `linear` / `issue` | enabled | 019f535c-80e5-73f2-81a0-e15c510b2dc9 |
| `github` / `issue` | enabled | 019f535c-91f5-762e-9d6e-7931b339a9cb |
| `llm_analytics`, `logs`, `evaluation`, `alert_state_change` types | skipped — internal-only / not v1 responders per the setup flow | — |
| `zendesk` / `ticket`, `pganalyze` / `issue` | skipped — no evidence either tool is used | — |

## Connected tools

| Tool | Class |
|---|---|
| Linear | already connected — warehouse source `019c8100-8db6…` syncing (`linear.issues`, 338 rows). Enabled on repo evidence: `AGENTS.md` documents Linear as hop's work queue. |
| GitHub Issues | already connected — warehouse source `019c8101-b18a…` (repo `n3wth/n3wth`) with `issues` syncing. Note: the source reports "Invalid GitHub credentials" on its disabled `commits` schema; the hop repo itself is not a warehouse source. |
| Zendesk | not used — skipped, no responder |
| pganalyze | not used — skipped, no responder |

This run ran without an interactive prompt, so connected-tool picks were made from repo/project
evidence instead of a user multi-select — only tools with an existing, user-created warehouse
source were enabled.

## Scout troop

26 scouts materialized via `signals-scout-config-sync`. 3 active, 23 disabled (default posture:
daily interval, emitting).

| Scout | State | Reason |
|---|---|---|
| `signals-scout-general` | **on** | always on — cross-product sweep |
| `signals-scout-product-analytics` | **on** | hop's named funnel events are this project's core stream |
| `signals-scout-web-analytics` | **on** | multi-site pageview/UTM traffic (hop.flights, n3wth.com, garden.n3wth.com) |
| `signals-scout-error-tracking`, `signals-scout-session-replay` | off | covered by the native sources above (intentional, not an evidence gap) |
| remaining 21 | off | kept off to cap recurring LLM spend; re-enable in PostHog if that surface becomes active (e.g. `signals-scout-ai-observability` for the concierge's `$ai_generation` traces, `signals-scout-surveys`, `signals-scout-revenue-analytics` once Stripe is a PostHog source) |

## Custom scouts

None created — this step is propose-first and needs an interactive approval, which this run
didn't have. One candidate survived the gap analysis and is left as a proposal:

- **hop search→verdict funnel scout** (`signals-scout-hop-funnel`): watch the explicit R0.5
  funnel events (search → verdict → outclick) for conversion sliding while search volume holds.
  Discriminator: derived-rate regression with stable entrants. Partially overlaps
  `signals-scout-product-analytics` only if the funnel is saved as an insight — saving it as one
  may be the cheaper fix.

Ruled out: upstream-degradation watching (hop's `degraded[]` isn't emitted as a PostHog event —
not watchable yet); concierge LLM regressions (owned by the disabled `signals-scout-ai-observability`,
a re-enable, not a custom scout). Noise escape hatch: set `emit: false` on any scout's config in
PostHog to switch it to dry-run.

## Follow-ups

- [ ] Confirm the Support/Conversations *product* toggle in PostHog (the `products-enable` tool
      wasn't available to this run) and connect an inbound channel (email / inbox / Slack) so
      tickets flow.
- [ ] Reconnect GitHub credentials on the `n3wth` warehouse source (its `commits` schema reports
      invalid credentials) — [data sources](https://us.posthog.com/project/223560/data-management/sources).
- [ ] Decide on the proposed custom funnel scout above (or save the funnel as a PostHog insight
      so `signals-scout-product-analytics` covers it).

## What happens next

The scout coordinator picks up the fresh configs within ~30 minutes; the first scans run then.
Signal-source findings and scout reports cluster in the
[inbox](https://us.posthog.com/project/223560/inbox), ranked by priority; actionable ones can open
investigations and pull requests against the connected GitHub org.
