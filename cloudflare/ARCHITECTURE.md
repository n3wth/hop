# hop Cloudflare workers: architecture and hardening spec

Status: spec only. Nothing in this document was deployed and no secret was set while writing it.
Written 2026-09-02 from (a) the repo at `origin/main` 4402c44, (b) the deployed scripts,
bindings, deployment history and cron triggers read from the Cloudflare account `n3wth`
(`ac23513945eb49f73a89faf1be12384e`) over the read-only API, and (c) the Vercel-side routes the
workers talk to.

Owner: **Holly** (hop product support desk). Any change to these workers goes cloud agent PR,
then critical loop, then a second-family judge, then Holly approves, then Holly deploys. The
Cursor GitHub app being installed on the `n3wth` org is not a merge authority. See
`cloudflare/SAFE-PR-CHECKLIST.md`.

Scope boundary for every agent touching this: hop mail only. Never Oliver's personal
finances, Lunchmoney, `ebay@`, Marketplace, or `oliver@newth.ai`. The pipeline below currently
*terminates* in `oliver@newth.ai`; that is a documented fact and a hardening item, not a
license to read that inbox.

## 0. Inventory (verified 2026-09-02)

| Worker | Source of truth | Last deploy | compat date / flags | Bindings | Triggers | Observability |
|---|---|---|---|---|---|---|
| `hop-support-mail` | **not in this repo** (user code recovered from the deployed bundle, see Appendix A) | 2026-06-30 07:12Z, wrangler upload | 2026-06-30, `nodejs_compat` | `send_email` → `EMAIL` | Email Routing rule (which address: unverified, see §1) | logs on, 100% sampling |
| `hop-support-ingest` | **not in this repo** (recovered, Appendix B) | 2026-08-26 08:56Z, wrangler upload + `INGEST_SECRET` put + deploy inside two minutes, i.e. a manual laptop deploy | 2026-08-01, no flags | `send_email` → `EMAIL` (declared, unused), secret `INGEST_SECRET` | Email Routing rule (unverified) | **off** |
| `hop-valuations` | `cloudflare/valuations-worker/` | 2026-07-05 19:06Z deploy; secret re-put 2026-07-06 | 2024-11-01, no flags | D1 `DB` = `hop-valuations` (`d26989d0-…`), secret `HOP_VALUATION_SYNC_SECRET` | HTTP (`/observe`, `/valuations`) + cron `0 */6 * * *` | **off** |

Verified: the deployed `hop-valuations` bundle carries the same constants and the same
ISO-timestamp fix as `cloudflare/valuations-worker/src/index.ts`. No drift.

Also on the account and relevant: `workers.dev` subdomain `newth` (so `hop-valuations.newth.workers.dev`);
no Queues; KV namespaces are unrelated to hop; `balance-sync-worker` holds the zone catch-all for
`sync-*@hop.flights` per its README. `.github/workflows/deploy-valuations-worker.yml` is
`workflow_dispatch`-only (Actions billing broken since 2026-07-04), so **every worker deploy is a
manual `wrangler deploy` from someone's machine**.

What could not be verified from a session: the `hop.flights` Email Routing rules, catch-all,
destination addresses, and MX/TXT records. Both `CLOUDFLARE_API_TOKEN` values in `~/.env.keys`
and the expired wrangler OAuth grant return `Authentication error` on those endpoints (no Email
Routing or DNS read scope). Holly reads them in the dashboard: `hop.flights` zone → Email Routing.

## 1. Support mail flow, as deployed

```
customer ──► support@hop.flights (MX = Cloudflare Email Routing)
                │
                ├─ rule: support@ ──► EXACTLY ONE of:
                │     A) hop-support-mail     auto-reply + forward → oliver@newth.ai   (no ticket)
                │     B) hop-support-ingest   forward → oliver@newth.ai  +  POST /api/support-ingest
                │
                └─ catch-all ──► balance-sync-worker (sync-*@ only, drops the rest)

POST https://hop.flights/api/support-ingest  (Bearer INGEST_SECRET == Vercel HOP_SUPPORT_INGEST_SECRET)
   → lib/support-tickets.createSupportTicket  (Neon hop_support_tickets, upsert on message_id)
   → after(): lib/support-reply.draftSupportReply (AI gateway, general knowledge only)
              lib/email.sendOwnerNotification   (Resend → HOP_OWNER_EMAIL, default oliver@newth.ai)
   → /admin/support (owner session) → POST /api/admin/support/send → Resend from support@hop.flights
```

