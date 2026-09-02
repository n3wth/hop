# Safe PR checklist: hop Cloudflare workers

Applies to any change under `cloudflare/` or to the deployed `hop-support-mail`,
`hop-support-ingest`, `hop-valuations` scripts. Companion to `cloudflare/ARCHITECTURE.md`.
Owner: Holly. This checklist adds to ADR 0009; it never relaxes it.

The path is fixed: **cloud agent PR → critical loop → second-family judge → Holly approves →
Holly deploys.** The Cursor GitHub app on the `n3wth` org can open and review PRs; it cannot
stand in for the judge and it does not merge.

## 0. Stop conditions (do not open the PR)

- The diff would send, refund, charge, or promise anything to a customer without Holly.
- The diff contains a secret, a token, a `wrangler secret put`, or a Vercel env value.
- The diff changes an address (forward target, `From`, owner email) or an Email Routing rule.
- You cannot say which worker currently owns `support@hop.flights` (ARCHITECTURE §1, H1).
- The change touches `oliver@newth.ai`, Lunchmoney, `ebay@`, or Marketplace in any way.
- The change would make the worker generate a price, cpp, refund, or any per-customer number.

## 1. Before writing code

- [ ] Read `cloudflare/ARCHITECTURE.md` §2 for the worker and §4 for who approves this class of change.
- [ ] One worker, one concern, one PR. Contract changes ship with the matching `lib/*` change in the same PR.
- [ ] Fresh worktree off `origin/main`, branch `holly/<worker>-<change>`; `git status` clean of unrelated WIP.
- [ ] If the worker's source is not in the repo yet (both support workers today), the first PR is H2: bring the source in unchanged, then change it in a second PR.

## 2. In the diff

- [ ] `wrangler.toml` diffs are deliberate: `name` unchanged, `compatibility_date` only moves forward, `observability` stays enabled once on, no new bindings without a sentence in the PR body.
- [ ] No hand-written `Env` when `wrangler types` can generate it; no `any` on `env` or handlers.
- [ ] Every promise is awaited, returned, or passed to `ctx.waitUntil`; `ctx` is never destructured.
- [ ] Secrets are compared constant-time; nothing secret is logged; no email body text is logged.
- [ ] Email handlers: size guard before parsing; `reply()` inside try/catch; loop guards present if the worker replies (ARCHITECTURE H4).
- [ ] Ingest POST: idempotency key (`messageId`) is sent; failure path is explicit (retry, queue, or throw) and documented in the PR body as at-most-once or at-least-once.
- [ ] Valuations: constants shared with `lib/valuations.ts` and `lib/valuations-live.ts` unchanged, or changed on both sides with the keep-in-sync comment updated and tests on both sides.
- [ ] Any customer-visible string is quoted verbatim in the PR body under a heading "Copy for Holly".

## 3. Verification the author runs

```bash
cd cloudflare/<worker>
npm ci
npm run typecheck
npx wrangler deploy --dry-run --outdir /tmp/wrangler-dry   # bundles, no upload
npx vitest run                                              # pure functions: parse, guards, aggregate math
```

- [ ] Dry-run bundle diffed against the previous one for surprise dependencies.
- [ ] For email workers: `npx wrangler dev` plus a local `curl` to the dev email endpoint with a saved `.eml` fixture; confirm forward and POST calls in the log.
- [ ] For valuations: unit tests cover trimmed mean, clamp, damping bounds, cutoff comparison as ISO strings, and the 20-sample gate.
- [ ] `npm run check` at the repo root still passes when any `lib/*` file changed.

## 4. Critical loop (author, before requesting the judge)

Answer each in the PR body, one line each:

- [ ] What is lost if the Vercel side returns 503 during a deploy?
- [ ] What happens on redelivery of the same message?
- [ ] What does the customer see if this worker throws on the first line?
- [ ] Which address does a copy of the customer's mail land in after this change?
- [ ] Which number could this worker be tricked into producing, and what bounds it?

## 5. Second-family judge

- [ ] Reviewer is a different model family from the author (author Claude → judge non-Claude, and vice versa).
- [ ] Judge reads the full worker file, not the diff, and ARCHITECTURE §2 for that worker.
- [ ] Judge posts findings as P1/P2/P3 on the PR. Any P1 blocks. "Looks fine" without the critical-loop answers checked is not a review.
- [ ] Judge confirms none of §0 applies.

## 6. Merge (Holly)

- [ ] CI green on the head commit, or, while Actions billing is broken, the author's `typecheck` and dry-run output pasted in the PR.
- [ ] Judge findings resolved or explicitly accepted by Holly.
- [ ] ADR 0009 hold list unaffected: no `lib/stripe.ts`, `lib/billing.ts`, `app/api/webhooks/**`, `lib/env.ts` flags, `.github/workflows/**`, `package.json` at the repo root, displayed prices.
- [ ] Merge-commit method; branch deleted; Linear issue updated.
- [ ] Never auto-merged. The merge sheriff must treat `cloudflare/**` as hold-for-owner.

## 7. Deploy (Holly only, never an agent)

```bash
cd cloudflare/<worker>
npx wrangler deploy                       # from the merged main checkout, not a laptop branch
npx wrangler deployments list | head -5   # note the new version id in the PR
npx wrangler tail --format pretty         # keep open through the smoke test
```

- [ ] Secrets untouched unless the PR body says "rotation": then worker and Vercel change in the same sitting and are verified end-to-end before leaving (`docs/ops-runbook.md`).
- [ ] Smoke test, support workers: send one message from an external address to `support@hop.flights`; confirm the forward arrived, the `hop_support_tickets` row exists, the `/admin/support` row shows a draft, and (if the worker replies) exactly one acknowledgement came back threaded on the original `Message-ID`.
- [ ] Smoke test, valuations: `GET /valuations` with the bearer returns `ok:true` and the same programs as before; do **not** POST synthetic observations to production. After the next 6h cron, `as_of` advanced.
- [ ] Rollback ready: `npx wrangler rollback <previous version id>`; state the id in the PR before deploying.
- [ ] Post-deploy line in `docs/autonomy-log.md` or the Linear issue: version id, who deployed, smoke result.

## 8. After

- [ ] If the change taught something non-obvious, add a `docs/solutions/` entry.
- [ ] Update `cloudflare/ARCHITECTURE.md` §0 (deploy date, version) and strike the finished H-item in §5.
