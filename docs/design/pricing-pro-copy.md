# hop Pro: pricing and checkout copy

Status: draft for second-family judge. Not deployed. Written 2026-09-01 against origin/main
(4402c44) and the live hop.flights/pricing page.

Every number below is sourced: `ALERT_LIMITS.free = 3`, `MCP_DAILY_LIMITS = 25 / 1000`,
`PRO_PRICE_YEARLY_USD = 49` (`lib/subscription.ts`, `lib/pricing.ts`). When pasting, keep
the template interpolations the components already use; do not hand-type a number.

Voice: `docs/design/copy-spec.md`. Terse, state the number, no hype. Places are named by
city, never airport code. Geist Mono is for codes only (error codes, Stripe IDs, PNRs).

## What Pro actually unlocks (ground truth)

| Free | Pro |
|---|---|
| Full search and the points-vs-cash verdict, no account needed | Same |
| 3 active route alerts (sign-in required) | Unlimited route alerts |
| 25 agent (MCP) calls a day, token-linked callers only | 1,000 agent calls a day |
| Weekly digest if subscribed to the newsletter | Same. Not gated by tier. See Flags. |

Tier is written only by the Stripe webhook (`app/api/webhooks/stripe/route.ts`). Statuses
`active`, `trialing`, `past_due` count as Pro while `current_period_end` is in the future.
Checkout and cancellation both happen on Stripe-hosted pages; hop never sees card data.

## 1. Pricing page (`app/pricing/page.tsx`, `components/BillingSection.tsx`)

### Head

- Title: `Pricing`
- Meta description (billing on): `Search and the verdict are free. Pro is $49 a year for
  unlimited route alerts and 1,000 agent calls a day.`
- Meta description (billing off): `Search and the verdict are free. There is no paid plan yet.`

### Hero

- Eyebrow: `Pricing`
- H1, signed out: `Search is free. Pro is $49 a year.`
- H1, signed in: `Your plan`
- Subline: `The verdict never goes behind a paywall. Pro lifts the 3-alert cap: hop re-runs
  your saved routes and emails you when points beat cash on your terms.`

Why: the live H1 (`3 watches are free.`) leads with the cap, which reads as a limit before
the visitor knows what a watch is. Lead with the two facts they came for.

### Free card

- Name: `Free`
- Price: `$0` with unit `forever`
- Rows:
  - `Full search and the verdict`
  - `3 active route alerts` and, signed in on Free, `(N of 3 used)`
  - `25 agent calls a day`
- CTA: `Search flights` (links to `/search`)

### Pro card

- Name: `Pro`
- Price: `$49` with unit `a year`
- Price note: `Early price. Stays $49 for as long as you keep the subscription.`
- Rows:
  - `Unlimited route alerts`
  - `1,000 agent calls a day`
  - Do not list the weekly digest here until it is gated. See Flags.
- Badge on the viewer's current plan: `Your plan`
- CTA, signed out: `Get Pro for $49 a year` (goes to sign-in, returns here)
- CTA, signed in on Free: `Upgrade to Pro for $49 a year`
- CTA, signed in on Pro: `Manage billing`
- Line under the CTA: `Billed once a year through Stripe. Cancel any time; Pro runs to the
  end of the year you paid for.`

Why the price note changed: `grandfathered for life` promises something undefined. The
honest version names the condition. If Oliver wants the stronger promise, it needs a policy
for lapsed subscribers first.

### Questions

- Q: `Is hop free to use?`
  A: `Yes. Search and the points-vs-cash verdict are free and need no account. Sign in and
  you also get 3 active route alerts.`

- Q: `What does Pro add?`
  A: `Unlimited route alerts and 1,000 agent calls a day. Nothing else moves behind the
  paywall.`

- Q: `What does Pro cost?`
  A: `$49 a year, billed once through Stripe. There is no monthly plan. It is an early price
  and stays $49 for as long as you keep the subscription.`

- Q: `What is a route alert?`
  A: `A route you ask hop to watch, in plain English: San Francisco to Tokyo in business,
  under 70,000 miles. hop re-runs the verdict on a schedule and emails you when points beat
  cash on your terms.`

- Q: `What is an agent call?`
  A: `hop's engine is also an MCP server, so an agent like Claude can price trips and check
  your balances. Each tool call counts toward the daily quota. Using the site yourself never
  counts.`

