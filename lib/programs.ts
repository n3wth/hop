// Canonical loyalty program registry — the shared spine for matching free-text
// program strings (user input, AwardWallet displayNames, destination.bestProgram)
// to one stable identity. Pure (no JSX, no I/O) so it's fully unit-testable.
//
// Today programs are free-text ("Amex MR" vs "Amex Membership Rewards" vs a
// typo). canonicalizeProgram() folds all of those onto one ProgramDef, so the
// LLM and the deterministic engine agree on which currency a user actually holds.
//
// ALIGNMENT (do not duplicate — this registry is the superset):
//   - `code` reuses lib/brands.ts BrandSlug-adjacent monograms where a real logo
//     exists (BRANDS), else the 2-letter codes from lib/awardwallet CODE_OVERRIDES
//     (e.g. C1 Capital One, MR Marriott, HH Hilton), else a curated monogram.
//   - `aliases` fold in awardwallet CODE_OVERRIDES match strings + transfers.ts
//     ALIASES + the abbreviations used in destinations.ts bestProgram strings.

import type { BrandSlug } from '@/lib/brands'

export type ProgramKind = 'bank' | 'airline' | 'hotel'

export interface ProgramDef {
  // stable slug — the join key other modules should persist, never the display name.
  id: string
  // canonical display name.
  name: string
  // lowercased tolerant-match strings (abbreviations, partials, common typos).
  // The canonical name + id are matched implicitly; list only the extras here.
  aliases: string[]
  // monogram code — a BrandSlug-backed code when a logo exists, else a 2-3 letter mark.
  code: string
  kind: ProgramKind
  // transferable bank currency (true for Amex/Chase/Citi/Cap One/Bilt).
  transferable: boolean
}

// --- Registry ---------------------------------------------------------------
// Ordered loosely bank -> airline -> hotel; canonicalize() is order-independent
// except for the substring fallback, which prefers longer needles first.