Two workers both claim `support@`. Only one Email Routing rule can target the address, so one of
them is dead weight. Which one is live changes what a customer experiences:

- If **A** is live: customer gets an instant auto-reply, but no ticket, no AI draft, no admin
  console row. The only record is the forward into Oliver's inbox.
- If **B** is live: customer gets **no acknowledgement at all** until a human replies from the
  console. Ticket, draft and owner notification exist. B was deployed 2026-08-26, eight weeks
  after A, and the Vercel route it calls is on `main`, so B is the probable live rule. Confirm
  before touching either (checklist item 1).

Ownership problem, stated plainly: every branch of this pipeline ends in `oliver@newth.ai`
(worker forward target, `HOP_OWNER_EMAIL` default). Holly's desk identity in the fleet roster
is `hop@n3wth.com`; no `support-hop@agentmail.to` inbox exists in `docs/` (only `finance-hop@`
and `growth-hop@`). Until the forward target and `HOP_OWNER_EMAIL` move, hop support mail is
landing in an inbox no hop agent may open. See §5, H1 and H6.

## 2. Per-worker specification

### 2.1 `hop-support-mail`

**Purpose.** Legacy acknowledgement worker: auto-reply to anything addressed to
`support@hop.flights`, then forward the original to Oliver. Everything else it receives is
forwarded without a reply.

**Trigger.** Email Routing `email(message, env, ctx)` handler. No HTTP, no cron.

**Behaviour (Appendix A).** Builds a MIME reply with `mimetext`: `From: hop <support@hop.flights>`,
`To: message.from`, `Subject: Re: <inbound subject>` (or "We've got your message"),
`In-Reply-To`/`References` = inbound `Message-ID`, fixed copy "Thanks for writing hop — a human
will reply within one business day." Then `message.forward('oliver@newth.ai')`.

**Idempotency.** None. Every delivery of the same message produces another auto-reply and
another forward. No dedupe on `Message-ID`, no store.

**Loop and abuse guards.** Only Cloudflare's own: `reply()` throws unless the inbound passed
DMARC, at most one reply per event, the reply recipient must equal `message.from`, the sender
domain must equal the receiving domain, and the inbound `References` header must have ≤100
entries. The worker itself does **not** check `Auto-Submitted`, `Precedence: bulk/list`,
`List-Id`, `X-Auto-Response-Suppress`, or `mailer-daemon`/`postmaster`/`noreply` senders, so
it will answer bounces, vacation responders and newsletters that pass DMARC.

**Failure modes.**

| Failure | Effect |
|---|---|
| `reply()` throws (DMARC fail, second reply, References >100) | caught, logged, forward still runs. Customer gets no ack. |
| `forward()` throws (destination not verified, transient) | **uncaught**. Handler rejects. Cloudflare's runtime docs do not specify whether the sending server is told to retry or the message is dropped, so treat it as *possibly lost*. Nothing else stores the message. |
| Inbound >25 MiB | rejected by Cloudflare before the worker runs. |
| Worker CPU/time limit | not a practical risk; no parsing is done. |

**Retries.** None in code. There is no queue and no store to retry from.

**What a "500" looks like to a customer.** They see nothing wrong. Either they get the ack and
the mail is silently gone (forward failed), or they get no ack and the mail arrived (reply
failed). The customer cannot tell the difference between "hop is slow" and "hop lost it."

**Verdict.** Superseded by `hop-support-ingest`. Retire it after confirming it holds no live
rule, or fold its acknowledgement (with loop guards) into the ingest worker as a single
worker. Do not leave two workers that both believe they own `support@`.

