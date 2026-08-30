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

## Pricing question, answered (2026-07-28)

Oliver asked (email reply, 2026-07-15 04:20 UTC, sat unprocessed until this run) "did the board
choose new pricing" — no envelope or spend implication, so no change to the table above, but
recorded here since it's a standing pricing-status question:

**No new price has been chosen.** Launch price is unchanged at `PRO_PRICE_YEARLY_USD = 49`
(`lib/pricing.ts`), annual-only, monthly at `$9.99` configured in Stripe but hidden from the UI.
The board has discussed a possible future **$99/yr raise gate**, but it is explicitly
**blocked-on-billing by construction**: one of its three conditions (alerts firing reliably for
60+ days) cannot even start its clock while `HOP_ENABLE_BILLING` stays off pending the seats.aero
commercial-terms reply (N-320, unanswered 22+ days as of this run). The 2026-07-19 board memo's
ranked amendment #10 explicitly voted to **stop describing the $99/yr raise as "in progress"** in
any tracking doc and mark it plainly blocked instead — so the honest answer is "no decision, and
it structurally can't be decided yet."