export const PROGRAMS: ProgramDef[] = [
  // Transferable bank currencies
  {
    id: 'amex-mr',
    name: 'Amex Membership Rewards',
    aliases: ['amex mr', 'amex', 'american express', 'membership rewards', 'mr', 'amex points', 'amx'],
    code: 'AX',
    kind: 'bank',
    transferable: true,
  },
  {
    id: 'chase-ur',
    name: 'Chase Ultimate Rewards',
    aliases: ['chase ur', 'chase', 'ultimate rewards', 'ur', 'chase points', 'sapphire'],
    code: 'UR',
    kind: 'bank',
    transferable: true,
  },
  {
    id: 'citi-typ',
    name: 'Citi ThankYou Points',
    aliases: ['citi', 'citibank', 'thankyou', 'thank you', 'typ', 'citi ty', 'citi thankyou', 'thankyou points'],
    code: 'TY',
    kind: 'bank',
    transferable: true,
  },
  {
    id: 'capital-one',
    name: 'Capital One Miles',
    aliases: ['capital one', 'cap one', 'capone', 'c1', 'venture', 'venture miles', 'capital one miles'],
    code: 'C1',
    kind: 'bank',
    transferable: true,
  },
  {
    id: 'bilt',
    name: 'Bilt Rewards',
    aliases: ['bilt', 'bilt points', 'bilt rewards'],
    code: 'BR',
    kind: 'bank',
    transferable: true,
  },

  // Airlines
  {
    id: 'united',
    name: 'United MileagePlus',
    aliases: ['united', 'mileageplus', 'mileage plus', 'ua', 'united miles'],
    code: 'UA',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'delta',
    name: 'Delta SkyMiles',
    aliases: ['delta', 'skymiles', 'sky miles', 'dl', 'delta miles'],
    code: 'DL',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'american',
    name: 'American AAdvantage',
    aliases: ['american', 'american airlines', 'aadvantage', 'aa', 'aa miles', 'advantage'],
    code: 'AA',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'alaska',
    name: 'Alaska Mileage Plan',
    aliases: ['alaska', 'alaska airlines', 'mileage plan', 'atmos', 'atmos rewards', 'as'],
    code: 'AS',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'southwest',
    name: 'Southwest Rapid Rewards',
    aliases: ['southwest', 'rapid rewards', 'wn', 'swa'],
    code: 'WN',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'jetblue',
    name: 'JetBlue TrueBlue',
    aliases: ['jetblue', 'jet blue', 'trueblue', 'true blue', 'b6'],
    code: 'B6',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'aeroplan',
    name: 'Air Canada Aeroplan',
    aliases: ['aeroplan', 'air canada', 'ac', 'aircanada'],
    code: 'AC',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'avios-ba',
    name: 'British Airways Avios',
    aliases: ['british airways', 'ba avios', 'avios', 'ba', 'british', 'executive club'],
    code: 'BA',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'virgin-atlantic',
    name: 'Virgin Atlantic Flying Club',
    aliases: ['virgin atlantic', 'virgin', 'flying club', 'vs', 'virgin points'],
    code: 'VS',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'flying-blue',
    name: 'Air France-KLM Flying Blue',
    aliases: ['flying blue', 'flyingblue', 'flying-blue', 'air france', 'klm', 'air france klm', 'airfrance', 'af', 'kl'],
    code: 'AF',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'ana',
    name: 'ANA Mileage Club',
    aliases: ['ana', 'all nippon', 'all nippon airways', 'mileage club', 'nh'],
    code: 'NH',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'krisflyer',
    name: 'Singapore KrisFlyer',
    aliases: ['krisflyer', 'kris flyer', 'singapore airlines', 'singapore', 'sq'],
    code: 'SQ',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'emirates',
    name: 'Emirates Skywards',
    aliases: ['emirates', 'skywards', 'ek'],
    code: 'EK',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'lifemiles',
    name: 'Avianca LifeMiles',
    aliases: ['lifemiles', 'life miles', 'avianca', 'av'],
    code: 'AV',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'qatar',
    name: 'Qatar Privilege Club',
    aliases: ['qatar', 'privilege club', 'qatar airways', 'avios qatar', 'qr'],
    code: 'QR',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'etihad',
    name: 'Etihad Guest',
    aliases: ['etihad', 'etihad guest', 'ey'],
    code: 'EY',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'qantas',
    name: 'Qantas Frequent Flyer',
    aliases: ['qantas', 'frequent flyer', 'qff', 'qf'],
    code: 'QF',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'cathay',
    name: 'Cathay Pacific Asia Miles',
    aliases: ['cathay', 'cathay pacific', 'asia miles', 'asiamiles', 'cx'],
    code: 'CX',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'turkish',
    name: 'Turkish Miles&Smiles',
    aliases: ['turkish', 'turkish airlines', 'miles and smiles', 'miles&smiles', 'miles smiles', 'tk'],
    code: 'TK',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'korean-air',
    name: 'Korean Air SKYPASS',
    aliases: ['korean air', 'korean', 'skypass', 'sky pass', 'ke'],
    code: 'KE',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'iberia',
    name: 'Iberia Plus',
    aliases: ['iberia', 'iberia plus', 'iberia avios', 'ib'],
    code: 'IB',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'aeromexico',
    name: 'Aeromexico Rewards',
    aliases: ['aeromexico', 'aeromexico rewards', 'aeromexico club premier', 'club premier', 'am'],
    code: 'AM',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'royal-air-maroc',
    name: 'Royal Air Maroc Safar Flyer',
    aliases: ['royal air maroc', 'safar flyer', 'maroc', 'ram', 'at'],
    code: 'AT',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'aegean',
    name: 'Aegean Miles+Bonus',
    aliases: ['aegean', 'aegean airlines', 'miles and bonus', 'miles+bonus', 'a3'],
    code: 'A3',
    kind: 'airline',
    transferable: false,
  },
  {
    id: 'tap',
    name: 'TAP Miles&Go',
    aliases: ['tap', 'tap air portugal', 'tap portugal', 'miles and go', 'miles&go', 'tp'],
    code: 'TP',
    kind: 'airline',
    transferable: false,
  },

  // Hotels
  {
    id: 'hyatt',
    name: 'World of Hyatt',
    aliases: ['hyatt', 'world of hyatt', 'woh'],
    code: 'HY',
    kind: 'hotel',
    transferable: false,
  },
  {
    id: 'marriott',
    name: 'Marriott Bonvoy',
    aliases: ['marriott', 'bonvoy', 'marriott bonvoy', 'mr'],
    code: 'MR',
    kind: 'hotel',
    transferable: false,
  },
  {
    id: 'hilton',
    name: 'Hilton Honors',
    aliases: ['hilton', 'hilton honors', 'honors', 'hh'],
    code: 'HH',
    kind: 'hotel',
    transferable: false,
  },
  {
    id: 'ihg',
    name: 'IHG One Rewards',
    aliases: ['ihg', 'ihg one rewards', 'one rewards', 'intercontinental'],
    code: 'IH',
    kind: 'hotel',
    transferable: false,
  },
]

// --- Indexes ----------------------------------------------------------------

const BY_ID = new Map<string, ProgramDef>(PROGRAMS.map((p) => [p.id, p]))

// Exact-match index: normalized id, name, and every alias -> def. Lets clean
// strings ("Amex MR", "membership rewards") resolve in O(1) before any fuzzy work.
const EXACT = new Map<string, ProgramDef>()
for (const p of PROGRAMS) {
  for (const key of [p.id, p.name, ...p.aliases]) {
    const k = normalize(key)
    if (k && !EXACT.has(k)) EXACT.set(k, p)
  }
}