### 2.2 `hop-support-ingest`

**Purpose.** Turn an inbound `support@` email into a ticket row on the Vercel side while
keeping a copy in a human inbox.

**Trigger.** Email Routing `email()` handler. No HTTP, no cron. The `EMAIL` send binding is
declared but never used (no auto-reply).

**Behaviour (Appendix B).** Read `message.raw` fully into memory, parse with `postal-mime`
(text, else html, else empty; subject from parsed or header). `forward('oliver@newth.ai')` with
errors swallowed. Then `ctx.waitUntil(fetch(POST https://hop.flights/api/support-ingest))`
with the body below, `.catch(() => {})`.

**Contract to Vercel** (`app/api/support-ingest/route.ts`, must stay in sync by value):

```json
{ "from": "<envelope from>", "to": "<envelope to>", "subject": "...",
  "text": "<first 50,000 chars>", "messageId": "<Message-ID header or null>",
  "receivedAt": "<ISO now>" }
```

Auth: `Authorization: Bearer <INGEST_SECRET>`, compared constant-time on the Vercel side.
Vercel replies: `200 {ok:true}`; `503 unconfigured` when `HOP_SUPPORT_INGEST_SECRET` is unset;
`401` on mismatch; `429` from a per-instance in-memory token bucket (30 burst, ~60/min);
`400` on bad JSON or missing `from`. The route is written to never 500.

**Idempotency.** Two layers, and only one of them is real:

- *Delivery level:* none. A redelivered message forwards twice and POSTs twice.
- *Ticket level:* yes. `createSupportTicket` upserts on `message_id` with
  `ignoreDuplicates`, returns `null` for a duplicate, and the AI draft plus owner notification
  run only for a genuinely new id. **Exception:** a message with no `Message-ID` header stores
  `null`, and SQL nulls are distinct, so those duplicate freely.

**Failure modes.**

| Failure | Effect |
|---|---|
| `postal-mime` throws | swallowed; ticket filed with empty body but correct sender/subject. |
| `forward()` throws | swallowed; the human-inbox copy is lost, POST still runs. |
| POST fails: network, Vercel deploy blip, `503` (secret unset), `401` (rotation mismatch), `429` (one hot instance), `400` | swallowed, **no retry, no queue, no log** (observability is off). Ticket is lost. Only the forward copy remains. This is at-most-once delivery. |
| Both forward and POST fail | message is gone with no trace. |
| Large inbound | whole raw MIME is buffered (`arrayBuffer()`), then parsed. No `rawSize` guard. Multi-MB attachments risk the memory/CPU ceiling and an uncaught throw before the forward runs. |
| `waitUntil` budget | the POST has no timeout; a hung Vercel request holds the invocation until the platform cuts it (~30s). No effect on the customer, but the ticket is lost. |
| Ticket filed, `after()` step fails (AI gateway down, Resend key missing) | ticket exists with no draft and no owner email. Nothing tells Holly a ticket is waiting; the console is pull-only. |

**Retries.** None anywhere on the path. Cloudflare does not retry an `email()` invocation that
completed; the sending server only retries if the handler fails hard, which this handler never
does by design (every error is swallowed).

**What a "500" looks like to a customer.** Silence. There is no acknowledgement in this worker,
so a customer whose ticket was dropped and a customer whose ticket is sitting in the console
receive exactly the same thing: nothing. The first human-visible signal is Holly noticing an
unanswered forward in an inbox she may not read.

### 2.3 `hop-valuations`

**Purpose.** First-party cents-per-point pipeline (ADR 0005). Store cpp *observations* that the
Vercel engine already computed, aggregate them into one trusted number per loyalty program,
and serve that snapshot back. It is a statistics store, not a pricing engine.

**Triggers.**

