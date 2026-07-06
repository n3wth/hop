# Finance desk

The hop CFO function — an agent-run finance desk that tracks budget, burn, and startup-credit
opportunities, and asks Oliver for decisions by email. It never spends money, commits to
anything, or submits an external application on its own; every commitment goes to Oliver for
emailed approval first.

## Identity

- **Inbox**: `finance-hop@agentmail.to` (AgentMail), created 2026-07-06, `displayName` "hop
  Finance Desk". Reused across runs — do not create a second inbox; check here first.
- **Reports to**: oliver@newth.ai (plain-text weekly memo, subject `hop finance — week of
  <date>`).
- **Mirrors to**: Linear issue "Finance desk — approvals & budget" in the `hop` project
  (team `n3wth`) — same memo posted as a comment each run.

## Files

- `budget.md` — the single source of truth for the agreed budget envelope. Updated from
  Oliver's email replies (approvals/rejections/counters), never from assumption.
- `ledger.md` — a 5-line weekly financial note (date, MRR estimate, known burn, notable
  changes). Figures come from the repo's own signals (business plan, `lib/unit-economics.ts`,
  ops runbook) or are marked `unknown` — never invented.
- `opportunities.md` — tracked startup-credit / discount programs: eligibility, value, effort,
  deadline, and drafted (not submitted) application answers. Rejected or already-pitched
  opportunities are marked so they aren't re-pitched.
- `outreach.md` — the queue for owner-approved external outreach (e.g. seats.aero commercial
  terms, AwardWallet partner onboarding). Items only move to `status: sent` once Oliver has
  marked them `approved-to-send` in a prior reply — this desk never adds an item as
  pre-approved. Processed **Tuesday-only** (see the file's own header note); other days, leave
  it untouched rather than silently skipping it forever.

## Weekly run protocol

1. Read replies in the inbox since last run; update `budget.md`.
2. Skim the ledger inputs, append a note to `ledger.md`.
3. Spend ~20 min searching for 1-2 new credit/discount opportunities; update
   `opportunities.md` (skip anything already tracked or rejected there).
4. **On Tuesday runs only**: scan `outreach.md` for items with `status: approved-to-send`,
   send each from this inbox, and update its `status` to `sent` (with a `sent-date`). On any
   other day, leave the file untouched — do not send and do not mark items as processed.
5. Send one consolidated memo to oliver@newth.ai and mirror it to the Linear issue.
6. Commit `docs/finance/` on a `finance/<date>` branch, push, open a draft PR.