// Substring needles, longest first so "air canada" beats a stray "air" and
// "ultimate rewards" beats "ur". Each maps a distinctive token back to a def.
const NEEDLES: Array<[string, ProgramDef]> = (() => {
  const seen = new Set<string>()
  const out: Array<[string, ProgramDef]> = []
  for (const p of PROGRAMS) {
    for (const key of [p.name, ...p.aliases]) {
      const k = normalize(key)
      // Skip ultra-short 1-char needles; 2-char monograms are fine.
      if (k.length < 2 || seen.has(k)) continue
      seen.add(k)
      out.push([k, p])
    }
  }
  return out.sort((a, b) => b[0].length - a[0].length)
})()

// Single-word fuzzy tokens: each distinctive word from a name/alias -> its def,
// but only when that word maps unambiguously to ONE program (so "rewards",
// shared across many, is dropped). Used for typo tolerance on one token of input.
const FUZZY_TOKENS: Array<[string, ProgramDef]> = (() => {
  const byWord = new Map<string, Set<string>>()
  const defByWord = new Map<string, ProgramDef>()
  for (const p of PROGRAMS) {
    for (const key of [p.name, ...p.aliases]) {
      for (const w of normalize(key).split(' ')) {
        if (w.length < 4) continue
        if (!byWord.has(w)) byWord.set(w, new Set())
        byWord.get(w)!.add(p.id)
        defByWord.set(w, p)
      }
    }
  }
  const out: Array<[string, ProgramDef]> = []
  for (const [w, ids] of byWord) {
    if (ids.size === 1) out.push([w, defByWord.get(w)!])
  }
  return out
})()

// --- Helpers ----------------------------------------------------------------

// Lowercase, strip punctuation, collapse whitespace. Stable normal form used by
// both the exact index and fuzzy passes.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Levenshtein distance, capped early for speed — used only as a last-resort
// typo tolerance against alias tokens (e.g. "skymiels" -> "skymiles").
function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 99
  const prev = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
      diag = tmp
    }
  }
  return prev[b.length]
}

// --- Public API -------------------------------------------------------------

// Tolerant free-text -> canonical ProgramDef. Resolution order:
//   1. exact match on a normalized id/name/alias ("Amex MR", "skymiles")
//   2. substring needle, longest-first ("ANA via Amex MR" -> ANA, the leftmost
//      earliest distinctive token wins so phrasing like "X via Y" hits X)
//   3. per-word fuzzy: a typo'd token within edit distance 1-2 of an alias
// Returns undefined when nothing plausibly matches — callers must degrade.
export function canonicalizeProgram(input: string): ProgramDef | undefined {
  if (!input) return undefined
  const norm = normalize(input)
  if (!norm) return undefined

  // 1. exact
  const exact = EXACT.get(norm)
  if (exact) return exact

  // 2. substring — prefer the needle that appears EARLIEST in the input, then
  // longest. Handles "ANA via Amex MR" (ANA leads) and "Singapore KrisFlyer".
  let best: ProgramDef | undefined
  let bestPos = Infinity
  let bestLen = 0
  const padded = ` ${norm} `
  for (const [needle, def] of NEEDLES) {
    const pos = padded.indexOf(needle.length <= 3 ? ` ${needle} ` : needle)
    if (pos === -1) continue
    if (pos < bestPos || (pos === bestPos && needle.length > bestLen)) {
      best = def
      bestPos = pos
      bestLen = needle.length
    }
  }
  if (best) return best

  // 3. fuzzy per-word against unambiguous alias tokens (typo tolerance, last
  // resort). e.g. "skymiels" -> skymiles -> delta, "membersihp" -> membership.
  const words = norm.split(' ').filter((w) => w.length >= 4)
  for (const w of words) {
    for (const [token, def] of FUZZY_TOKENS) {
      const tol = token.length >= 7 ? 2 : 1
      if (editDistance(w, token) <= tol) return def
    }
  }

  return undefined
}

// Lookup by stable slug.
export function programById(id: string): ProgramDef | undefined {
  return BY_ID.get(id)
}

// The full registry (defensive copy) for menus, validation, seeding.
export function listPrograms(): ProgramDef[] {
  return [...PROGRAMS]
}

// Only the transferable bank currencies (Amex/Chase/Citi/Cap One/Bilt).
export function listTransferablePrograms(): ProgramDef[] {
  return PROGRAMS.filter((p) => p.transferable)
}

// Re-export for callers that bridge to brand chips. A program's `code` aligns
// with lib/brands monograms where a logo exists; this keeps the link explicit.
export type { BrandSlug }
