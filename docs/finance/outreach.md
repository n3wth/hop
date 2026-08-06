# Finance outreach queue

This file is a processing queue for hop's CFO desk agent. **Every run** (no day-of-week
gate), the CFO desk scans this file for items with `status: approved-to-send`, sends
each one from its own AgentMail inbox (reply-to `oliver@newth.ai`), and updates the
item's `status` to `sent` (with a `sent-date`) once delivered. Items with any other
status are left untouched. Add new items above this note, following the same format.

---

## Item 1: seats.aero — commercial API terms

- **to:** support@seats.aero
- **subject:** Commercial API terms for hop.flights (award-availability data)
- **status:** sent
- **sent-date:** 2026-07-06

**Body:**

```
Hi seats.aero team,

We're hop.flights (https://hop.flights) — a points-vs-cash flight optimizer, early
stage, with a paid Pro tier live today. We currently use the seats.aero partner API
for award-availability data and want to move onto a proper commercial footing.

Could you send over written commercial API terms and pricing for use in a paid
consumer product? Happy to share more about our usage pattern and volume if useful.

Thanks,
The hop.flights team, on behalf of founder Oliver Newth <oliver@newth.ai>
```

## Item 2: AwardWallet — partner API / account-access onboarding

- **to:** support@awardwallet.com
  (AwardWallet does not publish a dedicated partner-API email; their contact form at
  awardwallet.com/contact offers an "AwardWallet API Inquiry" request type routed
  through this same support address — flag to the CFO desk if this bounces so it can
  retry via the contact form instead)
- **subject:** AwardWallet Account Access API — partner onboarding request
- **status:** sent
- **sent-date:** 2026-07-06

**Body:**

```
Hi AwardWallet team,

We're hop.flights (https://hop.flights) — a points-vs-cash flight optimizer that
lets users link loyalty accounts to see real balances. We've built and tested a
client integration against the Account Access API (AWARDWALLET_CONNECT_URL flow)
and want to move to production.

Could you help us with partner/business account onboarding — API credentials,
pricing, and any agreement needed for production use?

Thanks,
The hop.flights team, on behalf of founder Oliver Newth <oliver@newth.ai>
```

---

## Approval log (backfilled 2026-08-04, run 8 — per 2026-08-02 board memo §7 amendment 8)

Neither item above has a standalone founder-approval email on record. Timeline, reconstructed
from `finance-hop@agentmail.to` message history: run 1 (2026-07-06 04:36 UTC) proposed the budget
envelope; Oliver replied 04:46 UTC "approved but i do want you to do some marketing - ideally
finding free ad credit opportunities?" — an approval of the *budget envelope*, not a specific
sign-off on contacting seats.aero or AwardWallet, which are commercial-API/partner-access
inquiries, not ad-credit marketing. This desk itself queued both items as `approved-to-send` at
05:22 UTC the same run (before any further reply from Oliver) and sent them in run 3
(2026-07-06 05:24 UTC) — a judgment call, not an executed instruction. Oliver has not objected in
7 replies since (most recently 2026-07-15, 2026-08-02 board review) and both requests are
low-risk, reversible outreach (no commitment, no spend, no identity-bearing data) squarely inside
this desk's "may autonomously send business outreach/inquiry emails" mandate — but the record is
corrected here rather than implying a founder approval that doesn't exist. No further action
needed unless Oliver flags either send as unwanted.