- Q: `How do I cancel?`
  A: `Account, then Manage billing. Stripe handles it. Pro runs to the end of the paid year,
  then your account returns to Free.`

- Q: `Something wrong with a charge?`
  A: `Email hop@n3wth.com from the address on your account. A person replies.`

Dropped from the live FAQ: `Why pay if search is free?` (its answer carried an unsourced
claim, see Flags) and the billing-off variant of the cost answer, which stays as is:
`Pro isn't live yet. Search and the verdict are free either way.`

## 2. Checkout

hop's checkout surface is the Pro card button plus the Stripe-hosted page. Strings hop
controls:

- Button: `Upgrade to Pro for $49 a year`
- Under the button: `You'll finish on Stripe. hop never sees your card.`
- Stripe product name (Stripe dashboard, Holly, not changed here): `hop Pro`
- Stripe product description: `Unlimited route alerts and 1,000 agent calls a day. Billed
  yearly.`
- Statement descriptor (22 chars max): `HOP.FLIGHTS PRO`

Stripe renders the card form, decline messages, and 3DS challenges on its page. hop only
sees the return.

## 3. Success (`app/account/page.tsx`, `#billing`)

Return URL is `/account?upgraded=1#billing`. The param is display only; the banner reads
the webhook-written tier.

- Tier already Pro: `You're on Pro. Alerts are unlimited from now on.`
- Tier still Free (webhook lag): `Payment received. Pro switches on within a minute.
  Refresh to check.`
- Status line, Pro: `Pro. Renews 14 September 2027.` (needs `current_period_end`; today the
  line is `You're on Pro.` with no date)
- Status line, Pro with cancellation scheduled: `Pro until 14 September 2027, then Free.`
- Status line, Free: `Free. 2 of 3 alerts used.`
- Links after the status line: `See plans` and, on Pro, `Manage billing`

## 4. Decline

- On Stripe's page: Stripe's own copy. Nothing to write.
- Back on hop after leaving checkout without paying (cancel URL is `/account#billing`,
  currently silent). If a `?checkout=left` param is added: `No charge was made. You're still
  on Free.`
- Renewal card declined (subscription `past_due`, Pro stays on during retries; not
  rendered today): `Your Pro renewal didn't go through. Update your card in Manage billing.
  Pro stays on while Stripe retries.`
- Retries exhausted (subscription deleted, tier Free): `Pro ended because the renewal
  didn't go through. Your alerts past 3 are paused. Get Pro again from Pricing.`
  Only ship the second sentence once downgrade behaviour for extra alerts is defined. See
  Flags.

## 5. 3DS or payment failure

- 3DS challenge and failure happen on Stripe's page. Stripe offers the retry.
- hop could not open checkout (`billingError=stripe`): `Couldn't open checkout. Nothing was
  charged. Try again in a minute.`
- Generic failed-payment state, if hop ever renders one: `Your bank didn't approve the
  payment. Nothing was charged. Try another card from Get Pro.`

## 6. Already subscribed

- Pricing page, Pro card: badge `Your plan`, CTA `Manage billing`
- Pricing page, signed-in subline replaces the pitch: `You're on Pro. Renews 14 September
  2027.`
- If a Pro user posts to checkout directly (no guard exists today, see Flags), redirect with
  `billingError=already-pro`: `You already have Pro. Use Manage billing to change your card
  or cancel.`

## 7. Cancellation

Cancellation runs in the Stripe billing portal and takes effect at period end.

- Account status after scheduling: `Pro until 14 September 2027, then Free. Change your mind
  before then from Manage billing.`
- After the period ends: `Pro ended 14 September 2027. You're on Free with 3 alerts.`
- Portal return with no customer on file (`billingError=no-customer`): `There's no
  subscription on this account. Get Pro from Pricing first.`
- Support email reply to a cancellation request (Holly): see the error table, row `Wants to
  cancel`.

## 8. Error table

Codes are set by `app/api/billing/checkout/route.ts` and `app/api/billing/portal/route.ts`
and rendered by `BILLING_ERROR_COPY` (pricing) and `BILLING_ERROR_NOTES` (account).
Support address is hop@n3wth.com. Refunds are Holly's call and need Oliver's yes; support
never promises one.

