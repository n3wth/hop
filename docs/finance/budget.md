# Budget envelope

**Status**: **approved** by Oliver (email reply, 2026-07-06 04:46 UTC — "approved but i do want
you to do some marketing - ideally finding free ad credit opportunities?"). This file is the
single source of truth for the agreed envelope; it is updated only from Oliver's actual replies
(approval / rejection / counter), never from assumption. The marketing ask is being worked as a
credit/discount opportunity hunt (see `opportunities.md`), not paid spend — the $0/mo marketing
line stands until a specific paid channel is proposed and approved.

## Starter envelope (approved 2026-07-06)

| Line | Amount | Basis |
|---|---|---|
| Infra (actual) | $75/mo | `DEFAULT_INFRA_COST_MONTHLY_USD` in `lib/unit-economics.ts` — Vercel Pro $20 + Neon $0-19 + Resend $0-20 + domain ≈ $1, matches the business plan's ~$50-100/mo fixed-burn estimate |
| LLM / agent spend | $50/mo estimate | Concierge (`/ask`) ≈ $0.02-0.03/turn uncached on Sonnet-class models, <$0.01 with prompt caching (business plan §4); no PostHog LLM-cost export wired yet (`llmCostUsd` is `null` in `computeUnitEconomics()`), so this is a placeholder ceiling, not a measured figure |
| Marketing | $0/mo | Explicit non-spend per the business plan (§6.8): no paid acquisition until funnel events exist and activation >40% |
| **Total proposed envelope** | **~$125/mo** | Sum of the above; infra is the only actual/metered line today |

## Approval log

| Date | Action | Who | Note |
|---|---|---|---|
| 2026-07-06 | Envelope proposed | Finance desk | First run — no prior budget.md existed. Emailed to oliver@newth.ai for approval. |
| 2026-07-06 | Envelope approved | Oliver (email reply) | "approved" — plus asked for free ad-credit opportunities to be worked (marketing spend stays $0/mo; credits are a cost offset, not new spend). |

## Rules

- Every commitment (accepting a paid tier, applying for a program that requires a card,
  spending against a credit) requires Oliver's explicit emailed approval first — this desk
  only recommends and drafts.
- When Oliver replies with an approval, rejection, or counter-figure, update the table above
  and add a row to the approval log with the date and what changed.
