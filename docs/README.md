# Documentation Index

This folder stores product, design, and implementation documentation for hop.

## What lives here

| Path | Purpose | Update cadence |
|---|---|---|
| `cloud-env.md` | Claude Code cloud environment template: setup script + env-var tiers. | When env keys or the setup script change |
| `content-plan.md` | Content strategy, sweet spots seed data, SEO direction, and concierge prompt seeds. | Quarterly, plus major market changes |
| `design/copy-spec.md` | UI copy tone and component-level copy rules. | As UI language evolves |
| `design/CHOSEN-editorial.html` | Canonical visual reference for flat editorial design. | Only when design direction changes |
| `design/hop-v9.html` | Prior locked visual reference and layout artifact. | Historical reference |
| `design/icons.json` | Material symbol path data used by UI icon rendering. | When icon set changes |
| `design/hop-logo.svg` | Canonical bunny logo vector. | Rare |
| `plans/2026-06-28-001-feat-hop-flight-optimizer-plan.md` | Detailed implementation plan for initial optimizer build. | Historical, append-only |
| `growth-hypothesis.md` | Forward-looking growth/business hypothesis for a funded agent-team month. | When strategy is revisited |

## Conventions

- Keep docs factual and concise. Prefer computed product behavior over marketing language.
- Treat files under `design/` as source-of-truth artifacts unless explicitly replaced.
- Add new implementation plans under `plans/` using `YYYY-MM-DD-###-slug.md` naming.
- When guidance changes, update the primary source file instead of duplicating guidance elsewhere.
- For any data in `content-plan.md` that depends on dynamic pricing, mark it as approximate.

## Quick maintenance checklist

1. Verify links and examples still resolve to current code paths.
2. Confirm date-sensitive claims include a month/year marker.
3. Remove stale references when a feature flag graduates or is retired.
4. Keep one canonical home for each decision to avoid drift.