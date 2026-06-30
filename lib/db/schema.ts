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
