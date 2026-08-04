# Growth desk (Omar)

Omar is hop's growth desk (`docs/team/routines.md` — trigger `trig_017UarsY5ENomVMLdZpRZCwg`,
Mon/Wed/Fri, avatar: fox, `lib/team.ts`). This file tracks his identity and the checklist for
giving him an AgentMail inbox, following the pattern in `docs/team/desk-provisioning.md`
(read that first for the terms used below — "desk", "routine", "connector", "Email Routing").

## Why he needs an inbox

Omar is one of two desks (with Elizabeth/finance) that corresponds with people outside the repo:
community replies, press, and newsletter-subscriber-adjacent work once the newsletter ships
(`docs/team/routines.md`'s Omar prompt, item 3). Jeffrey and Bob report purely via PRs and
deliberately don't get one.

## Inbox provisioning checklist (not yet executed — needs the AgentMail MCP connector)

This session doesn't have the AgentMail MCP available (it only exists in claude.ai routine
contexts), so these steps are written for Omar's own next scheduled run to execute, once the
connector below is added:

1. **Claude.ai-side change needed first, outside this repo**: add the **AgentMail** connector to
   Omar's routine (trigger `trig_017UarsY5ENomVMLdZpRZCwg`, "Growth desk" in
   `docs/team/routines.md`'s table). This is a claude.ai routine-config change, not a repo change
   — flag it to whoever administers routines at claude.ai/code/routines. Per the least-privilege
   rule in `docs/agent-playbook.md`, add only AgentMail — don't let the platform's
   auto-attach-all-connectors default hand him anything beyond his existing PostHog + Linear +
   the new AgentMail.
2. Once the connector exists, on Omar's next run: create the AgentMail inbox
   `growth-hop@agentmail.to` (`displayName` "hop Growth Desk") — check this file first to avoid
   creating a second one if a future run already did.
3. Register a Cloudflare Email Routing forward from `growth@hop.flights` to
   `growth-hop@agentmail.to`, following `docs/team/desk-provisioning.md` §2's dashboard steps
   (add + verify the destination address, then add the forwarding rule). Note from that doc: the
   *same* step for the finance desk (`finance@hop.flights`) is still pending as of 2026-07-06 —
   expect the destination-address verification email to be the sticking point, since nothing
   auto-clicks a verification link sent to an agent inbox. Whoever provisions this may need to
   manually open that email and click verify.
4. Record the result here (address, verification status, date) once done, in the same shape as
   `docs/finance/README.md`'s "Identity" section.

## Linear coordination issue

The brief for this doc assumed Omar already had a standing issue titled "Growth drafts awaiting
approval." A check of the `hop` Linear project (2026-07-06) found no issue with that title, or
any "Growth"-titled issue. So there's nothing to rename — the next step is to **create** one,
titled **"Growth desk — drafts & approvals"** to match the finance desk's pattern (`N-351`,
"Finance desk — approvals & budget"), as Omar's internal status/coordination thread separate from
any external email memo.

## Owned files

- `drafts/` — ready-to-paste drafts for external channels (Reddit/Product Hunt/HN/X) Omar has no
  posting credentials for, named `<YYYY-MM-DD>-<slug>.md` (`docs/team/routines.md`'s Omar prompt,
  item 3).
- `funnel-log.md` — the 6-line funnel trend note Omar appends every run (item 4 of his prompt).