| Trigger | Caller | Auth |
|---|---|---|
| `POST /observe` | `lib/valuation-telemetry.ts`, fire-and-forget from `assembleSearch`, 3s timeout, ≤50 samples | `Bearer HOP_VALUATION_SYNC_SECRET`, SHA-256 then constant-time compare |
| `GET /valuations` | `app/api/cron/valuation-sync/route.ts` (Vercel cron, daily), 10s timeout | same secret |
| cron `0 */6 * * *` | Cloudflare | n/a; runs `aggregate()` under `ctx.waitUntil` |

**Inputs** (`/observe` body): `{ samples: [{ programId: string, cpp: number > 0, cashCents?: number, miles?: number }] }`.
Rejected with `400` if not 1..50 samples, or if no sample survives validation. `programId` is
**not** checked against the program list; any non-empty string is stored.

**Outputs** (`/valuations`): `{ ok: true, valuations: { [programId]: { cpp, sampleSize, asOf } } }`.
The Vercel cron then drops any entry whose `programId` is unknown, whose cpp is outside
`clampCpp`, whose `sampleSize` is not a positive integer, or whose `asOf` is unparseable or in
the future, and upserts the rest into Neon `hop_valuation_overrides`. `lib/valuations-live.ts`
only *uses* an override once `sampleSize ≥ 20` and `asOf` is within 14 days; otherwise the
static `BASELINE_CPP` wins.

**Aggregation math** (`aggregate()`), per program with ≥20 observations in the last 45 days:
10% trimmed mean of cpp, clamped to `[0.3, 5.0]`, then damped so the snapshot moves at most
15% of the previous value per run, upserted with `sample_size` and `as_of = now`. Then prune
observations older than 45 days. Each program is try/caught independently; a D1 error on the
program list aborts the run silently.

**Idempotency.**

- `/observe` is **append-only and not idempotent**. A retried POST double-counts. That is
  acceptable today only because the telemetry client never retries. Adding client retries
  without an idempotency key would bias the mean toward whichever searches happened to be
  retried.
- The cron is idempotent in shape (upsert keyed on `program_id`) but not in value: running it
  twice in a window applies damping twice, so the snapshot moves faster than the 15% design
  limit. Cloudflare does not double-fire crons; a manual `--test-scheduled` during a live
  window would.

**Failure modes.**

| Failure | Effect |
|---|---|
| D1 unavailable on `/observe` | `500 internal error`; the telemetry client swallows it. Observations for that window are lost, which only delays a program reaching 20 samples. |
| D1 unavailable on `/valuations` | `500`; the Vercel cron records `worker-unreachable` and returns `200 applied:0`. Neon keeps the last snapshot; it stops being trusted 14 days after its `as_of`. |
| cron `aggregate()` throws early | swallowed; snapshot `as_of` ages. Same 14-day safety net. |
| Secret leaked | anyone can push observations. Bounded by clamp `[0.3, 5.0]` and damping, but 15% × 4 runs/day compounds to roughly 75% drift per day. Rotation is the only real fix (runbook: rotate worker and Vercel in the same sitting). |
| Junk `programId`s | stored for 45 days, aggregated, then dropped by the Vercel cron. Wastes rows, no product effect. |
| Secret unset on the worker | every call `401`. Vercel side reads that as unreachable. |

**Retries.** None on any leg, by design: the telemetry is fire-and-forget, the sync cron
degrades to a no-op summary, and the Cloudflare cron simply runs again in six hours.

**What a "500" looks like to a customer.** Nothing changes on screen. Live cpp only grounds the
`/ask` concierge prompt and the health sentinel's drift check; the verdict engine in
`lib/search.ts` does not read it. A dead worker means `/ask` quotes the static baseline, which
is the documented fallback.

## 3. Valuation: what the worker must never invent

The invariant from AGENTS.md ("every economic number is computed by `lib/*`, never generated")
extends to this worker, which sits *downstream* of `lib/cpp.ts`.

The worker may: store a cpp the Vercel engine computed, compute a trimmed mean, clamp, damp,
count samples, stamp a time, prune.

The worker must never:

- Produce a **price**, fare, tax, or cash amount. `cashCents` and `miles` are stored as
  provenance and are never returned. `/valuations` returns cpp, count and time only.
