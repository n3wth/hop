# Desk provisioning — how to stand up a new autonomous desk

A **desk** is one of hop's scheduled agents (Jeffrey, Omar, Elizabeth, Bob — see
`docs/team/routines.md`). A **routine** is claude.ai's term for the scheduled cloud Claude Code
session that runs a desk on a cron. A **connector** is a third-party integration (Linear,
PostHog, AgentMail, Exa) a routine is allowed to call. This doc is the repeatable checklist for
wiring a new desk so it isn't done ad hoc each time.

## 1. Decide if the desk needs an inbox

Only give a desk an email inbox if it corresponds with people **outside the repo** (the founder,
partners, vendors) and needs a durable two-way channel — replies, approvals, negotiation. A desk
that only ever reports via git/PRs doesn't need one:

- **Needs an inbox**: Elizabeth (finance — emails Oliver for budget approvals, will negotiate
  with vendors), Omar (growth — will eventually reply to community members, press, and
  newsletter subscribers).
- **Doesn't need one**: Jeffrey (engineering autopilot) and Bob (weekly retro) report entirely
  through draft PRs. Giving them an inbox "for symmetry" would be a connector with no job to do —
  skip it.

## 2. If yes: AgentMail inbox + Cloudflare forward

**Naming convention**: `<deskname>-hop@agentmail.to` for the AgentMail inbox (e.g.
`finance-hop@agentmail.to`), forwarded from a clean `<deskname>@hop.flights` address so the
founder and any external party see a real hop domain, not `agentmail.to`.

1. Create the AgentMail inbox via the AgentMail MCP (`displayName` = "hop `<Desk name>`"). Do
   this once and reuse it — the desk's own weekly protocol must check its README for an existing
   address before creating a second inbox (this is how Elizabeth's protocol is written; see
   `docs/finance/README.md`).
2. Register a Cloudflare Email Routing forward from `<deskname>@hop.flights` to that inbox.
   **Status check before you copy this as "the proven pattern": as of 2026-07-06 this step has
   not actually been completed for the finance desk either** — `finance-hop@agentmail.to` exists,
   but the `finance@hop.flights` → inbox forward is still an open task (create the routing rule
   *after* the destination address verifies). There is no scripted/API call for this anywhere in
   the repo yet; the only documented inbound-email pattern here is the manual dashboard flow used
   for the other two Cloudflare Email Routing consumers
   (`cloudflare/balance-sync-worker/README.md`, `docs/ops-runbook.md` §"Balance sync"):
   - Cloudflare dashboard → the `hop.flights` zone → **Email Routing**.
   - **Add a destination address** for the AgentMail inbox
     (`<deskname>-hop@agentmail.to`). Cloudflare emails that address a verification link —
     **someone/something with access to the AgentMail inbox must click it** before the address
     can be used as a rule target. (This is almost certainly why the finance forward is still
     pending: nothing auto-clicks a verification email sent *to* an agent inbox.)
   - Once verified, add a **routing rule**: custom address `<deskname>@hop.flights` → **Action:
     Forward to** the verified destination address.
   - The same account also runs Email Routing via Worker catch-all for `support@` and
     `sync-*@hop.flights` (Workers that parse and relay inbound mail) — a plain address→address
     forward is a *different*, simpler rule type on the same feature; don't route it through a
     Worker.
   - If you're doing this via the Cloudflare API instead of the dashboard, the two calls are
     `POST /zones/{zone_id}/email/routing/addresses` (create + trigger verification) and, once
     verified, `POST /zones/{zone_id}/email/routing/rules` with a `forward` action — but no repo
     secret is currently scoped for this (the existing `CLOUDFLARE_API_TOKEN` is used for Worker
     deploys, not confirmed to carry the Email Routing permission), so treat the dashboard flow
     above as the checked, working path until that's verified too.
3. Record the address (and its verification status) in `docs/<deskname>/README.md`, following the
   shape of `docs/finance/README.md`'s "Identity" section — inbox address, reports-to, and what
   it mirrors to.

## 3. One standing Linear issue

Create a single Linear issue titled **"`<Desk name>` desk — `<purpose>`"** (e.g. "Finance desk —
approvals & budget", `N-351`) as the desk's internal coordination thread — where it posts
status/approval-asks as comments. This is separate from any external-facing email memo; it's the
in-house record of the same content. Reuse this one issue across every run rather than filing a
new one each time.

## 4. Add the routine to `docs/team/routines.md`

`docs/team/routines.md` is the source of truth — recreate a routine from it if claude.ai's
config is ever lost. Add a table row (name/avatar, trigger ID, cron in UTC, branch prefix,
connectors — least-privilege only, per the rule already stated in that file) and a prompt block
following the existing desks' shape (orient → do the one job → ship a PR).

## 5. Name + avatar on `/admin/team`

If the desk is user-facing enough to show up on the admin team page, add it to `lib/team.ts`
(`TEAM` array) with a name, role, `AnimalKind` avatar, cron, human-readable schedule, branch
prefix, and `reportsVia`.

---

## Applying this to Omar (growth desk)

Omar already has a name/avatar in `lib/team.ts` (fox) and a routine entry in
`docs/team/routines.md` (trigger ID `trig_017UarsY5ENomVMLdZpRZCwg`, Mon/Wed/Fri). He qualifies
for an inbox under step 1 — growth is the other desk with genuine external-facing correspondence
(community replies, press, and newsletter-subscriber-adjacent work once the newsletter ships, per
`docs/team/routines.md`'s Omar prompt block, item 3). What's left to give him one is written up as
an executable checklist in `docs/marketing/README.md`.

**Linear issue check**: this doc's brief assumed Omar already has an issue titled "Growth drafts
awaiting approval." A live check of the `hop` Linear project found no such issue — nothing
matching that title, or "Growth" generally, exists yet. So step 3 for Omar isn't a rename; it's a
fresh create, titled to match the pattern: **"Growth desk — drafts & approvals."**
