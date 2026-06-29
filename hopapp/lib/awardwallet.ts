// AwardWallet balances client. Fetches a connected user's loyalty accounts
// and normalizes them to the shared Balance model. NEVER throws.
//
// VERIFIED against live responses (2026-06-28):
//   - GET /api/export/v1/connectedUser/{userId} returns { accounts: Account[] }.
//   - Auth header is `X-Authentication: <apiKey>` (NOT Authorization — that 403s
//     with AUTHENTICATION_REQUIRED).
//   - Each account: { code, displayName ("Alaska Airlines (Atmos Rewards)"),
//     kind ("Airlines" | "Credit Cards" | "Hotels" | "Rentals" | "Shopping"),
//     balance (string with commas, or "n/a"), balanceRaw (clean integer),
//     properties: [{ name, value }] where elite status lives under varying keys
//     ("Level", "Membership Level", "Membership Status", "Status"). }
//   - There is no uniform top-level status/level field.

import type { ApiResult, Balance } from '@/lib/types'
import { env, hasEnv } from '@/lib/env'

const AWARDWALLET_BASE = 'https://business.awardwallet.com/api/export/v1'
const TIMEOUT_MS = 10_000

// Account kinds that represent point/mile balances we care about. Rentals,
// Shopping, Dining, etc. are excluded — they aren't redeemable travel currency.
const POINTS_KINDS = new Set(['airlines', 'credit cards', 'hotels'])

// Property names (lowercased) that carry an elite-status/level value.
const STATUS_PROP_NAMES = ['level', 'membership level', 'membership status', 'status']

// --- AwardWallet response shapes (verified; partial) ------------------------
interface AwardWalletProperty {
  name?: string
  value?: string
  code?: string
}
interface AwardWalletAccount {
  code?: string
  displayName?: string
  kind?: string
  balance?: string | number
  balanceRaw?: number
  properties?: AwardWalletProperty[]
}
interface AwardWalletUserResponse {
  accounts?: AwardWalletAccount[]
  userName?: string
}

// Known program -> monogram overrides (2-letter airline/bank codes).
const CODE_OVERRIDES: Array<{ match: string; code: string }> = [
  { match: 'amex', code: 'AX' },
  { match: 'american express', code: 'AX' },
  { match: 'membership rewards', code: 'AX' },
  { match: 'british airways', code: 'BA' },
  { match: 'avios', code: 'BA' },
  { match: 'bilt', code: 'BR' },
  { match: 'chase', code: 'UR' },
  { match: 'ultimate rewards', code: 'UR' },
  { match: 'alaska', code: 'AS' },
  { match: 'atmos', code: 'AS' },
  { match: 'southwest', code: 'WN' },
  { match: 'rapid rewards', code: 'WN' },
  { match: 'united', code: 'UA' },
  { match: 'mileageplus', code: 'UA' },
  { match: 'delta', code: 'DL' },
  { match: 'skymiles', code: 'DL' },
  { match: 'aeroplan', code: 'AC' },
  { match: 'capital one', code: 'C1' },
  { match: 'marriott', code: 'MR' },
  { match: 'hilton', code: 'HH' },
  { match: 'jetblue', code: 'B6' },
  { match: 'trueblue', code: 'B6' },
]

// Derive a 2-3 letter monogram from a program name.
export function deriveCode(program: string): string {
  const lower = program.toLowerCase().trim()
  const override = CODE_OVERRIDES.find((o) => lower.includes(o.match))
  if (override) return override.code

  // Fall back to initials of the first two significant words.
  const stop = new Set(['the', 'of', 'and', 'rewards', 'miles', 'points', 'program'])
  const words = lower
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 0 && !stop.has(w))
  if (words.length === 0) {
    return program.slice(0, 2).toUpperCase()
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}

function parseBalance(account: AwardWalletAccount): number {
  if (typeof account.balanceRaw === 'number') return account.balanceRaw
  if (typeof account.balance === 'number') return account.balance
  if (typeof account.balance === 'string') {
    const n = parseFloat(account.balance.replace(/[^0-9.-]/g, ''))
    return isNaN(n) ? 0 : n
  }
  return 0
}

// Pull a best-effort elite status from the account's properties array. Status
// is stored under varying property names ("Level", "Membership Level", etc.).
function extractStatus(account: AwardWalletAccount): string | undefined {
  const props = account.properties
  if (!props) return undefined
  for (const want of STATUS_PROP_NAMES) {
    const hit = props.find((p) => (p.name ?? '').toLowerCase().trim() === want)
    if (hit && hit.value && hit.value.trim() !== '') return hit.value.trim()
  }
  return undefined
}

// Is this account a redeemable points/miles balance (not a rental/shopping
// loyalty card, and a positive balance)?
export function isPointsAccount(account: AwardWalletAccount): boolean {
  const kind = (account.kind ?? '').toLowerCase().trim()
  if (kind && !POINTS_KINDS.has(kind)) return false
  return parseBalance(account) > 0
}

export function normalizeAwardWalletAccount(account: AwardWalletAccount): Balance {
  const program = account.displayName ?? 'Unknown program'
  return {
    program,
    code: deriveCode(program),
    balance: parseBalance(account),
    status: extractStatus(account),
  }
}

export async function getBalances(): Promise<ApiResult<Balance[]>> {
  if (!hasEnv('AWARDWALLET_API_KEY') || !hasEnv('AWARDWALLET_USER_ID')) {
    return { ok: false, reason: 'AwardWallet credentials not configured' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const userId = encodeURIComponent(env.awardWalletUserId())
    const res = await fetch(`${AWARDWALLET_BASE}/connectedUser/${userId}`, {
      method: 'GET',
      headers: {
        'X-Authentication': env.awardWalletApiKey(),
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!res.ok) {
      return { ok: false, reason: `AwardWallet responded ${res.status}` }
    }

    const json = (await res.json()) as AwardWalletUserResponse
    const accounts = json.accounts ?? []
    const balances = accounts
      .filter(isPointsAccount)
      .map(normalizeAwardWalletAccount)
    return { ok: true, data: balances }
  } catch (err) {
    const reason =
      err instanceof Error && err.name === 'AbortError'
        ? 'AwardWallet request timed out'
        : 'AwardWallet request failed'
    return { ok: false, reason }
  } finally {
    clearTimeout(timer)
  }
}
