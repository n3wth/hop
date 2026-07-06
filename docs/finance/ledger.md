# Weekly financial ledger

One 5-line note per run. Figures come only from the repo's own signals (business plan,
`lib/unit-economics.ts`, `docs/ops-runbook.md`) — unknowns are marked `unknown`, never guessed.

---

## 2026-07-06

- **MRR**: ~$0 (pre-revenue). `HOP_ENABLE_BILLING` is reported ON in the ops runbook (Stripe
  keys + webhook set) but the business plan still lists "owed: one real test purchase
  end-to-end" — no evidence of a live paying subscriber yet. Exact `hop_subscriptions` count is
  unknown (no DB access from this session).
- **Known burn**: ~$75/mo infra (Vercel Pro + Neon + Resend + domain, per
  `DEFAULT_INFRA_COST_MONTHLY_USD`). LLM spend is unmeasured — `llmCostUsd` in
  `computeUnitEconomics()` is hardcoded `null` pending a PostHog billing export.
  Break-even per the business plan: ~15-25 Pro subs/yr, or ~6-12 card approvals/yr, or one B2B
  pilot.
- **Notable changes this week**: repo shows active shipping velocity (10 merged PRs in the
  last visible history, incl. AwardWallet balance caching, Gmail dead-token handling, admin
  billing console). No pricing, cost-constant, or billing-flag changes this week.
- **Pricing surface**: still `/account#billing` only — no public `/pricing` page yet (business
  plan epic B1, open).
- **Unknowns flagged**: active Pro subscriber count, card-affiliate approval status (CJ/Impact
  applications are an owner action per the business plan, status not recorded in-repo),
  outclick/escalation counts (require live DB read).