- Produce or imply a **refund**, credit, or any per-customer number. It has no user ids and
  must stay that way. No `userId` field in `observations`, ever.
- Fill a gap. No default cpp when a program has <20 samples; the response simply omits the
  program and Vercel falls back to `BASELINE_CPP`.
- Move a value faster than the damping allows, or outside `[0.3, 5.0]`, even under a manual
  "fix this program" request. Those are constants shared by value with `lib/valuations.ts`
  and change only through an ADR-level PR with a judge.
- Accept a cpp it did not receive from the authenticated Vercel caller. There is no admin
  write path and none should be added.
- Be read by an LLM step directly. The concierge sees numbers only after
  `lib/valuations-live.ts` applies the trust gate.

## 4. Change authority

Rule of thumb: a cloud agent may change what a customer will never see or pay for, and only
via a PR that a second-family judge reviewed. Holly approves anything a customer receives.
Oliver approves money.

| Change | Cloud agent (PR + judge, no deploy) | Holly must approve | Oliver must say yes |
|---|---|---|---|
| Docs, comments, tests for pure functions, `wrangler types`, TypeScript hygiene | yes | merge | |
| `wrangler.toml`: `compatibility_date`, `observability`, `nodejs_compat` | draft | merge and deploy | |
| Logging changes (never log bodies; sender address is customer PII) | draft | merge | |
| Retry / queue / DLQ mechanics for the ingest POST | draft | merge and deploy | |
| Loop guards, size guards, `setReject` conditions | draft | merge and deploy | |
| **Any string a customer can receive**: auto-reply copy, subject line, reply macros, AI draft system prompt | draft only | approve wording, then deploy | |
| Forward target, `HOP_OWNER_EMAIL`, any address change | propose | dashboard + Vercel env, with the verification click | |
| Email Routing rules, catch-all, destination verification | propose | dashboard | |
| Secrets: create, rotate, `wrangler secret put`, Vercel env | never | Holly, paired change, verified same sitting | |
| Deploying any worker | never | after judge | |
| Economic constants: `MIN_SAMPLES_TO_TRUST`, damping, clamp band, retention, cron cadence | propose with ADR amendment | judge + Holly | |
| `/observe` or `/valuations` contract shape | propose, keep `lib/*` in the same PR | judge + Holly | |
| D1 schema | migration file only, never applied | apply | |
| **Refunds** | no code path exists in the app; there is no worker or route that refunds | Holly asks | **yes required, every time** |
| Stripe: products, prices, webhooks, portal, `lib/stripe.ts`, `lib/billing.ts`, `app/api/webhooks/**` | hold-for-owner per ADR 0009 | | owner |
| Sending any email to a customer from an agent session | never | never auto-send; human sends from the console | |

Refunds deserve one more line. `lib/support-kb.ts` and `lib/support-context.ts` state hop
cannot refund tickets (airlines do); the only money hop takes is the Pro subscription via
Stripe, and the repo contains no refund call. So "refund" always means a human in the Stripe
dashboard, requested by Holly, authorised by Oliver. An agent that writes "we've refunded"
into any draft is inventing a number.

## 5. Hardening backlog (spec, prioritised)

Each item is a separate PR. None deploy themselves.

**H1. Establish which worker owns `support@`, retire the other.** Dashboard check by Holly;
record the answer at the top of this file. Delete the dead worker's Cloudflare script (owner
action) so the next agent cannot pick the wrong one. Blocks everything below.

**H2. Bring the support worker source into the repo.** New directory
`cloudflare/support-ingest-worker/` with `src/index.ts` (Appendix B as the starting point),
`wrangler.toml`, `package.json` pinning `postal-mime`, `npm run typecheck`, `README.md` on the
`valuations-worker` template. Without this, every deploy is from an unknown checkout and no
judge can review a diff.

