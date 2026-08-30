# hop — Board Review Memo (2026-07-05)

## 1. State of the company

hop has a real, working verdict engine (multi-pax cpp fix, always-resolves/never-throws
invariants, computed-not-generated numbers) and, in the last 48 hours, shipped a large surface
of monetization and admin infrastructure — Stripe checkout, MCP quotas, billing portal, Gmail
activation, AwardWallet caching, admin consoles, content pipeline — against ground truth of 1
registered user (the founder), $0 MRR, 2 lifetime affiliate outclicks. `HOP_ENABLE_BILLING` is
live while business-plan.md §3.1's hard gate ④ (seats.aero written terms, R3.1) is unmet and
not started, and the two specced acquisition surfaces that let a stranger encounter the
product (R1.5 receipts, R1.6 newsletter) remain unshipped. The founder leaves for 30 days with
an unattended agent fleet that has no mechanism to prefer GTM work over comfortable polish.

## 2. Consensus risks (2+ members)

- **Billing is live on an unlicensed feed, contradicting the plan's own gate.** All five
  members flag `HOP_ENABLE_BILLING` ON (ops-runbook.md current-state table) while
  business-plan.md §3.1 gate ④ ("seats.aero written commercial terms — do not build a paid
  product on an unlicensed feed," R3.1) is unmet and gate ② (a proven Stripe purchase) is
  also admittedly unmet ("still owed: one real test purchase end-to-end").
- **The only acquisition surfaces in the plan are unshipped while unrelated work shipped.**
  R1.5 (verdict receipts) and R1.6 (newsletter) remain "Open (next up)" in the roadmap
  addendum; the last 48h instead shipped billing, admin, and content infra (members 1, 4, 5).
- **Vanity/internal-tooling work is consuming agent time with zero users to serve.** Admin
  Team view with agent avatars, glass-nav/PWA polish (members 1, 3, 4, 5) — violates the
  roadmap's own "flip before build" / "measure before optimize" principles.
- **Pricing and unit economics rest on zero data.** $49/yr, annual-only, anchored against
  competitors the plan itself calls "unearned," set with 1 user and $0 MRR (members 1, 3, 5).
- **The AI-sourced content pipeline can auto-publish stale/wrong numbers unattended.**
  content-plan.md itself requires verifying dynamic prices before showing them as bookable;
  a devaluation-era figure surviving a month unattended risks community trust (members 2, 5;
  echoed in member 1's kill list).
- **A 30-day unattended fleet has no mechanism to rank GTM above comfortable engineering.**
  Auto-merge is on; task queue already shows admin/content picked over R1.5/R1.6 (4, 5).

## 3. Contested points (no false consensus)

- **Is the 3-leg moat real?** Member 2: all three legs (balances, cpp, distribution) are
  rented or replicable — seats.aero is shipping a competing MCP integration, AwardWallet
  partnership "unlikely to land," cpp is "weekend-replicable" — moat language is aspirational.
  Members 1, 3, 4, 5 instead treat the *honesty architecture* (always-resolves, computed-not-
  generated, degradation notes) as the real asset and don't dispute the moat framing directly.
  Board should decide which claim goes in investor/public messaging.
- **Flip billing off, or just freeze its expansion?** Member 1: flip `HOP_ENABLE_BILLING` OFF
  now. Member 3: the dark/test state may be harmless; the real requirement is a hard stop on
  *going live-charge or public* until gates close, not necessarily an immediate flip.
- **Is "100 WAS in 90 days" meaningful, or vanity?** Member 5: WAS at n=1 cannot move and is
  structurally vanity pre-traction. The other four treat it as the plan's legitimate north
  star without contesting it.
- **Urgency of the MCP/agent-distribution bet.** Member 4 wants R2.1 (public /mcp page)
  shipped now in parallel. Members 2 and 3 agree it's the strongest strategic asset but frame
  it as a company-scale, longer-horizon bet, not a near-term revenue lever — disagreement is
  on sequencing/urgency, not the bet itself.

## 4. Kill list (board would vote for)

1. Admin Team view / agent-org animal avatars, and further admin-portal scope beyond what's
   shipped (members 1, 3, 4, 5).
2. Glass nav / PWA install polish (members 1, 4) — also risks CLAUDE.md's flat-editorial rule.
3. Content-pipeline expansion beyond the existing ~16-row seed table, until a staleness/
   verification gate exists (members 1, 2, 5).
4. Public `/pricing` page (member 1) — do not publicize a price the product doesn't yet
   support per §3.1's unmet gates.
5. Further MCP quota-tier / billing feature engineering until the one owed real Stripe test
   purchase actually lands (members 3, 5).
6. Any new OAuth/credential or monetization surface area for the duration of the absence
   (member 2).

## 5. Double-downs

- **Verdict receipts (R1.5)** — fully specced, engine-computed, flag-gated; the only
  mechanism that lets a stranger hit hop's core number without an account (all 5 members).
- **The honesty architecture itself** — always-resolves, computed-not-generated numbers,
  degradation notes; called "the best thing about the product" in the roadmap (members
  1, 2, 3, 5).
- **MCP / agent-native distribution (B2B2C)** — the one channel needing no audience-building
  and no founder judgment call, and the only scenario that gets past "profitable side
  business" (members 1, 2, 4).
- **Newsletter capture (R1.6)** — cheap, ~1 day, captures traffic that won't sign up
  (member 4).
- **Founder's own manual community seeding** (r/awardtravel, FlyerTalk) — the one GTM motion
  with zero agent substitute and a closing window (members 2, 4, 5).

## 6. Concrete 30-day amendment list (ordered by leverage)

1. Resolve the billing-gate contradiction: confirm Stripe keys are test-mode and whether
   seats.aero written terms (R3.1) exist; if not, hard-stop live charges/public pricing for
   the month. **[needs-founder]**
2. Ship R1.5 verdict receipts (`/v/[id]` + OG card), exactly as specced. **[agents-can-execute]**
3. Ship R1.6 newsletter capture. **[agents-can-execute]**
4. Reprioritize the Linear queue: Phase-1 funnel items (R1.5/R1.6) outrank billing/admin/
   content-pipeline items until 100 WAS is hit. **[agents-can-execute]**
5. Freeze admin-org/avatar UI, glass-nav/PWA polish, further content-pipeline scaling for the
   absence's duration. **[agents-can-execute]**
6. Add a "verified as of" staleness guard to the sweet-spots pipeline; auto-hide entries past
   a freshness window. **[agents-can-execute]**
7. Split `verdict_viewed` into demo vs. balance-personalized so activation data stays
   interpretable. **[agents-can-execute]**
8. Add a billing-gate-status line to ops-runbook.md cross-referencing §3.1's four gates
   (met/unmet). **[agents-can-execute]**
9. Alert `HOP_OWNER_EMAIL` on any Stripe webhook that fails to write a tier, so a silent
   paying-and-free customer isn't possible unmonitored. **[agents-can-execute]**
10. Fold agent-fleet compute cost (~$200/mo) into the B3 unit-economics panel so break-even
    isn't quietly 3-4x optimistic. **[agents-can-execute]**
11. Add Duffel look-to-book ratio monitoring to the same panel before MCP search volume grows
    unmetered. **[agents-can-execute]**
12. Ship R2.1 (public `/mcp` page + connector registry submissions) in parallel, not gated
    behind Phase 2. **[agents-can-execute]**
13. Stand up a weekly "did any stranger use hop this week" report as the lead item, ahead of
    any shipped-features list. **[agents-can-execute]**
14. Draft (don't send) the owner-action pack to zero-friction: seats.aero email, CJ/Impact
    applications, trademark brief, 10-15 community reply drafts. **[agents-can-execute]**
15. Personally send the seats.aero terms request and post/pre-approve the community replies
    before departure — no agent substitute exists. **[needs-founder]**

## 7. Questions for the founder (verbatim)

1. "You flipped HOP_ENABLE_BILLING to ON (ops-runbook.md, 2026-07-04) before either of your
   own two hard prerequisites in business-plan.md §3.1 were met — a proven Stripe purchase
   and seats.aero's written commercial terms for the feed the paid product runs on. Was that
   a deliberate call to accept the legal/attribution risk for a month with nobody watching,
   or did the gate get missed in the rush of the last 48 hours — and either way, do you want
   it off before you leave?"

2. "Your business plan (§3.1) hard-gates flipping HOP_ENABLE_BILLING on holding seats.aero's
   written commercial terms (R3.1) — which the roadmap shows as not even started — yet
   docs/ops-runbook.md's current-state table says Billing is already ON. Are the configured
   Stripe keys test-mode or live, and do you actually hold seats.aero's written permission?
   If not, flip billing off before you leave for the month."

3. "Before you leave: did you actually send/receive seats.aero's written commercial terms
   (R3.1), and does anyone other than you know the answer — because ops-runbook.md shows
   HOP_ENABLE_BILLING already ON while business-plan §3.1 lists those terms as a hard gate on
   that exact flag, and if the honest answer is 'not yet,' the fleet needs an explicit
   instruction (not silence) on whether real charges are allowed to happen while you're
   unreachable to answer a seats.aero cease-and-desist."

4. "Verdict receipts and the newsletter are the only two things in your own plan that let a
   stranger ever see hop's core number, and they're still open while Stripe billing went live
   in the same 48 hours in violation of your own seats.aero gate — will you personally
   reorder the queue to force receipts + newsletter + the public MCP page ahead of any further
   billing/admin/content work before you leave, and will you do the manual community replies
   yourself this week since no agent in the fleet can do that step for you?"

5. "Of the ~10 owner-gated actions sitting in Sec 7/Sec 6 (seats.aero terms, CJ/Impact,
   trademark, DKIM already done, 10-15 community replies, one B2B conversation) — which ones
   can you actually execute from wherever you'll be for the month, and if none, why is the
   agent team's default plan to keep building instead of drafting those to zero-friction for
   your return?"
