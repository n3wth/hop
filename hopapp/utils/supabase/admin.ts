import { createClient } from '@supabase/supabase-js'

// Minimal schema for the tables hop owns. Enough to give the query builder real
// row types (otherwise it infers `never`). Extend as we add tables.
interface HopDatabase {
  public: {
    Tables: {
      hop_user_prefs: {
        Row: { user_id: string; home_airport: string | null; updated_at: string | null }
        Insert: { user_id: string; home_airport?: string | null; updated_at?: string | null }
        Update: { home_airport?: string | null; updated_at?: string | null }
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
