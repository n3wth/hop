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
        // eligible_programs is a text[] (empty = any program). See CREATE TABLE
        // in lib/standing-orders.ts notes.
        Row: {
          id: string
          user_id: string
          params: Json | null
          min_cpp: number | string
          seats: number
          eligible_programs: string[] | null
          min_cabin: string | null
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
          last_notified_offer?: string | null
          active?: boolean
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
