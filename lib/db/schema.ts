// Drizzle schema for hop's persistence — the user-scoped `hop_*` tables plus
// Better Auth's core tables (user/session/account/verification).
//
// `user_id` on the hop_* tables holds the Better Auth user.id (post-cutover;
// rows written before the Auth0 → Better Auth migration were keyed by the
// Auth0 sub and are orphaned — see docs/plans/auth-db-migration.md).
//
// numeric() stays in Drizzle's default STRING mode — the existing code already
// treats min_cpp/cpp/balance as `number | string` and guards with parseFloat.

import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  serial,
  boolean,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { Balance } from '@/lib/types'

// mode 'string' matches the Postgrest convention every hop_* caller already
// speaks: ISO strings in, timestamptz text out. (Drizzle's default 'date' mode
// throws `toISOString is not a function` when handed the strings callers pass.)
const tz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })

export const manualBalances = pgTable('hop_manual_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  program: text('program').notNull(),
  code: text('code'),
  balance: numeric('balance').notNull().default('0'),
  kind: text('kind'),
  updatedAt: tz('updated_at').defaultNow(),
})

// Pretty, opaque forwarding aliases for the balance-sync email rail
// (sync-<alias>@…). One per user, minted lazily on /account. The alias is the
// capability: random, unguessable, DB-resolved — replaces the long legacy
// HMAC address (which the ingest route still accepts).
export const syncAddresses = pgTable('hop_sync_addresses', {
  userId: text('user_id').primaryKey(),
  alias: text('alias').notNull().unique(),
  createdAt: tz('created_at').defaultNow(),
})

// Loyalty-program logins for credential-based auto-sync (the "hop signs in
// and reads your balance" rail). secret_enc holds the username+password as
// ONE AES-256-GCM blob (lib/credential-vault.ts) keyed by HOP_CREDENTIAL_KEY —
// never stored or logged in the clear, never sent to the client (username_mask
// is the display form). status is the honest per-connection sync state the
// account page surfaces: pending | ok | failed | unsupported.
export const programCredentials = pgTable(
  'hop_program_credentials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    program: text('program').notNull(),
    usernameMask: text('username_mask').notNull(),
    secretEnc: text('secret_enc').notNull(),
    status: text('status').notNull().default('pending'),
    lastError: text('last_error'),
    lastSyncedAt: tz('last_synced_at'),
    createdAt: tz('created_at').defaultNow(),
    updatedAt: tz('updated_at').defaultNow(),
  },
  (t) => [uniqueIndex('hop_program_credentials_user_program_idx').on(t.userId, t.program)],
)

// cachedBalances/lastSyncedAt/lastSyncOk back the AwardWallet snapshot cache
// (lib/accounts.ts#refreshAwCache/getCachedAwBalances) — getUserBalances()
// reads this cache instead of calling AwardWallet live on every request. A
// connected row with a null cache (pre-migration, or before the first
// bootstrap/refresh/cron tick) means "no synced snapshot yet", handled
// identically to "not connected" by getCachedAwBalances.
export const userAccounts = pgTable('hop_user_accounts', {
  userId: text('user_id').primaryKey(), // unique → pk
  awUserId: text('aw_user_id'),
  connectedAt: tz('connected_at'),
  updatedAt: tz('updated_at'),
  cachedBalances: jsonb('cached_balances').$type<Balance[]>(),
  lastSyncedAt: tz('last_synced_at'),
  lastSyncOk: boolean('last_sync_ok'),
})

export const userPrefs = pgTable('hop_user_prefs', {
  userId: text('user_id').primaryKey(),
  homeAirport: text('home_airport'),
  travelPrefs: jsonb('travel_prefs'),
  travelProfile: jsonb('travel_profile'),
  updatedAt: tz('updated_at'),
})

export const conversations = pgTable('hop_conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(),
  messages: jsonb('messages').notNull().default([]),
  updatedAt: tz('updated_at').defaultNow(),
})

// Rolling conversation MEMORY — one durable summary per user of the older turns
// that scroll off the live thread (hop_conversations caps at 40). Lets a resumed
// thread stay context-aware instead of amnesiac. Written fire-and-forget by the
// concierge when memory is enabled; read into the agent's system prompt. Holds
// NO economics (the engine owns every number) — just durable human context.
export const conversationSummary = pgTable('hop_conversation_summary', {
  userId: text('user_id').primaryKey(),
  summary: text('summary').notNull().default(''),
  updatedAt: tz('updated_at').defaultNow(),
})

