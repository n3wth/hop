/* eslint-disable */
// Shared wrapper for the per-user persistence modules (prefs, conversations,
// accounts, travel-profile, standing-orders, api-tokens, travel-history, …).
//
// A Postgrest-compatibility shim over Drizzle/Neon: the 22+ database-access
// libraries keep their Supabase-style query builders while the queries execute
// through lib/db. The shim implements the SUBSET of Postgrest the codebase
// actually uses — filters (eq/neq/gt/gte/lt/lte/in/is), order/limit,
// single/maybeSingle, insert/update/delete/upsert (incl. `.select()` read-back
// via RETURNING, array rows, composite onConflict targets, ignoreDuplicates),
// and `{ count: 'exact', head: true }`. Anything it can't resolve (unknown
// column names, unsupported chains) fails CLOSED with `{ error }` rather than
// silently widening a query.

import { getDb } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, ne, gte, lt, gt, lte, inArray, isNull, and, asc, desc, sql } from 'drizzle-orm'

// ── Snake/Camel Case Column Transformers ───────────────────────────────────

function toCamelKey(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
}

function toSnakeKey(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}

// Converts a database-returned Drizzle camelCase row to a snake_case row
// expected by existing callers. Transforms only top-level properties.
function toSnakeRow(obj: any): any {
  if (!obj || typeof obj !== 'object' || obj instanceof Date) return obj
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeKey(key)] = value
  }
  return result
}

// Converts a snake_case input payload (insert/update) to camelCase properties
// for Drizzle. Transforms only top-level properties; arrays map per row
// (Postgrest bulk insert/upsert passes arrays).
function toCamelRow(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamelRow)
  if (!obj || typeof obj !== 'object' || obj instanceof Date) return obj
  const result: any = {}
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelKey(key)] = value
  }
  return result
}

// ── Table Mapping ──────────────────────────────────────────────────────────

const TABLE_MAP: Record<string, any> = {
  hop_manual_balances: schema.manualBalances,
  hop_user_accounts: schema.userAccounts,
  hop_user_prefs: schema.userPrefs,
  hop_conversations: schema.conversations,
  hop_conversation_summary: schema.conversationSummary,
  hop_inferred_facts: schema.inferredFacts,
  hop_memory_outcomes: schema.memoryOutcomes,
  hop_subscriptions: schema.hopSubscriptions,
  hop_bookings: schema.bookings,
  hop_standing_orders: schema.standingOrders,
  hop_standing_order_alerts: schema.standingOrderAlerts,
  hop_api_tokens: schema.apiTokens,
  hop_travel_history: schema.travelHistory,
  hop_escalations: schema.escalations,
  hop_sweet_spot_drafts: schema.sweetSpotDrafts,
  hop_valuation_overrides: schema.valuationOverrides,
  hop_customers: schema.hopCustomers,
  hop_outclicks: schema.outclicks,
  hop_cron_heartbeats: schema.cronHeartbeats,
  hop_degradation_events: schema.degradationEvents,
  hop_improvement_findings: schema.improvementFindings,
  hop_support_tickets: schema.supportTickets,
  hop_notification_outbox: schema.notificationOutbox,
  hop_mcp_usage: schema.mcpUsage,
}

// ── Supabase/Postgrest Query Builder Shim for Drizzle ─────────────────────

class SupabaseCompatBuilder {
  private tableName: string
  private table: any
  private selectColumns: string[] = []
  private filters: { column: string; value: any; op: string }[] = []
  private orderOptions: { column: string; ascending: boolean }[] = []
  private limitVal: number | null = null
  private singleVal: 'maybeSingle' | 'single' | null = null
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  private inputData: any = null
  private upsertOptions: any = null
  private selectOptions: any = null
  private deleteOptions: any = null

  constructor(tableName: string) {
    this.tableName = tableName
    this.table = TABLE_MAP[tableName]
    if (!this.table) {
      console.warn(`[SupabaseCompat] Unknown table name: ${tableName}`)
    }
  }