**H3. Make ticket delivery at-least-once.** Preferred: a Cloudflare Queue between the email
handler and the POST. Producer enqueues `{from,to,subject,text,messageId,receivedAt}`;
consumer POSTs with `max_retries` and a dead-letter queue; Vercel's `message_id` upsert makes
retries safe. Minimum acceptable alternative: in-handler retry (3 attempts, backoff, 8s
timeout each) and, on final failure, `throw` so the sending server sees a failed delivery and
retries per its own schedule. The forward would then repeat on retry; a duplicate forward is
cheaper than a lost ticket. Either way the POST moves *before* the forward so a hard failure
happens before the human copy is sent.

**H4. One acknowledgement, with loop guards.** Add the auto-reply to the ingest worker (or keep
`hop-support-mail` as the only worker and add ingest to it; pick in H1) with: skip when
`Auto-Submitted` ≠ `no`, `Precedence` ∈ {bulk, list, junk}, `List-Id` present,
`X-Auto-Response-Suppress` present, or the sender local-part ∈ {mailer-daemon, postmaster,
noreply, no-reply, bounce}; skip when `message.from` equals any hop address; wrap `reply()` in
try/catch (already). Copy is Holly's to approve. Requires `nodejs_compat` for `mimetext`.

**H5. Size and parse guards.** Before parsing: if `message.rawSize > 5_000_000`, skip parsing,
still forward, still POST with an empty body and a `truncated: true` field (Vercel ignores
unknown fields today; add it to the contract in the same PR). Cap subject to 1,000 chars. When
only HTML is present, strip tags before sending it as `text`.

**H6. Move the human copy off `oliver@newth.ai`.** Two owner actions: (1) Email Routing forward
target → Holly's inbox, which requires a destination-address verification click that no agent
can perform; (2) Vercel `HOP_OWNER_EMAIL` → the same inbox. Until then the ingest worker is
routing customer mail into an inbox hop agents are forbidden to open, and Holly's console is
pull-only.

**H7. Observability on for both support workers and valuations.** `[observability] enabled = true`,
`head_sampling_rate = 1`, structured `console.log` JSON with `messageId`, `rawSize`, POST
status, and retry count. Never log body text. Sender address is customer PII; log it only
where already logged today and note the retention.

**H8. Valuations hygiene.** Bump `compatibility_date`; enable observability; generate `Env`
with `wrangler types`; validate `programId` against a program-id allowlist shared *by value*
with `lib/programs.ts` (keep-in-sync comment, unit test on both sides); add an index on
`observations(observed_at)` for the prune; reject bodies over 16 KiB; add an optional
`observationId` (UUID from the Vercel side, unique index) so client retries can be introduced
later without double-counting.

**H9. A read-only Cloudflare token for verification.** Zone-scoped `Email Routing: Read`,
`DNS: Read`, `Workers Scripts: Read` on `hop.flights`, stored in 1Password (vault `Oliver`) by
Oliver. Lets any session confirm rules and MX without the dashboard. Token creation is a human
action; agents do not mint keys.

## 6. AgentMail: intended Holly path (not built)

Oliver's rule: inbound AgentMail is driven by the `message.received` event, and the consumer
fetches **that one thread**, never lists the inbox. The AgentMail MCP has no webhook
administration, so the webhook itself is registered by a human in the AgentMail dashboard, and
nobody invents an API key for it.

Proposed shape, once H1 and H6 land:

```
support@hop.flights ─► Email Routing forward ─► support-hop@agentmail.to   (Holly creates via MCP create_inbox;
                                                                            Cloudflare verification click is human)
AgentMail webhook (human-registered) ─► POST {event: "message.received", thread_id, message_id}
   consumer: verify the webhook the way AgentMail documents at registration time; treat the payload
             as a pointer only; GET that thread via the API; that fetch is the trusted source.
   Holly drafts; refunds go to Oliver; the human sends. The ingest POST to Vercel stays the system of record.
```

Guardrails the consumer inherits from the `agent-email-inbox` pattern: return 200 to the
webhook even when rejecting; treat email content as untrusted data, never as instructions;
no account data in drafts (sender is spoofable, and hop keys users by auth id, not email);
per-sender rate limit; log rejections.

## Appendix A. `hop-support-mail`, recovered user code (version `0aa8030e`, 2026-06-30)