// INFERRED facts — durable preferences hop noticed from how the traveler chats
// (cabin lean, who they travel with, places they gravitate to / away from). NOT
// stated facts: each lands as a confidence-scored PENDING suggestion the user
// confirms (→ promoted to their stated travel_profile) or dismisses (→ rejected,
// never re-suggested). Holds NO economics. Deduped per (user, kind, value).
export const inferredFacts = pgTable(
  'hop_inferred_facts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    value: text('value').notNull(),
    confidence: numeric('confidence').notNull().default('0'),
    status: text('status').notNull().default('pending'),
    createdAt: tz('created_at').defaultNow(),
    updatedAt: tz('updated_at').defaultNow(),
  },
  // Dedupe target for the upsert in lib/inferred-facts (onConflict user_id,kind,value).
  (t) => [uniqueIndex('hop_inferred_facts_user_kind_value_idx').on(t.userId, t.kind, t.value)],
)

// OBSERVED outcomes — hop's "learned from what you DO" log (M4). An append-only
// record of discrete, EXPLICIT user signals (today: a verdict card dismissed with
// "Not for me"). A pure aggregator (lib/memory-outcomes.ts) folds recurring
// subjects into human "hop observed …" rows + soft prompt context — it never
// changes a verdict or a stated fact. Holds NO economics (no cpp/price/miles
// column exists, by design): the subject is a place label, cabin is optional
// context. Extensible via `kind` for the later action outcomes (M6/M7).
export const memoryOutcomes = pgTable('hop_memory_outcomes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  subject: text('subject').notNull(),
  cabin: text('cabin'),
  createdAt: tz('created_at').defaultNow(),
})

export const bookings = pgTable('hop_bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  duffelOrderId: text('duffel_order_id'),
  bookingReference: text('booking_reference'),
  offerSnapshot: jsonb('offer_snapshot'),
  totalAmount: text('total_amount'),
  totalCurrency: text('total_currency'),
  status: text('status'),
  createdAt: tz('created_at').defaultNow(),
})

export const standingOrders = pgTable('hop_standing_orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  params: jsonb('params').notNull(),
  minCpp: numeric('min_cpp').notNull(),
  seats: integer('seats').notNull().default(1),
  eligiblePrograms: text('eligible_programs').array().notNull().default([]),
  minCabin: text('min_cabin'),
  lastNotifiedOffer: text('last_notified_offer'),
  // Delivery address for alert emails (lib/standing-orders selects/inserts it;
  // null → in-app only). Was a Supabase-era ALTER that never made it to schema.
  notifyEmail: text('notify_email'),
  active: boolean('active').notNull().default(true),
  createdAt: tz('created_at').defaultNow(),
})

export const standingOrderAlerts = pgTable('hop_standing_order_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  standingOrderId: uuid('standing_order_id')
    .notNull()
    .references(() => standingOrders.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  route: text('route').notNull(),
  pick: jsonb('pick').notNull(),
  cpp: numeric('cpp').notNull(),
  fingerprint: text('fingerprint').notNull(),
  delivered: boolean('delivered').notNull().default(false),
  seen: boolean('seen').notNull().default(false),
  createdAt: tz('created_at').defaultNow(),
})

// Idempotent delivery ledger (ADR 0003's deferred "outbox ledger" — reserve /
// mark / release semantics keyed on UNIQUE(user_id, kind, dedupe_key)). A row
// is reserved BEFORE a notification is attempted; the unique index makes a
// second reserve for the same (user, kind, dedupe_key) a no-op, so a crash
// between recording an alert and stamping its dedupe fingerprint can never
// double-send. `release()` deletes the row on a failed send so the next sweep
// can cleanly re-reserve and retry. Pure delivery bookkeeping — no economics,
// no household/pooling logic; `payload` is opaque delivery context only.
export const notificationOutbox = pgTable(
  'hop_notification_outbox',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id').notNull(),
    kind: text('kind').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    status: text('status').notNull().default('reserved'), // reserved | sent | failed | released
    payload: jsonb('payload'),
    createdAt: tz('created_at').defaultNow(),
    updatedAt: tz('updated_at').defaultNow(),
  },
  (t) => [
    uniqueIndex('hop_notification_outbox_user_kind_dedupe_idx').on(t.userId, t.kind, t.dedupeKey),
  ],
)

export const apiTokens = pgTable('hop_api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  lastFour: text('last_four').notNull(),
  name: text('name'),
  createdAt: tz('created_at').defaultNow(),
  lastUsedAt: tz('last_used_at'),
})

