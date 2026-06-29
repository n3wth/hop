// Shared wrapper for the per-user Supabase persistence modules (prefs,
// conversations, accounts, travel-profile, standing-orders, api-tokens,
// travel-history, …). Every one of those functions repeats the same shape:
//
//   try {
//     const db = supabaseAdmin()
//     if (!db) return <fallback>
//     ...query, scoped by user_id in code...
//   } catch {
//     return <fallback>
//   }
//
// withDb captures exactly that boilerplate — resolve the service-role client,
// short-circuit to the fallback when it's unconfigured, and never throw to the
// caller — while leaving the query body fully visible inside the callback. The
// fallback is passed explicitly so each call site still states its own "empty"
// ([], {}, null, false, 0, …). Identity is Auth0; callers still scope every
// query by user_id themselves (this helper does NOT add any scoping).

import { supabaseAdmin } from '@/utils/supabase/admin'

// The non-null service-role client handed to the callback.
type Db = NonNullable<ReturnType<typeof supabaseAdmin>>

// Run `fn` with the service-role client, returning `fallback` when the client is
// unconfigured or anything throws. NEVER throws — mirrors the degrade-gracefully
// contract every persistence helper already promises.
export async function withDb<T>(fallback: T, fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    const db = supabaseAdmin()
    if (!db) return fallback
    return await fn(db)
  } catch {
    return fallback
  }
}
