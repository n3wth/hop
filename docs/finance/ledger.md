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

## 2026-07-06 (run 2 — same day, Oliver replied)

- **MRR**: still ~$0 (unchanged since this morning's note; no new signal this run — no DB
  access from this session).
- **Known burn**: unchanged, ~$75/mo infra + unmeasured LLM spend (see above). Budget envelope
  now **approved** by Oliver (was proposed this morning) — no change to the ~$125/mo figure
  itself, just its status.
- **Notable changes this week**: Oliver approved the budget envelope and asked the desk to hunt
  free ad-credit opportunities. Researched all major ad platforms (Google/Meta/TikTok/
  LinkedIn/Microsoft/Reddit/Snapchat/Amazon/X) — finding: none are actually free, all are
  spend-matched (you pay first, they match). Added HubSpot for Startups (free gateway, no card)
  and Reddit Ads' $500-for-$500 match (best audience fit, real spend required) to
  `opportunities.md`. Marketing budget line stays $0/mo — no spend committed.
- **Domain/inbox ops**: Cloudflare Email Routing verification link for `finance-hop@agentmail.to`
  arrived but could not be auto-verified — Cloudflare's bot detection blocks WebFetch, curl, and
  headless-Chromium attempts alike. Needs Oliver to click it manually (see
  `agentmail-domain-dns.md`). AgentMail custom-domain (`agents.hop.flights`) branding is blocked
  — no domain-creation tool exists in the AgentMail MCP surface; documented and parked.
- **Unknowns flagged**: same as this morning — active Pro subscriber count, card-affiliate
  status, outclick/escalation counts (all require live DB/dashboard access this session lacks).

## 2026-07-06 (run 3 — outreach sent)

- **MRR**: still ~$0 (unchanged; no DB access from this session, no new billing signal in the
  merged commits since run 2).
- **Known burn**: unchanged, ~$75/mo infra + unmeasured LLM spend. Budget envelope stays
  approved at ~$125/mo (`budget.md`), no change.
- **Notable changes**: sent the two queued, Oliver-approved outreach emails — seats.aero
  commercial API terms and AwardWallet partner/API onboarding (both `docs/finance/outreach.md`,
  now `status: sent`). Corrected a stale process note (this desk's own prior write-up wrongly
  claimed a Tuesday-only send cadence for the outreach queue — there was never such a rule;
  fixed in `README.md` and `outreach.md`). Repo continues shipping fast: BIMI sender logo and a
  Resend webhook handler (bounce/complaint suppression list) landed since run 2 — used the
  latter as the trigger to research a Resend startup-credit program (see `opportunities.md`).
  Other desks are now standing up too (`docs/team/` shows a strategy desk and a provisioning
  process for new desks) — no finance action needed from that, noted for awareness only.
- **No-cost opportunity found**: Resend for Startups (extended free tier + email credits) —
  hop already runs production Resend usage, real fit, added as `drafted` in `opportunities.md`.
  AWS Activate Founders and Google for Startups Cloud were researched and rejected — no
  existing AWS/GCP usage to offset either credit.
- **Unknowns flagged**: same as run 2 — active Pro subscriber count, card-affiliate status,
  outclick/escalation counts (all require live DB/dashboard access this session lacks).