  select(columns?: string, options?: any) {
    // Postgrest chains `.select()` AFTER a write (`insert(...).select('id')`)
    // to read the written rows back. The write op must survive — the rows come
    // from RETURNING. Only a fresh builder (op initialized to 'select' with no
    // pending input) treats this as a read.
    if (this.op !== 'select') {
      if (columns && columns !== '*') {
        this.selectColumns = columns.split(',').map(s => toCamelKey(s.trim()))
      }
      return this
    }
    this.selectOptions = options
    if (columns && columns !== '*') {
      this.selectColumns = columns.split(',').map(s => toCamelKey(s.trim()))
    }
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'eq' })
    return this
  }

  neq(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'neq' })
    return this
  }

  gte(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'gte' })
    return this
  }

  lt(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'lt' })
    return this
  }

  gt(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'gt' })
    return this
  }

  lte(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'lte' })
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push({ column: toCamelKey(column), value: values, op: 'in' })
    return this
  }

  is(column: string, value: any) {
    this.filters.push({ column: toCamelKey(column), value, op: 'is' })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderOptions.push({
      column: toCamelKey(column),
      ascending: options?.ascending !== false,
    })
    return this
  }

  limit(num: number) {
    this.limitVal = num
    return this
  }

  maybeSingle() {
    this.singleVal = 'maybeSingle'
    return this
  }

  single() {
    this.singleVal = 'single'
    return this
  }

  insert(data: any) {
    this.op = 'insert'
    this.inputData = data
    return this
  }

  update(data: any) {
    this.op = 'update'
    this.inputData = data
    return this
  }

  delete(options?: any) {
    this.op = 'delete'
    this.deleteOptions = options
    return this
  }

  upsert(data: any, options?: any) {
    this.op = 'upsert'
    this.inputData = data
    this.upsertOptions = options
    return this
  }

  async execute(): Promise<{ data: any; error: any; count: number | null }> {
    const db = getDb()
    if (!db) {
      return { data: null, error: new Error('Database connection unconfigured'), count: null }
    }
    if (!this.table) {
      return { data: null, error: new Error(`Table not found: ${this.tableName}`), count: null }
    }

    try {
      // 1. Build where clause. Unknown columns FAIL CLOSED: silently skipping
      // a filter would widen the query (potentially across users).
      const whereClauses: any[] = []
      for (const filter of this.filters) {
        const col = this.table[filter.column]
        if (!col) {
          return {
            data: null,
            error: new Error(
              `[SupabaseCompat] Unknown filter column "${filter.column}" on ${this.tableName}`,
            ),
            count: null,
          }
        }
        if (filter.op === 'eq') {
          whereClauses.push(eq(col, filter.value))
        } else if (filter.op === 'neq') {
          whereClauses.push(ne(col, filter.value))
        } else if (filter.op === 'gte') {
          whereClauses.push(gte(col, filter.value))
        } else if (filter.op === 'lt') {
          whereClauses.push(lt(col, filter.value))
        } else if (filter.op === 'gt') {
          whereClauses.push(gt(col, filter.value))
        } else if (filter.op === 'lte') {
          whereClauses.push(lte(col, filter.value))
        } else if (filter.op === 'in') {
          whereClauses.push(inArray(col, filter.value))
        } else if (filter.op === 'is') {
          if (filter.value === null) {
            whereClauses.push(isNull(col))
          } else {
            whereClauses.push(eq(col, filter.value))
          }
        }
      }
      const whereExpr = whereClauses.length > 0 ? and(...whereClauses) : undefined

      let rawResults: any = []

      if (this.op === 'select') {
        // `{ count: 'exact', head: true }` — count without fetching rows.
        if (this.selectOptions?.head && this.selectOptions?.count) {
          let cq: any = db.select({ count: sql<number>`count(*)` }).from(this.table)
          if (whereExpr) cq = cq.where(whereExpr)
          const [row] = await cq
          return { data: null, error: null, count: Number(row?.count ?? 0) }
        }

        // Column projection when every requested column resolves; otherwise
        // fetch full rows (extra keys are harmless to Postgrest-style callers).
        let projection: Record<string, any> | undefined
        if (this.selectColumns.length > 0) {
          projection = {}
          for (const name of this.selectColumns) {
            if (!this.table[name]) {
              projection = undefined
              break
            }
            projection[name] = this.table[name]
          }
        }

        let q: any = projection ? db.select(projection).from(this.table) : db.select().from(this.table)
        if (whereExpr) q = q.where(whereExpr)

        if (this.orderOptions.length > 0) {
          const orderExprs = []
          for (const o of this.orderOptions) {
            const col = this.table[o.column]
            if (!col) {
              return {
                data: null,
                error: new Error(
                  `[SupabaseCompat] Unknown order column "${o.column}" on ${this.tableName}`,
                ),
                count: null,
              }
            }
            orderExprs.push(o.ascending ? asc(col) : desc(col))
          }
          q = q.orderBy(...orderExprs)
        }

        if (this.limitVal !== null) {
          q = q.limit(this.limitVal)
        }

        rawResults = await q
      } else if (this.op === 'insert') {
        const values = toCamelRow(this.inputData)
        rawResults = await db.insert(this.table).values(values).returning()
      } else if (this.op === 'update') {
        const values = toCamelRow(this.inputData)
        let q = db.update(this.table).set(values)
        if (whereExpr) q = q.where(whereExpr) as any
        rawResults = await q.returning()
      } else if (this.op === 'delete') {
        let q = db.delete(this.table)
        if (whereExpr) q = q.where(whereExpr) as any
        rawResults = await q.returning()
      } else if (this.op === 'upsert') {
        const values = toCamelRow(this.inputData)

        // Composite conflict targets arrive Postgrest-style: 'user_id,kind,value'.
        const targetNames = String(this.upsertOptions?.onConflict || 'id')
          .split(',')
          .map(s => toCamelKey(s.trim()))
        const targetColumns = targetNames.map(n => this.table[n])
        if (targetColumns.some((c: any) => !c)) {
          return {
            data: null,
            error: new Error(
              `[SupabaseCompat] Unknown onConflict column(s) "${this.upsertOptions?.onConflict}" on ${this.tableName}`,
            ),
            count: null,
          }
        }

        const insert = db.insert(this.table).values(values)
        let q: any
        if (this.upsertOptions?.ignoreDuplicates) {
          q = insert.onConflictDoNothing({ target: targetColumns })
        } else {
          // Build the DO UPDATE set from EXCLUDED so multi-row upserts update
          // each row with its own incoming values.
          const sample = Array.isArray(values) ? values[0] ?? {} : values
          const setValues: Record<string, any> = {}
          for (const key of Object.keys(sample)) {
            if (targetNames.includes(key)) continue
            const col = this.table[key]
            if (!col) continue // unknown payload keys are dropped by Drizzle anyway
            setValues[key] = sql.raw(`excluded."${col.name}"`)
          }
          q = insert.onConflictDoUpdate({ target: targetColumns, set: setValues })
        }
        rawResults = await q.returning()
      }

      // Check if count or head is requested
      const countValue = rawResults ? rawResults.length : 0

      // 2. Format output
      if (this.singleVal) {
        if (!rawResults || rawResults.length === 0) {
          if (this.singleVal === 'single') {
            return { data: null, error: new Error('No rows found'), count: null }
          }
          return { data: null, error: null, count: null }
        }
        // Postgrest contract: .single() errors when more than one row matches.
        // (.maybeSingle() stays lenient — first row — since some legacy tables
        // lack unique constraints and callers treat it as "best match".)
        if (this.singleVal === 'single' && rawResults.length > 1) {
          return { data: null, error: new Error('Multiple rows found'), count: null }
        }
        return { data: toSnakeRow(rawResults[0]), error: null, count: countValue }
      }

      const formattedData = rawResults ? rawResults.map(toSnakeRow) : []
      return { data: formattedData, error: null, count: countValue }
    } catch (err: any) {
      console.error(`[SupabaseCompat] Error in ${this.op} on ${this.tableName}:`, err)
      return { data: null, error: err, count: null }
    }
  }

  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected)
  }
}

export class SupabaseCompatClient {
  from(tableName: string) {
    return new SupabaseCompatBuilder(tableName)
  }
}

// The non-null client handed to the callback.
export type Db = SupabaseCompatClient

// Run `fn` with the Postgrest Drizzle compatibility builder, returning `fallback`
// when unconfigured or anything throws. NEVER throws.
export async function withDb<T>(fallback: T, fn: (db: Db) => Promise<T>): Promise<T> {
  try {
    const db = new SupabaseCompatClient()
    return await fn(db)
  } catch (error) {
    console.error('Database error in withDb:', error)
    return fallback
  }
}