| State or code | Where it shows | User sees | Support says | Escalate |
|---|---|---|---|---|
| `unavailable` | Pricing, Account | `Billing isn't switched on yet.` | Pro isn't purchasable right now. Search and alerts up to 3 work as normal. We'll email when it opens. | No |
| `rate-limited` | Pricing, Account | `Too many tries. Wait a minute and try again.` | The button was pressed several times in a row. Wait a minute, try once. Nothing was charged. | No |
| `stripe` | Pricing, Account | `Couldn't open checkout. Nothing was charged. Try again in a minute.` | Stripe didn't answer. Nothing was charged. Try once more; if it fails twice, send us the time it happened. | Holly if repeated |
| `no-customer` | Account | `There's no subscription on this account. Get Pro from Pricing first.` | The signed-in Google account has never paid. Check the receipt email against the account email; they may have two Google accounts. | No |
| `bot` | Pricing, Account | `That didn't look like a real request. Try again from the page.` No route emits this code today; keep or delete, but don't write more for it. | Open hop.flights/pricing in a normal browser tab and press the button once. | No |
| `already-pro` (proposed) | Pricing | `You already have Pro. Use Manage billing to change your card or cancel.` | You're already on Pro. Manage billing handles cards and cancellation. | No |
| Unknown code | Account | `Couldn't reach billing. Try again.` | Try once more. If it repeats, tell us the exact text and time. | Holly |
| Alert cap, Free | Watch this route, Account | `You're at the 3-alert limit on Free. Pro lifts the cap.` with link `Get Pro` (keep the words `alert limit`: `WatchThisRoute.tsx` matches `/alert limit/i` and `email-subscription.test.ts` asserts `3-alert limit`) | Free holds 3 active alerts. Delete one in Account, or Pro removes the cap for $49 a year. | No |
| Agent quota, Free | MCP tool error | `Daily limit reached: 25 agent calls on Free. Resets daily. Pro allows 1,000 a day: hop.flights/pricing` (use `toLocaleString()`; the live string prints `1000`) | The quota counts tool calls from agents, not site use. It resets daily. | No |
| Agent quota, Pro | MCP tool error | `Daily limit reached: 1,000 agent calls. Resets daily.` | You've used the Pro quota for today. It resets daily. | No |
| Paid, still Free after a few minutes | Account banner | `Payment received. Pro switches on within a minute. Refresh to check.` | Your payment went through. Pro is being switched on. If it isn't on within an hour, reply and we'll set it by hand. | Holly: check Stripe customer by email, then `hop_subscriptions`; the daily `sync-stripe` cron also reconciles. No refund. |
| Card declined on Stripe | Stripe page | Stripe's message | Nothing was charged. Try another card, or ask your bank why it declined. Never send card details by email. | No |
| 3DS failed or abandoned | Stripe page | Stripe's message | Your bank's verification didn't complete. Nothing was charged. Try again; the bank app may need to approve it. | No |
| Charged twice | Stripe receipt | Not rendered | I can see two charges. I'm cancelling the duplicate now and have passed the refund to Holly. You'll hear back within 2 business days. | Holly cancels the duplicate subscription. Refund only with Oliver's yes. |
| Renewal failed, `past_due` | Not rendered yet | `Your Pro renewal didn't go through. Update your card in Manage billing.` | Your card didn't go through at renewal. Pro is still on. Update the card in Account, Manage billing, and Stripe retries. | No |
| Wants a refund | Email | n/a | I've passed this to Holly. You'll hear back within 2 business days. | Holly. Needs Oliver's yes before any refund. |
| Wants to cancel | Email | n/a | Account, then Manage billing, then Cancel. Pro runs to the end of the paid year. Want me to do it for you? Confirm from the account email. | Holly can cancel in Stripe on written confirmation. |
| Cancelled but charged | Email | n/a | Cancellation takes effect at the end of the paid year, so one more charge isn't expected. Send the receipt date and we'll check. | Holly checks Stripe. Refund only with Oliver's yes. |
| Asks about the price going up | Email | n/a | $49 stays your price for as long as you keep the subscription. | No |
| Can't find Manage billing | Account | n/a | Manage billing only appears on the Google account that paid. Check the email on the Stripe receipt. | No |

### Support knowledge base entries to add (`lib/support-kb.ts`)

