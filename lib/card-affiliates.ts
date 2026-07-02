// Credit-card affiliate map — the "earn the points for this trip" recommendation
// behind a points-winning verdict (roadmap WS2). Pure (no JSX, no I/O) so the
// table + lookup are fully unit-testable.
//
// THESIS ALIGNMENT: this is advertising, not economics. Nothing here feeds the
// verdict, cpp, or ranking — those stay computed in lib/cpp.ts / lib/search.ts.
// This module only answers "which card earns THIS program's currency, and what's
// its public sign-up bonus", so the UI can surface a labelled affiliate CTA.
//
// Keyed by lib/programs.ts canonical ids. cardForProgram() canonicalizes any
// free-text program string (a pick's `program`, a destination's bestProgram)
// through canonicalizeProgram() before lookup, so it tolerates the same
// abbreviations/typos the rest of the engine does. Never throws.

import { canonicalizeProgram } from '@/lib/programs'

export interface CardAffiliate {
  /**
   * Stable card id — the canonical program id the card is keyed by (the table
   * key). Referenced by the first-party outclick redirect
   * (`/api/go/card/[id]`, see cardOutclickPath) so click tracking survives the
   * placeholder→network applyUrl swap unchanged.
   */
  id: string
  /** Marketing card name, e.g. "United Explorer Card". */
  cardName: string
  /** Issuing bank, e.g. "Chase". */
  issuer: string
  /**
   * Public application URL with a `?ref=hop-card` tracking param.
   *
   * NOTE: these are the cards' public landing pages, NOT real commission links.
   * When the CJ Affiliate / Bankrate partnership lands, swap each `applyUrl`
   * for the network deep link (the `?ref=hop-card` param is a placeholder for
   * the real tracking tag — see roadmap WS2 in docs/plans).
   */
  applyUrl: string
  /** Earn rate headline, e.g. "2x on travel & dining". */
  earnRate: string
  /** Sign-up bonus in the program's currency (miles/points). */
  bonusMiles: number
  /** Minimum spend that unlocks the bonus, in USD (omit when there is none). */
  bonusSpend?: number
  /** Months to hit bonusSpend (omit when there is no spend requirement). */
  bonusMonths?: number
  /** Annual fee as a plain string from the issuer's public card page, e.g. "$95". */
  annualFee: string
  /** One terse line of context — the honest caveat or the standout perk. */
  note: string
}

// Render the same 'N points after $X spend in Y months' shape the old MCP
// local map used to hand-format — computed from bonusMiles/bonusSpend/bonusMonths
// so callers never format bonus copy themselves. Pure, no I/O.
export function formatBonus(offer: Pick<CardAffiliate, 'bonusMiles' | 'bonusSpend' | 'bonusMonths'>): string {
  if (!offer.bonusMiles) return 'No welcome bonus'
  const points = `${offer.bonusMiles.toLocaleString('en-US')} points`
  if (!offer.bonusSpend) return points
  const spend = `$${offer.bonusSpend.toLocaleString('en-US')} spend`
  if (!offer.bonusMonths) return `${points} after ${spend}`
  const months = `${offer.bonusMonths} month${offer.bonusMonths === 1 ? '' : 's'}`
  return `${points} after ${spend} in ${months}`
}

