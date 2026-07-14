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

## 2026-07-06 (run 4 — Sentry opportunity; two duplicate PRs closed unmerged)

- **MRR**: still ~$0 (unchanged; no DB access this session, no new billing signal).
- **Known burn**: unchanged, ~$75/mo infra + unmeasured LLM spend. Budget stays approved at
  ~$125/mo — no new reply from Oliver since his run-2 approval, nothing to update.
- **Outreach queue**: both items already `status: sent` (run 3), nothing new queued.
- **New opportunity found**: Sentry for Startups (up to $5K error-monitoring credits, direct
  apply, no VC required, hop qualifies on age/funding) — added as `drafted` in
  `opportunities.md`. Also researched and rejected GitHub for Startups and Linear for Startups
  (both gate credits behind a VC/accelerator partner code hop doesn't have) — an initial draft
  of the GitHub item wrongly attached a "$40K non-dilutive cash" figure from an unrelated
  program (GitHub Accelerator); caught and corrected via email before it reached this ledger.
  Cloudflare Email Routing verification is no longer tracked here — resolved 2026-07-06, see
  `README.md`.
- **Process note**: run 4 produced two concurrent agent sessions on separate branches
  (`finance/2026-07-06-run4`, `finance/2026-07-06-run4-github-credits`); both PRs (#255, #256)
  were closed without merging, so this content never reached `main`. Backfilled here (run 5,
  2026-07-07) from PR #255's diff so the Sentry finding and the GitHub/Linear rejections aren't
  lost or re-researched. Single-session-per-run going forward avoids this duplication.
- **Unknowns flagged**: same as prior runs — active Pro subscriber count, card-affiliate status,
  outclick/escalation counts (all require live DB/dashboard access this session lacks).

## 2026-07-07 (run 5)

- **MRR**: still ~$0 (unchanged; no DB access this session, no new billing signal since run 4).
- **Known burn**: unchanged, ~$75/mo infra + unmeasured LLM spend (`DEFAULT_INFRA_COST_MONTHLY_USD`
  still 75 in `lib/unit-economics.ts`, `llmCostUsd` still unmeasured `null`). Budget stays
  approved at ~$125/mo, no new reply from Oliver to act on.
- **Outreach queue**: `outreach.md` re-checked — both prior items (seats.aero, AwardWallet)
  already `status: sent`, no new `approved-to-send` items this run, nothing sent.
- **Repo activity since run 4**: newsletter signup + weekly digest (R1.6/R2.3), verdict receipts
  share pages (R1.5), a token-hashing/rate-limit hardening pass on the newsletter flow, and an
  agentic-process docs pattern library — no pricing, billing-flag, or cost-constant changes.
- **New opportunities found**: corrected a prior run's overly-pessimistic rejection of **Vercel
  for Startups** — a baseline free-Pro tier is self-serve for bootstrapped founders (only the
  ~$30K upper tier needs VC/accelerator affiliation), and Vercel Pro is a real existing $20/mo
  cost line, so promoted to `drafted`. Also added **Mercury's Raise + Perks Bundle** (free
  business banking + a $200K+ partner-credit marketplace) as `drafted`, explicitly flagged as
  Oliver-only since opening a bank account is identity-bearing. Researched and rejected **Brex**
  (corporate card requiring ~$50K+ cash reserves and an EIN — a financial-account commitment
  this desk won't pursue) and **Loops.so** (discount on a tool hop doesn't use; email already
  runs on Resend).
- **Process note**: recovered run 4's Sentry-for-Startups finding and GitHub/Linear rejections
  into `opportunities.md` and backfilled a run-4 ledger entry — that run's two PRs (#255, #256)
  were closed unmerged and the content never reached `main` (see run-4 note above).
- **Unknowns flagged**: same as prior runs — active Pro subscriber count, card-affiliate status,
  outclick/escalation counts, actual company cash reserves (relevant to the Brex eligibility
  question above) — all require live DB/dashboard/bank access this session lacks.

## 2026-07-14 (run 6 — course correction: pausing credit hunt, subscriber count still unanswered)

- **MRR**: still ~$0/unknown. Same structural gap as every prior run — this session has no
  `DATABASE_URL` or Stripe read access, confirmed again this run. This is no longer just a
  self-reported gap: the 2026-07-12 board memo (`docs/board/2026-07-12-board-memo.md`)
  independently flagged it as a consensus risk ("finance-desk output is answering the wrong
  question... the ledger has gone silent for 5 days") and voted it kill-list item 4 + ranked
  amendment 7. Escalating directly to Oliver this run rather than repeating "unknown" quietly —
  see the memo sent this run for the concrete ask.
- **Known burn**: unchanged, ~$75/mo infra (`DEFAULT_INFRA_COST_MONTHLY_USD` still 75 in
  `lib/unit-economics.ts`), LLM spend still unmeasured (`llmCostUsd` still hardcoded `null`).
  Budget stays approved at ~$125/mo, no new reply from Oliver on the envelope itself.
- **Process correction**: Oliver replied to the run-5 memo on 2026-07-08 ("youre sending me the
  same kinda thing in the end") — direct feedback that these memos have become repetitive. The
  board's 2026-07-12 review independently reached the same conclusion from a different angle
  (chasing credits instead of the subscriber-count question). Acting on both this run: **paused
  the opportunity hunt** (`README.md` step 3, no new items added to `opportunities.md`) and
  stopped restating the standing drafted-opportunity list in the memo — Oliver already has it in
  `opportunities.md` and repeating it every week added noise, not information.
- **Billing/pricing risk (flagged by the board, adjacent to finance)**: `HOP_ENABLE_BILLING` is
  still ON against an unlicensed seats.aero feed (commercial-terms email sent 2026-07-06, no
  reply logged 8 days later), and the public `/pricing` page the board voted to kill/freeze on
  2026-07-05 is still live and now has an inbound link from the new `/mcp` page. Not this desk's
  call to flip flags or revert pages — flagging because it's a live financial/legal exposure line
  this desk should track, not silently omit.
- **Outreach queue**: `outreach.md` re-checked — both prior items (seats.aero, AwardWallet)
  still `status: sent`, no reply from either, no new `approved-to-send` items this run.
- **Timeline**: 22 days remain to the founder's own $10k MRR / 2026-08-05 northstar
  (`docs/plans/2026-07-05-agentic-travel-agent-northstar.md`) — with `signed_up` still reading
  zero across three funnel-log reads per the board memo, a confirmed subscriber count (even zero)
  is now the single most useful thing this desk could report and cannot get to on its own.
