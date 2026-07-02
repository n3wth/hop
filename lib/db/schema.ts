// Drizzle schema for hop's persistence — the nine user-scoped `hop_*` tables.
//
// Phase A of the Auth0+Supabase → Better Auth + Neon + Drizzle migration
// (docs/plans/auth-db-migration.md): this mirrors the EXACT shapes the existing
// owner libs read/write (inferred from utils/supabase/admin.ts's typed schema),
// so the data layer can be re-pointed at Drizzle behind `withDb` with the same
// function signatures. `user_id` holds the Auth0 sub today; after the auth cutover
// it becomes the Better Auth user.id (FK added in the final phase).
//
// numeric() stays in Drizzle's default STRING mode — the existing code already
// treats min_cpp/cpp/balance as `number | string` and guards with parseFloat.

import {
  pgTable,
  text,
  uuid,
  numeric,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

const tz = (name: string) => timestamp(name, { withTimezone: true })

export const manualBalances = pgTable('hop_manual_balances', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  program: text('program').notNull(),
  code: text('code'),
  balance: numeric('balance').notNull().default('0'),
  kind: text('kind'),
  updatedAt: tz('updated_at').defaultNow(),
})

export const userAccounts = pgTable('hop_user_accounts', {
  userId: text('user_id').primaryKey(), // unique → pk
  awUserId: text('aw_user_id'),
  connectedAt: tz('connected_at'),
  updatedAt: tz('updated_at'),
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
export const inferredFacts = pgTable('hop_inferred_facts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  value: text('value').notNull(),
  confidence: numeric('confidence').notNull().default('0'),
  status: text('status').notNull().default('pending'),
  createdAt: tz('created_at').defaultNow(),
  updatedAt: tz('updated_at').defaultNow(),
})

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

// Premium subscription state — one row per user with a non-default tier
// (absent row = 'free'). Written ONLY by the Stripe webhook route via
// lib/subscription.ts#setUserTier (verified events; refs we minted).
// stripe_customer_id is the fallback-attribution key for lifecycle events that
// arrive without our metadata AND the stable re-link key across the auth
// migration (docs/plans/auth-db-migration.md). last_event_at guards against
// out-of-order webhook delivery. See drizzle/0005_subscriptions.sql.
export const subscriptions = pgTable(
  'hop_subscriptions',
  {
    userId: text('user_id').primaryKey(),
    tier: text('tier').notNull().default('free'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    lastEventAt: tz('last_event_at'),
    updatedAt: tz('updated_at').defaultNow(),
  },
  (t) => [index('hop_subscriptions_stripe_customer_id_idx').on(t.stripeCustomerId)],
)

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

export const apiTokens = pgTable('hop_api_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  lastFour: text('last_four').notNull(),
  name: text('name'),
  createdAt: tz('created_at').defaultNow(),
  lastUsedAt: tz('last_used_at'),
})

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

// Live cents-per-point aggregates sourced from hop's own first-party cash vs
// award observations (Cloudflare valuations Worker), read/written by
// lib/valuation-overrides.ts. Mirrors the hop_valuation_overrides table added
// to utils/supabase/admin.ts's typed schema. program_id is the canonical
// program id from lib/programs; as_of is when the Worker last aggregated it.
export const valuationOverrides = pgTable('hop_valuation_overrides', {
  programId: text('program_id').primaryKey(),
  cpp: numeric('cpp').notNull(),
  sampleSize: integer('sample_size').notNull(),
  asOf: tz('as_of').notNull(),
  updatedAt: tz('updated_at').defaultNow(),
})

// First-party affiliate outclick ledger — one row per /api/go/* redirect
// (kind 'card' = the credit-card CTA behind a points-winning verdict). The
// conversion baseline for the coming CJ/Impact partnership: today's applyUrls
// are placeholder landing pages, so this table is the only first-party click
// record. Anonymous by design: NO user_id column (click telemetry, not user
// data). Written fire-and-forget by lib/outclicks.ts; counted by
// lib/business-digest.ts. See drizzle/0006_outclicks.sql.
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