// Append the hop tracking param to a base application URL. Kept tiny + pure so
// the table below reads as plain landing pages; the ref is attached in one place.
function ref(url: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}ref=hop-card`
}

// --- Affiliate table --------------------------------------------------------
// Covers the transferable bank currencies + the airline programs hop references
// in lib/valuations.ts / lib/destinations.ts. Bonus figures are public,
// representative offers (vary by promo); refresh alongside the valuations table.
// Hotel programs are intentionally omitted — hop only verdicts flights.
// (id is injected from the table key below, so it can never drift.)
const CARD_TABLE: Record<string, Omit<CardAffiliate, 'id'>> = {
  // Transferable bank currencies — the cards that earn the points you transfer out.
  'amex-mr': {
    cardName: 'American Express Gold Card',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/gold-card/'),
    earnRate: '4x dining & U.S. supermarkets',
    bonusMiles: 60000,
    bonusSpend: 6000,
    bonusMonths: 6,
    annualFee: '$325',
    note: 'Membership Rewards transfer to Delta, Air France-KLM, Virgin & more.',
  },
  'chase-ur': {
    cardName: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'),
    earnRate: '2x–5x on travel',
    bonusMiles: 60000,
    bonusSpend: 4000,
    bonusMonths: 3,
    annualFee: '$95',
    note: 'Ultimate Rewards transfer 1:1 to United, Hyatt, Air Canada & more.',
  },
  'citi-typ': {
    cardName: 'Citi Strata Premier',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-strata-premier-credit-card'),
    earnRate: '3x travel, dining & groceries',
    bonusMiles: 70000,
    bonusSpend: 4000,
    bonusMonths: 3,
    annualFee: '$95',
    note: 'ThankYou points transfer to Turkish, Avianca, Qatar & more.',
  },
  'capital-one': {
    cardName: 'Capital One Venture X',
    issuer: 'Capital One',
    applyUrl: ref('https://www.capitalone.com/credit-cards/venture-x/'),
    earnRate: '2x everything, 10x hotels',
    bonusMiles: 75000,
    bonusSpend: 4000,
    bonusMonths: 3,
    annualFee: '$395',
    note: 'Miles transfer to Air Canada, Avianca, Turkish, Flying Blue & more.',
  },
  bilt: {
    cardName: 'Bilt Mastercard',
    issuer: 'Wells Fargo',
    applyUrl: ref('https://www.biltrewards.com/card'),
    earnRate: '1x rent (no fee), 3x dining',
    bonusMiles: 0,
    annualFee: '$0',
    note: 'Earn on rent with no annual fee; transfers to United, Hyatt, Alaska.',
  },

  // Airlines — co-brand cards that earn the airline's own miles directly.
  united: {
    cardName: 'United Explorer Card',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/united/explorer'),
    earnRate: '2x United, dining & hotels',
    bonusMiles: 60000,
    bonusSpend: 3000,
    bonusMonths: 3,
    annualFee: '$0 first year, then $150',
    note: 'Free checked bag + priority boarding on United flights.',
  },
  delta: {
    cardName: 'Delta SkyMiles Gold (Amex)',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold/'),
    earnRate: '2x Delta, dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 2000,
    bonusMonths: 6,
    annualFee: '$0 first year, then $150',
    note: 'First checked bag free on Delta flights.',
  },
  american: {
    cardName: 'Citi / AAdvantage Platinum Select',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-aadvantage-platinum-select-card'),
    earnRate: '2x American, dining & gas',
    bonusMiles: 50000,
    bonusSpend: 2500,
    bonusMonths: 3,
    annualFee: '$0 first year, then $99',
    note: 'Free checked bag + preferred boarding on American.',
  },
  alaska: {
    cardName: 'Alaska Airlines Visa',
    issuer: 'Bank of America',
    applyUrl: ref('https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/'),
    earnRate: '3x Alaska, 2x dining',
    bonusMiles: 60000,
    bonusSpend: 3000,
    bonusMonths: 3,
    annualFee: '$95',
    note: 'Annual Companion Fare; powers Atmos Rewards redemptions.',
  },
  southwest: {
    cardName: 'Southwest Rapid Rewards Plus',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/southwest/rapid-rewards-plus'),
    earnRate: '2x Southwest, transit & internet',
    bonusMiles: 50000,
    bonusSpend: 1000,
    bonusMonths: 3,
    annualFee: '$69',
    note: 'Points count toward the Companion Pass.',
  },
  jetblue: {
    cardName: 'JetBlue Plus Card',
    issuer: 'Barclays',
    applyUrl: ref('https://cards.barclaycardus.com/banking/cards/jetblue-plus-card/'),
    earnRate: '6x JetBlue, 2x dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 1000,
    bonusMonths: 3,
    annualFee: '$99',
    note: 'Free first checked bag + 10% points back on redemptions.',
  },
  aeroplan: {
    cardName: 'Aeroplan Card',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/aeroplan'),
    earnRate: '3x Air Canada, dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 3000,
    bonusMonths: 3,
    annualFee: '$95',
    note: 'Free first checked bag on Air Canada flights.',
  },
  'avios-ba': {
    cardName: 'British Airways Visa Signature',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/british-airways'),
    earnRate: '3x British Airways, 2x travel',
    bonusMiles: 75000,
    bonusSpend: 5000,
    bonusMonths: 3,
    annualFee: '$95',
    note: 'Travel Together ticket after a spend threshold; earns Avios.',
  },
  'virgin-atlantic': {
    cardName: 'Virgin Atlantic World Elite Mastercard',
    issuer: 'Synchrony',
    applyUrl: ref('https://www.virginatlantic.com/credit-card'),
    earnRate: '3x Virgin Atlantic, 1.5x else',
    bonusMiles: 60000,
    bonusSpend: 2000,
    bonusMonths: 3,
    annualFee: '$0',
    note: 'Flying Club points; strong on ANA & Delta partner awards.',
  },
}

// Each entry carries its own table key as `id` — derived, never hand-typed.
const CARDS: Record<string, CardAffiliate> = Object.fromEntries(
  Object.entries(CARD_TABLE).map(([id, card]) => [id, { id, ...card }]),
)

// --- Public API -------------------------------------------------------------

// The card that earns a given program's currency. Accepts any free-text program
// string (a pick's `program`, a destination's bestProgram) and canonicalizes it
// through the shared registry before lookup. Returns undefined when the program
// is unknown or has no mapped card (e.g. hotels) — never throws.
export function cardForProgram(program: string): CardAffiliate | undefined {
  if (!program) return undefined
  const def = canonicalizeProgram(program)
  if (!def) return undefined
  return CARDS[def.id]
}

// Direct lookup by card id (the canonical table key). Exact match only — the
// id comes from a href WE minted (cardOutclickPath), not from free text, so
// there is nothing to canonicalize. Unknown/empty id → undefined, never throws.
export function cardById(id: string): CardAffiliate | undefined {
  if (!id || typeof id !== 'string') return undefined
  return CARDS[id]
}

// The CTA's outbound href: the first-party outclick redirect
// (app/api/go/card/[id]/route.ts) that logs the click and 302s to the card's
// applyUrl. `program` is optional verdict context (the pick's free-text
// program), stored with the click — never used as a redirect target. Pure and
// client-safe; the single source of truth for the path shape.
export function cardOutclickPath(cardId: string, program?: string): string {
  const base = `/api/go/card/${encodeURIComponent(cardId)}`
  const context = (program ?? '').trim()
  return context ? `${base}?program=${encodeURIComponent(context)}` : base
}

// The full table (defensive copy) keyed by canonical program id — for menus,
// the MCP best_card_for_program tool, and tests.
export function listCardAffiliates(): Record<string, CardAffiliate> {
  return { ...CARDS }
}