The support bot has no entry for subscription billing today; its only refund entry is about
airline tickets.

- Title: `Cancel or change hop Pro`
  Body: `Go to Account, then Manage billing. Stripe opens; cancel or change your card
  there. Pro runs to the end of the paid year, then your account returns to Free with 3
  alerts. hop cannot cancel for you from chat; email hop@n3wth.com from your account
  address if the button is missing.`
- Title: `A charge from hop`
  Body: `hop Pro is $49 a year, billed once through Stripe. The receipt comes from Stripe.
  If a charge looks wrong, email hop@n3wth.com with the receipt date. A person replies;
  chat cannot issue refunds.`

Also: `public/llms.txt` describes the MCP tools but never states the daily quota. Add one
line: `Token-linked agents get 25 calls a day on Free and 1,000 on Pro.`

## 9. Flags: sentences that promise what Pro does not deliver

1. `Weekly best-redemption digest` on the Pro card and in the FAQ. The digest cron
   (`app/api/cron/newsletter-digest/route.ts`) sends to every confirmed newsletter
   subscriber and never reads tier. It is a free newsletter feature. Either gate it by tier
   or remove it from Pro. Removed in this draft.
2. `One missed drop usually costs more than a year of Pro.` (live FAQ). No data behind it.
   Removed.
3. `Early price — grandfathered for life` and `grandfathered` in the subline. `For life`
   is undefined for a lapsed subscriber. Rewritten as `stays $49 for as long as you keep the
   subscription`. If Oliver wants the stronger promise, it needs a lapsed-subscriber policy.
4. `hop re-checks your routes and emails you when the miles get cheaper.` Alerts fire when
   points beat cash on the user's terms, not on any price drop. Email is best-effort and
   gated by `STANDING_ORDERS_CRON_ENABLED` plus a configured email sender. Rewritten to
   `when points beat cash on your terms`. Confirm both flags are on in production before
   the page promises email.
5. `Unlimited alerts` is true in code (`Infinity`). No flag, but note the cron cost scales
   with it.
6. The alert-cap message says `Upgrade in Account`. Account has no upgrade button; Pricing
   does. Rewritten to link to Pricing.
7. `/mcp` says `Free 25 calls/day, Pro 1,000/day` and the tool error says `1000/day`. Same
   number, two spellings. Use `1,000` everywhere.

## Paste rules

- Numbers stay interpolated from `ALERT_LIMITS`, `MCP_DAILY_LIMITS`, `PRO_PRICE_YEARLY_USD`.
  Six test files assert on them; a hand-typed `3` or `49` fails `npm test`.
- Every price-bearing string keeps its billing-off variant (`isBillingEnabled()` branches
  in metadata, the FAQ cost answer, and the alert-cap error).
- FAQ strings feed both the visible list and the FAQPage JSON-LD. Keep answers
  self-contained.
- The type stack in the repo is Bricolage Grotesque, General Sans, Fraunces italic, and
  Geist Mono. Satoshi and Geist Sans are not loaded. The letter PDF spec uses Satoshi and
  Geist as briefed; adopting them on the site is a separate decision.

## 10. Not copy, but blocking

- `app/api/billing/checkout/route.ts` has no already-Pro guard. A Pro user who posts the
  form directly gets a second subscription and a second charge. Add a `getUserTier` check
  before creating the session and redirect with `billingError=already-pro`.
- `app/terms/page.tsx` has no subscription clause. Auto-renewal, cancellation, and refund
  terms are absent. California's auto-renewal law and Stripe's own requirements expect them
  on the page and at checkout. Legal copy, Oliver's call.
- Downgrade behaviour for a user holding more than 3 alerts is undefined. The cap is
  enforced only on create. Decide pause or keep before any copy promises either.
- `isBillingEnabled()` does not require `STRIPE_PRICE_ID_PRO_YEARLY`, but the yearly-only
  checkout fails closed without it. If that variable is missing in production, every
  upgrade lands on `billingError=stripe`. Verify it is set before the copy goes live.
- The Stripe billing portal must have cancellation enabled in its configuration for the
  cancellation copy to be true. Verify in the dashboard; not changed here.
- Support address: origin/main uses hop@n3wth.com; the stale local checkout still says
  support@hop.flights in the knowledge base. Pasting from origin/main is correct.
