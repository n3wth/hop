import { createClient } from '@supabase/supabase-js'

// Postgres jsonb columns surface as this in generated Supabase types.
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// Minimal schema for the tables hop owns. Enough to give the query builder real
// row types (otherwise it infers `never`). Extend as we add tables.
interface HopDatabase {
  public: {
    Tables: {
      hop_travel_history: {
        // One row per user. The Gmail travel-history seam (lib/travel-history.ts).
        // PRIVACY: we store ONLY normalized trip facts (trips jsonb of PastTrip[])
        // — never raw email bodies. google_refresh_token is the long-lived token
        // we use to re-read confirmation emails on demand; clearing the row
        // (disconnect) revokes our access locally. Scoped by Auth0 user_id.
        Row: {
          user_id: string
          connected: boolean
          google_refresh_token: string | null
          google_email: string | null
          trips: Json | null
          last_synced_at: string | null
          connected_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          connected?: boolean
          google_refresh_token?: string | null
          google_email?: string | null
          trips?: Json | null
          last_synced_at?: string | null
          connected_at?: string | null
          updated_at?: string | null
        }
        Update: {
          connected?: boolean
          google_refresh_token?: string | null
          google_email?: string | null
          trips?: Json | null
          last_synced_at?: string | null
          connected_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }

      hop_user_prefs: {
        // travel_prefs: jsonb of the user's natural-language flight constraints
        // (lib/prefs-model.TravelPrefs). See ALTER TABLE in lib/prefs.ts notes.
        Row: {
          user_id: string
          home_airport: string | null
          travel_prefs: Json | null
          // travel_profile: jsonb of the user's DURABLE personal travel facts
          // (lib/travel-profile-model.TravelProfile). See ALTER TABLE in
          // lib/travel-profile.ts notes.
          travel_profile: Json | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          home_airport?: string | null
          travel_prefs?: Json | null
          travel_profile?: Json | null
          updated_at?: string | null
        }
        Update: {
          home_airport?: string | null
          travel_prefs?: Json | null
          travel_profile?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_conversations: {
        // One persisted concierge thread per user (latest wins). messages is a
        // jsonb array of { role, content }. See CREATE TABLE in
        // lib/conversations.ts notes.
        Row: {
          id: string
          user_id: string
          messages: Json | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          messages?: Json | null
          updated_at?: string | null
        }
        Update: {
          messages?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_conversation_summary: {
        // One rolling durable summary per user of the older concierge turns that
        // scrolled off the live thread. See CREATE TABLE in lib/conversation-memory.ts.
        Row: {
          user_id: string
          summary: string
          updated_at: string | null
        }
        Insert: {
          user_id: string
          summary?: string
          updated_at?: string | null
        }
        Update: {
          summary?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_inferred_facts: {
        // Confidence-scored preferences hop NOTICED (pending until the user
        // confirms/dismisses). See CREATE TABLE in lib/inferred-facts.ts.
        Row: {
          id: string
          user_id: string
          kind: string
          value: string
          confidence: number | string
          status: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          value: string
          confidence?: number | string
          status?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          kind?: string
          value?: string
          confidence?: number | string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_memory_outcomes: {
        // Append-only log of discrete OBSERVED signals (today: a verdict card the
        // user dismissed with "Not for me"). A pure aggregator derives human
        // "hop observed …" rows + soft prompt context. Holds NO economics — subject
        // is a place label, cabin is optional context. See lib/memory-outcomes.ts.
        Row: {
          id: string
          user_id: string
          kind: string
          subject: string
          cabin: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind: string
          subject: string
          cabin?: string | null
          created_at?: string | null
        }
        Update: {
          kind?: string
          subject?: string
          cabin?: string | null
        }
        Relationships: []
      }
      hop_user_accounts: {
        Row: {
          user_id: string
          aw_user_id: string | null
          connected_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          aw_user_id?: string | null
          connected_at?: string | null
          updated_at?: string | null
        }
        Update: {
          aw_user_id?: string | null
          connected_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_manual_balances: {
        Row: {
          id: string
          user_id: string
          program: string
          code: string | null
          balance: number
          kind: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          program: string
          code?: string | null
          balance?: number
          kind?: string | null
          updated_at?: string | null
        }
        Update: {
          program?: string
          code?: string | null
          balance?: number
          kind?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_bookings: {
        Row: {
          id: string
          user_id: string
          duffel_order_id: string | null
          booking_reference: string | null
          offer_snapshot: Record<string, unknown> | null
          total_amount: string | null
          total_currency: string | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          duffel_order_id?: string | null
          booking_reference?: string | null
          offer_snapshot?: Record<string, unknown> | null
          total_amount?: string | null
          total_currency?: string | null
          status?: string | null
          created_at?: string | null
        }
        Update: {
          duffel_order_id?: string | null
          booking_reference?: string | null
          offer_snapshot?: Record<string, unknown> | null
          total_amount?: string | null
          total_currency?: string | null
          status?: string | null
        }
        Relationships: []
      }
      hop_standing_orders: {
        // One watch per row. params is jsonb of SearchParams (lib/types).
        // eligible_programs is a text[] (empty = any program). notify_email is
        // the destination for proactive alert delivery (seeded from the Auth0
        // session at create time; null = in-app only). See CREATE TABLE / ALTER
        // TABLE in lib/standing-orders.ts notes.
        Row: {
          id: string
          user_id: string
          params: Json | null
          min_cpp: number | string
          seats: number
          eligible_programs: string[] | null
          min_cabin: string | null
          notify_email: string | null
          last_notified_offer: string | null
          active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          params: Json
          min_cpp: number
          seats?: number
          eligible_programs?: string[]
          min_cabin?: string | null
          notify_email?: string | null
          last_notified_offer?: string | null
          active?: boolean
          created_at?: string | null
        }
        Update: {
          params?: Json
          min_cpp?: number
          seats?: number
          eligible_programs?: string[]
          min_cabin?: string | null
          notify_email?: string | null
          last_notified_offer?: string | null
          active?: boolean
        }
        Relationships: []
      }
      hop_subscriptions: {
        // One row per user that has a non-default tier. Absent row = 'free'.
        // Written ONLY by the Stripe webhook (lib/subscription.ts#setUserTier).
        // stripe_customer_id is indexed: it's the fallback-attribution key for
        // lifecycle events without our metadata AND the stable re-link key for
        // the auth migration. last_event_at is the out-of-order webhook guard.
        // See drizzle/0005_subscriptions.sql.
        Row: {
          user_id: string
          tier: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          last_event_at: string | null
          updated_at: string | null
        }
        Insert: {
          user_id: string
          tier?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          last_event_at?: string | null
          updated_at?: string | null
        }
        Update: {
          tier?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          last_event_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_api_tokens: {
        // One row per minted "Add to Claude" token. token_hash is the SHA-256 of
        // the plaintext (the plaintext is never stored). last_four is a display
        // hint. See CREATE TABLE in lib/api-tokens.ts notes.
        Row: {
          id: string
          user_id: string
          token_hash: string
          last_four: string
          name: string | null
          created_at: string | null
          last_used_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          last_four: string
          name?: string | null
          created_at?: string | null
          last_used_at?: string | null
        }
        Update: {
          name?: string | null
          last_used_at?: string | null
        }
        Relationships: []
      }
      hop_standing_order_alerts: {
        // One alert per verdict crossing. pick is jsonb of the qualifying
        // FlightOption. See CREATE TABLE in lib/standing-order-alerts.ts notes.
        Row: {
          id: string
          standing_order_id: string
          user_id: string
          route: string
          pick: Json | null
          cpp: number | string
          fingerprint: string
          delivered: boolean
          seen: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          standing_order_id: string
          user_id: string
          route: string
          pick: Json
          cpp: number
          fingerprint: string
          delivered?: boolean
          seen?: boolean
          created_at?: string | null
        }
        Update: {
          route?: string
          pick?: Json
          cpp?: number
          fingerprint?: string
          delivered?: boolean
          seen?: boolean
        }
        Relationships: []
      }
      hop_escalations: {
        // "Request expert booking" leads (roadmap §6 / N-290, Phase 1). One row
        // per request. user_id is the Auth0 sub when signed in, NULL when the
        // requester is signed out. trip is free-form jsonb context. See CREATE
        // TABLE in lib/escalation.ts notes (and the Drizzle migration).
        Row: {
          id: string
          user_id: string | null
          email: string
          trip: Json | null
          status: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          trip?: Json
          status?: string
          created_at?: string | null
        }
        Update: {
          email?: string
          trip?: Json
          status?: string
        }
        Relationships: []
      }
      hop_valuation_overrides: {
        // Live cents-per-point aggregates, populated by
        // app/api/cron/valuation-sync/route.ts from the Cloudflare valuations
        // Worker. See CREATE TABLE in lib/valuation-overrides.ts notes.
        Row: {
          program_id: string
          cpp: number
          sample_size: number
          as_of: string
          updated_at: string | null
        }
        Insert: {
          program_id: string
          cpp: number
          sample_size: number
          as_of: string
          updated_at?: string | null
        }
        Update: {
          cpp?: number
          sample_size?: number
          as_of?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      hop_support_tickets: {
        // Inbound support emails captured as tickets by the Cloudflare support@
        // Worker via POST /api/support-ingest. message_id is the inbound
        // Message-ID (dedupe key; nulls allowed). See CREATE TABLE in
        // lib/support-tickets.ts notes.
        Row: {
          id: string
          message_id: string | null
          from_email: string
          to_email: string | null
          subject: string | null
          body: string | null
          status: string | null
          // AI-suggested reply (general knowledge; human reviews) + delivery audit.
          draft_reply: string | null
          notified_at: string | null
          reply_text: string | null
          replied_at: string | null
          received_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          from_email: string
          to_email?: string | null
          subject?: string | null
          body?: string | null
          status?: string
          draft_reply?: string | null
          notified_at?: string | null
          reply_text?: string | null
          replied_at?: string | null
          received_at?: string | null
          created_at?: string | null
        }
        Update: {
          status?: string
          draft_reply?: string | null
          notified_at?: string | null
          reply_text?: string | null
          replied_at?: string | null
        }
        Relationships: []
      }
      hop_outclicks: {
        // First-party affiliate outclick ledger — one row per /api/go/*
        // redirect (kind 'card' = the credit-card CTA). Anonymous by design:
        // NO user_id column (click telemetry, not user data). Written
        // fire-and-forget by lib/outclicks.ts; counted by
        // lib/business-digest.ts. See drizzle/0006_outclicks.sql.
        Row: {
          id: string
          clicked_at: string | null
          kind: string
          target: string
          url: string
          program: string | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          clicked_at?: string | null
          kind: string
          target: string
          url: string
          program?: string | null
          user_agent?: string | null
        }
        Update: {
          kind?: string
          target?: string
          url?: string
          program?: string | null
          user_agent?: string | null

      hop_cron_heartbeats: {
        // One liveness row per vercel.json cron job, upserted fire-and-forget
        // at the end of each authorized run (lib/cron-heartbeat.ts, ADR 0007).
        // SYSTEM-SCOPED: no user_id column exists, by design. ok=false with
        // note='disabled' means "owner switched it off" — the sentinel's D1
        // detector only looks at last_run_at age.
        Row: {
          job: string
          last_run_at: string
          ok: boolean
          note: string | null
        }
        Insert: {
          job: string
          last_run_at?: string
          ok?: boolean
          note?: string | null
        }
        Update: {
          last_run_at?: string
          ok?: boolean
          note?: string | null
        }
        Relationships: []
      }
      hop_degradation_events: {
        // Append-only degradation telemetry: one row per degraded source per
        // live search (lib/degradation-telemetry.ts, ADR 0007). SYSTEM-SCOPED:
        // no user_id, no balances, no free text — route only ever holds a
        // validated 'AAA-BBB' IATA pair or null. Pruned to 30d by the sentinel.
        Row: {
          id: string
          source: string
          route: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          source: string
          route?: string | null
          created_at?: string | null
        }
        Update: {
          source?: string
          route?: string | null
        }
        Relationships: []
      }
      hop_improvement_findings: {
        // Idempotent, fingerprinted findings (lib/improvement-findings.ts,
        // ADR 0007) — the durable queue between detection and delivery.
        // fingerprint (`kind:subject`) is UNIQUE; filed_at makes filing
        // at-most-once per episode; resolved_at drives the 7-day flap window.
        // SYSTEM-SCOPED: no user_id column exists, by design.
        Row: {
          id: string
          fingerprint: string
          kind: string
          severity: string
          title: string
          body: string
          status: string
          linear_issue_id: string | null
          linear_identifier: string | null
          delivered_via: string | null
          first_seen_at: string | null
          last_seen_at: string | null
          filed_at: string | null
          resolved_at: string | null
        }
        Insert: {
          id?: string
          fingerprint: string
          kind: string
          severity?: string
          title: string
          body: string
          status?: string
          linear_issue_id?: string | null
          linear_identifier?: string | null
          delivered_via?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          filed_at?: string | null
          resolved_at?: string | null
        }
        Update: {
          kind?: string
          severity?: string
          title?: string
          body?: string
          status?: string
          linear_issue_id?: string | null
          linear_identifier?: string | null
          delivered_via?: string | null
          first_seen_at?: string | null
          last_seen_at?: string | null
          filed_at?: string | null
          resolved_at?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Service-role Supabase client — SERVER ONLY. Bypasses RLS; we scope every query
// by the Auth0 user id in code. Never import this into a client component.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let _admin: ReturnType<typeof createClient<HopDatabase>> | null = null

export function supabaseAdmin() {
  if (!url || !serviceKey) return null
  if (!_admin) {
    _admin = createClient<HopDatabase>(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _admin
}