// MCP usage log (growth-hypothesis day-30 target: first metered B2B user) —
// one row per tool call through app/api/[transport]/route.ts. user_id is
// nullable (stateless/unlinked calls still count, keyed by IP upstream);
// token_id is nullable too and set-null on token revocation so a user's
// historical usage total survives rotating/revoking a token. No economics
// here, just a call log for metering/rate-limit visibility.
export const mcpUsage = pgTable(
  'hop_mcp_usage',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: text('user_id'),
    tokenId: uuid('token_id').references(() => apiTokens.id, { onDelete: 'set null' }),
    tool: text('tool').notNull(),
    createdAt: tz('created_at').defaultNow(),
  },
  (t) => [
    index('hop_mcp_usage_user_id_created_at_idx').on(t.userId, t.createdAt),
    // Backs mcpCallsToday's per-token day-quota count (lib/mcp-usage.ts) —
    // without this, a stateless-by-user but linked-by-token query scans the
    // whole table.
    index('hop_mcp_usage_token_id_created_at_idx').on(t.tokenId, t.createdAt),
  ],
)

export const travelHistory = pgTable('hop_travel_history', {
  userId: text('user_id').primaryKey(),
  connected: boolean('connected').notNull().default(false),
  googleRefreshToken: text('google_refresh_token'),
  googleEmail: text('google_email'),
  trips: jsonb('trips'),
  lastSyncedAt: tz('last_synced_at'),
  connectedAt: tz('connected_at'),
  updatedAt: tz('updated_at'),
})

// "Request expert booking" leads (roadmap §6 / N-290, Phase 1 — demand
// validation). One row per request. user_id is the Auth0 sub when signed in and
// NULL for a signed-out visitor (so it is intentionally nullable, unlike the
// other hop_* tables). trip is free-form JSON context (route/dates/notes/
// totalPoints). status defaults to 'new' for manual follow-up. See lib/escalation.ts.
export const escalations = pgTable('hop_escalations', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id'),
  email: text('email').notNull(),
  trip: jsonb('trip').notNull().default({}),
  status: text('status').notNull().default('new'),
  createdAt: tz('created_at').defaultNow(),
})

// Newsletter foundation (R1.6 capture + R2.3 weekly digest). email is stored
// lowercased and unique (dedup, same convention as hop_escalations' lead
// capture). userId is nullable-by-design — like hop_escalations, a signed-out
// visitor is a valid, expected row, not a scoping bug; the weekly digest
// re-resolves the user by email at send time rather than trusting a
// point-in-time userId, so an account created after signup still personalizes.
// confirmToken stays valid after use (a second click on the same email link
// is a no-op success, not a broken-link error) — re-confirming an
// already-confirmed row is harmless. unsubscribeToken is likewise permanent
// so the one-click footer link never expires. Both columns store a SHA-256
// HASH of the token, never the plaintext (lib/newsletter.ts, mirroring
// lib/api-tokens.ts's hashToken pattern) — a leaked row can't be replayed.
// unsubscribeToken's plaintext is itself derived deterministically from the
// email (HMAC, lib/newsletter.ts#deriveUnsubscribeToken) rather than stored
// randomly, so the weekly digest can always reproduce the same working link
// from just the email without ever persisting it in recoverable form.
// lastDigestSentAt is the per-subscriber idempotency guard for R2.3 (no
// generic outbox — hop_notification_outbox is keyed on a non-null user_id,
// which anonymous subscribers don't have).
export const newsletterSubscribers = pgTable('hop_newsletter_subscribers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id'),
  email: text('email').notNull(),
  confirmToken: text('confirm_token'),
  unsubscribeToken: text('unsubscribe_token').notNull(),
  confirmedAt: tz('confirmed_at'),
  unsubscribedAt: tz('unsubscribed_at'),
  lastDigestSentAt: tz('last_digest_sent_at'),
  createdAt: tz('created_at').defaultNow(),
}, (t) => [
  uniqueIndex('hop_newsletter_subscribers_email_idx').on(t.email),
  uniqueIndex('hop_newsletter_subscribers_confirm_token_idx').on(t.confirmToken),
  uniqueIndex('hop_newsletter_subscribers_unsubscribe_token_idx').on(t.unsubscribeToken),
])