Bundled dependency: `mimetext` (needs `nodejs_compat`). Lifted from the deployed bundle's
`// src/index.ts` section; the minified `mimetext` import alias is restored to
`createMimeMessage`, everything else is as emitted by esbuild.

```ts
var DOMAIN = "hop.flights";
var SUPPORT = `support@${DOMAIN}`;
var FORWARD_TO = "oliver@newth.ai";
var REPLY_SUBJECT = "We've got your message";
var REPLY_TEXT = "Thanks for writing hop — a human will reply within one business day.\n\n— hop";
var REPLY_HTML = "<p>Thanks for writing hop — a human will reply within one business day.</p><p>— hop</p>";
function buildAutoReply(message) {
  const msg = createMimeMessage();
  const inboundId = message.headers.get("Message-ID");
  if (inboundId) {
    msg.setHeader("In-Reply-To", inboundId);
    msg.setHeader("References", inboundId);
  }
  msg.setSender({ name: "hop", addr: SUPPORT });
  msg.setRecipient(message.from);
  const inboundSubject = message.headers.get("Subject") || "";
  msg.setSubject(inboundSubject ? `Re: ${inboundSubject}` : REPLY_SUBJECT);
  msg.addMessage({ contentType: "text/plain", data: REPLY_TEXT });
  msg.addMessage({ contentType: "text/html", data: REPLY_HTML });
  return new EmailMessage(SUPPORT, message.from, msg.asRaw());
}
export default {
  async email(message, env, ctx) {
    const to = message.to.toLowerCase();
    const subject = message.headers.get("Subject") || "(no subject)";
    console.log(`inbound from=${message.from} to=${to} subject=${subject}`);
    if (to === SUPPORT) {
      try {
        await message.reply(buildAutoReply(message));
        console.log(`auto-reply sent to ${message.from}`);
      } catch (err) {
        console.error("auto-reply failed:", err);
      }
      await message.forward(FORWARD_TO);
      console.log(`forwarded to ${FORWARD_TO}`);
      return;
    }
    await message.forward(FORWARD_TO);
    console.log(`forwarded (non-support) to ${FORWARD_TO}`);
  }
};
```

## Appendix B. `hop-support-ingest`, recovered user code (version `1ebf71d6`, 2026-08-26)

Bundled dependency: `postal-mime`. The bundle ends with `//# sourceMappingURL=index.js.map`,
so a `dist/` with the original TypeScript exists on whichever machine ran the deploy.

```ts
export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).arrayBuffer();
    let text = "";
    let subject = message.headers.get("subject") ?? "";
    try {
      const parsed = await PostalMime.parse(raw);
      text = parsed.text ?? parsed.html ?? "";
      subject = parsed.subject ?? subject;
    } catch {}
    try {
      await message.forward("oliver@newth.ai");
    } catch {}
    ctx.waitUntil(
      fetch("https://hop.flights/api/support-ingest", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${env.INGEST_SECRET}`
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject,
          text: text.slice(0, 5e4),
          messageId: message.headers.get("message-id"),
          receivedAt: new Date().toISOString()
        })
      }).catch(() => {})
    );
  }
};
```

## Appendix C. Related files

- `cloudflare/valuations-worker/src/index.ts`, `wrangler.toml`, `README.md`, `migrations/0001_init.sql`
- `app/api/support-ingest/route.ts`, `lib/support-tickets.ts`, `lib/support-reply.ts`,
  `app/api/admin/support/send/route.ts`, `lib/email.ts` (`ownerAddress`, `supportFromAddress`)
- `lib/valuation-telemetry.ts`, `app/api/cron/valuation-sync/route.ts`,
  `lib/valuation-overrides.ts`, `lib/valuations-live.ts`
- `docs/decisions/0005-observed-point-valuation-sync.md`, `docs/decisions/0009-tiered-autonomous-merge.md`
- `docs/ops-runbook.md` §Valuation sync and §secret rotation; `docs/team/desk-provisioning.md` §2
