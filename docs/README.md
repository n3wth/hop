# Documentation Index

This folder stores product, design, operating, and implementation documentation for hop. Start
here to find the canonical home for anything; each area below owns its own detail.

## Start here

| Path | Purpose |
|---|---|
| [`agent-playbook.md`](agent-playbook.md) | The operating judgment for any agent working here — the loop, invariants, design canon, taste-call protocol. Read first if you're a smaller model. |
| [`plans/2026-07-04-business-plan.md`](plans/2026-07-04-business-plan.md) | **The adopted business plan** — positioning, pricing, gates, execution roadmap. Still owns those decisions. |
| [`plans/2026-08-20-path-to-first-dollar.md`](plans/2026-08-20-path-to-first-dollar.md) | **90-day operating addendum** — one attributed consumer dollar + parallel MCP/B2B. Floor is a readout, not the company target. Gate ④ amended 2026-08-21 (won't-buy seats.aero). |
| [`plans/2026-08-21-replace-seatsaero.md`](plans/2026-08-21-replace-seatsaero.md) | **Award-data replacement** — chart-cpp then first-party live search. ADR 0014. This is N-386 re-specified (not failover). |
| [`autonomy-runbook.md`](autonomy-runbook.md) | Rules for autonomous sessions: queue, merge policy (ADR 0009), guardrails, compound step. |
| [`ops-runbook.md`](ops-runbook.md) | How to turn production capabilities on/off (flags, crons, secrets, billing, checkout). |
| [`meta/`](meta/README.md) | The agentic development process as portable, stack-agnostic patterns — worktrees, PR pipeline, machine review, tiered auto-merge, runbook, memory, self-healing. |

## Memory surfaces (the compound-engineering spine)

| Path | Purpose | Update cadence |
|---|---|---|
| [`decisions/`](decisions/README.md) | ADRs — dated records of load-bearing architectural choices and *why*. Read before changing a decided area. | When a hard-to-reverse choice is made |
| [`solutions/`](solutions/README.md) | Searchable solved-problems library (YAML frontmatter). Grep here before debugging anything familiar. | After every non-obvious fix |
| [`plans/`](plans/) | Forward-looking implementation blueprints, `YYYY-MM-DD-slug.md`. Plans are the source of truth for a build. | Per unit of work |
| [`autonomy-log.md`](autonomy-log.md) | Append-only log of autonomous runs and their outcomes. | Every autonomous run |

## Product & strategy

| Path | Purpose | Update cadence |
|---|---|---|
| [`plans/2026-07-03-critical-review-roadmap.md`](plans/2026-07-03-critical-review-roadmap.md) | Execution detail for the R0–R3 roadmap items the business plan sequences. | When items land |
| [`plans/2026-08-20-path-to-first-dollar.md`](plans/2026-08-20-path-to-first-dollar.md) | 90-day operating addendum: one attributed consumer dollar + parallel MCP/B2B. Sequencing until the next dated addendum. Gate ④ = seats.aero off paid path (2026-08-21). | When A-terms / A-hn / A-mcp fire, or at the 90-day kill check |
| [`plans/2026-08-21-replace-seatsaero.md`](plans/2026-08-21-replace-seatsaero.md) | First-party award quotes: chart-cpp (legitimacy) then live search (quality). | When FD-charts / FD-live land, or coverage tables refresh |
| [`plans/2026-07-05-media-engine-to-1m.md`](plans/2026-07-05-media-engine-to-1m.md) | **The ambition layer** — M-series media/audience epics toward $1M/mo; mirrors to Linear `M#` issues. | Monthly checkpoint (§6) or when a stream is killed |
| [`growth-hypothesis.md`](growth-hypothesis.md) | Forward-looking growth/business hypothesis for a funded agent-team month. | When strategy is revisited |
| [`content-plan.md`](content-plan.md) | Content strategy, sweet-spots seed data, SEO direction, concierge prompt seeds. | Quarterly, plus major market changes |
| [`content-apis.md`](content-apis.md) | Sourcing + licensing rationale for the committed destination-data snapshots (climate normals, place facts). | When a dataset or source changes |
| [`board/`](board/) | Board memos. | Per board cycle |

## Design

| Path | Purpose | Update cadence |
|---|---|---|
| [`design/copy-spec.md`](design/copy-spec.md) | UI copy tone and component-level copy rules (strict voice). | As UI language evolves |
| [`design/experience-heuristics.md`](design/experience-heuristics.md) | Composition rules: structural imagery, motion budget, verification breakpoints. | When design direction changes |
| [`design/DESIGN-SYSTEM.md`](design/DESIGN-SYSTEM.md) | Token/component reference for the flat editorial system. | As the system evolves |
| `design/CHOSEN-editorial.html` | Canonical visual reference for flat editorial design. | Only when design direction changes |
| `design/hop-v9.html` | Prior locked visual reference and layout artifact. | Historical reference |
| `design/hop-logo.svg` | Canonical bunny logo vector. | Rare |

## Operations & the agent org

| Path | Purpose | Update cadence |
|---|---|---|
| [`team/routines.md`](team/routines.md) | The desk roster — who runs, when, and what each routine owns. | When a desk is added/changed |
| [`team/desk-provisioning.md`](team/desk-provisioning.md) | How to stand up a new desk (identity, inbox, routine). | When the pattern changes |
| [`finance/`](finance/README.md) | Finance desk: ledger, budget, opportunities, outreach. | Per finance run |
| [`marketing/`](marketing/README.md) | Growth desk: funnel log + ready-to-send launch drafts. | Per growth run |
| [`cloud-env.md`](cloud-env.md) | Cloud agent environment template: setup script + env-var tiers. | When env keys or the setup script change |
| [`enabling-agentic-memory.md`](enabling-agentic-memory.md) | Operator guide for flipping on the M1–M4 memory spine. | When a memory seam changes |
| `legal/` | Privacy policy + terms of service source documents. | When legal copy changes |
| `legacy-migrations/` | Pre-Drizzle SQL migrations kept for the historical record. | Never (append-only history) |

## Conventions

- Keep docs factual and concise. Prefer computed product behavior over marketing language.
- Treat files under `design/` as source-of-truth artifacts unless explicitly replaced.
- Add new implementation plans under `plans/` using `YYYY-MM-DD-slug.md` naming.
- When guidance changes, update the primary source file instead of duplicating guidance elsewhere.
- For any data in `content-plan.md` that depends on dynamic pricing, mark it as approximate.

## Quick maintenance checklist

1. Verify links and examples still resolve to current code paths.
2. Confirm date-sensitive claims include a month/year marker.
3. Remove stale references when a feature flag graduates or is retired.
4. Keep one canonical home for each decision to avoid drift.