// Owner-drafted sweet-spot entries awaiting review before they join the
// static seed table (lib/sweet-spots.ts). `seq` is a plain auto-increment used
// only to derive a stable numeric SweetSpot#id above the static table's small
// integers (see lib/sweet-spot-drafts.ts#toSweetSpot) — the uuid stays the
// real key. Facts (route/program/miles) are always human-entered; only `why`
// may be agent-drafted (lib/sweet-spot-drafts.ts#draftSweetSpotWhy).
export const sweetSpotDrafts = pgTable('hop_sweet_spot_drafts', {
  id: uuid('id').defaultRandom().primaryKey(),
  seq: serial('seq').notNull(),
  route: text('route').notNull(),
  program: text('program').notNull(),
  programSlug: text('program_slug').notNull(),
  metal: text('metal'),
  cabin: text('cabin').notNull(),
  milesOw: integer('miles_ow'),
  milesLabel: text('miles_label').notNull(),
  why: text('why').notNull().default(''),
  confidence: text('confidence').notNull().default('med'),
  status: text('status').notNull().default('pending_review'),
  createdBy: text('created_by').notNull(),
  createdAt: tz('created_at').defaultNow(),
  reviewedAt: tz('reviewed_at'),
})

// Live cents-per-point aggregates sourced from hop's own first-party cash vs
// award observations (Cloudflare valuations Worker), read/written by
// lib/valuation-overrides.ts. Mirrors the hop_valuation_overrides table added
// (lib/valuation-overrides.ts). program_id is the canonical
// program id from lib/programs; as_of is when the Worker last aggregated it.
export const valuationOverrides = pgTable('hop_valuation_overrides', {
  programId: text('program_id').primaryKey(),
  cpp: numeric('cpp').notNull(),
  sampleSize: integer('sample_size').notNull(),
  asOf: tz('as_of').notNull(),
  updatedAt: tz('updated_at').defaultNow(),
})

export const hopCustomers = pgTable('hop_customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  createdAt: tz('created_at').defaultNow().notNull(),
  updatedAt: tz('updated_at').defaultNow().notNull(),
})

export const hopSubscriptions = pgTable('hop_subscriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => hopCustomers.id, { onDelete: 'cascade' }),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripePriceId: text('stripe_price_id').notNull(),
  status: text('status').notNull(),
  currentPeriodStart: tz('current_period_start').notNull(),
  currentPeriodEnd: tz('current_period_end').notNull(),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  createdAt: tz('created_at').defaultNow().notNull(),
  updatedAt: tz('updated_at').defaultNow().notNull(),
})

// First-party affiliate outclick ledger — one row per /api/go/* redirect
// (kind 'card' = the credit-card CTA behind a points-winning verdict;
// kind 'cash' = the Kiwi cash-booking CTA, target = "AAA-BBB" route). The
// reconciliation baseline for affiliate revenue: CJ/Impact card commissions
// and Travelpayouts cash commissions are verified against these rows.
// Anonymous by design: NO user_id column (click telemetry, not user data).
// Written fire-and-forget by lib/outclicks.ts; counted by
// lib/business-digest.ts.
export const outclicks = pgTable(
  'hop_outclicks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clickedAt: tz('clicked_at').defaultNow(),
    kind: text('kind').notNull(),
    target: text('target').notNull(),
    url: text('url').notNull(),
    program: text('program'),
    userAgent: text('user_agent'),
  },
  // The weekly business digest counts kind='card' rows inside a time window.
  (t) => [index('hop_outclicks_kind_clicked_at_idx').on(t.kind, t.clickedAt)],
)

// ── Self-improvement loop (ADR 0007) — three SYSTEM-SCOPED tables ───────────
// No user_id column exists on any of them, by design: no user row, balance,
// or free text can ever land in this system.

// One liveness row per vercel.json cron job, upserted fire-and-forget by
// lib/cron-heartbeat.ts at the end of each authorized run. ok=false with
// note='disabled' = owner choice, not an outage — the sentinel's D1 detector
// only looks at last_run_at age.
export const cronHeartbeats = pgTable('hop_cron_heartbeats', {
  job: text('job').primaryKey(),
  lastRunAt: tz('last_run_at').defaultNow().notNull(),
  ok: boolean('ok').notNull().default(true),
  note: text('note'),
})

// Append-only degradation telemetry: one row per degraded source per live
// search (lib/degradation-telemetry.ts). route only ever holds a validated
// 'AAA-BBB' IATA pair or null; reason only ever holds a SANITIZED upstream
// failure string (printable ASCII, ≤120 chars — sanitizeReason) or null, never
// raw upstream text. Pruned to 30 days by the sentinel.
export const degradationEvents = pgTable(
  'hop_degradation_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),
    route: text('route'),
    reason: text('reason'),
    createdAt: tz('created_at').defaultNow(),
  },
  (t) => [index('hop_degradation_events_created_at_idx').on(t.createdAt)],
)

// Idempotent, fingerprinted findings (lib/improvement-findings.ts): the
// durable queue between detection and delivery. fingerprint (`kind:subject`)
// is UNIQUE — re-detection updates/reopens the row; filed_at makes filing
// at-most-once per episode; resolved_at drives the 7-day flap window.
export const improvementFindings = pgTable('hop_improvement_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  fingerprint: text('fingerprint').notNull().unique(),
  kind: text('kind').notNull(),
  severity: text('severity').notNull().default('p3'),
  title: text('title').notNull(),
  body: text('body').notNull(),
  status: text('status').notNull().default('open'),
  linearIssueId: text('linear_issue_id'),
  linearIdentifier: text('linear_identifier'),
  deliveredVia: text('delivered_via'),
  firstSeenAt: tz('first_seen_at').defaultNow().notNull(),
  lastSeenAt: tz('last_seen_at').defaultNow().notNull(),
  filedAt: tz('filed_at'),
  resolvedAt: tz('resolved_at'),
})

export const supportTickets = pgTable(
  'hop_support_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Upsert key for idempotent email ingestion (SQL NULLs stay distinct, so
    // manual tickets without a message id are unaffected by the unique index).
    messageId: text('message_id'),
    fromEmail: text('from_email').notNull(),
    toEmail: text('to_email'),
    subject: text('subject'),
    body: text('body'),
    status: text('status').notNull().default('new'),
    draftReply: text('draft_reply'),
    notifiedAt: tz('notified_at'),
    replyText: text('reply_text'),
    repliedAt: tz('replied_at'),
    receivedAt: tz('received_at'),
    createdAt: tz('created_at').defaultNow(),
  },
  (t) => [uniqueIndex('hop_support_tickets_message_id_idx').on(t.messageId)],
)

// Shareable verdict receipts (/v/[id] — docs/plans/2026-07-02-viral-
// differentiation.md, N-309). `snapshot` holds ONLY the engine-computed,
// balance-/prefs-free VerdictSnapshot (lib/shared-verdicts.ts) — never
// balances, identity, or a bookable action. `content_hash` (canonical params +
// UTC day) is the idempotency key: re-sharing the same trip on the same day
// upserts onto the same row instead of growing one per click. `created_by` is
// abuse-forensics only (Better Auth user id or null for a signed-out share)
// and is never selected into any render path. RLS enabled, no anon policies —
// service-role only, same posture as every other hop_* table (the DDL lives
// in the migration; this file never runs it).
export const sharedVerdicts = pgTable(
  'hop_shared_verdicts',
  {
    id: text('id').primaryKey(),
    contentHash: text('content_hash').notNull().unique(),
    createdBy: text('created_by'),
    params: jsonb('params').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: tz('created_at').defaultNow(),
  },
  (t) => [index('hop_shared_verdicts_created_by_idx').on(t.createdBy)],
)

// Email suppression list — addresses that bounced or complained, reported by
// the Resend webhook (app/api/webhooks/resend/route.ts). Keyed directly by
// email (not user_id): bounces/complaints arrive from Resend by raw address
// and may not map to an account. lib/email-suppressions.ts#isSuppressed
// consults this before any future outbound send (alerts, newsletter) to
// protect Resend deliverability/sender reputation.
export const emailSuppressions = pgTable('hop_email_suppressions', {
  email: text('email').primaryKey(),
  reason: text('reason').notNull(), // 'bounced' | 'complained'
  createdAt: tz('created_at').defaultNow(),
})

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// Better Auth passkey plugin — one row per registered WebAuthn credential.
// Column set matches @better-auth/passkey's shipped `Passkey` model — do not
// rename fields, the drizzle adapter matches by JS property name.
export const passkey = pgTable(
  'passkey',
  {
    id: text('id').primaryKey(),
    name: text('name'),
    publicKey: text('public_key').notNull(),
    userId: text('user_id').notNull().references(() => user.id),
    credentialID: text('credential_id').notNull(),
    counter: integer('counter').notNull(),
    deviceType: text('device_type').notNull(),
    backedUp: boolean('backed_up').notNull(),
    transports: text('transports'),
    createdAt: timestamp('created_at'),
    aaguid: text('aaguid'),
  },
  (t) => [
    index('passkey_user_id_idx').on(t.userId),
    uniqueIndex('passkey_credential_id_idx').on(t.credentialID),
  ],
)
