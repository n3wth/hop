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
  /** One terse line of context — the honest caveat or the standout perk. */
  note: string
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
const CARDS: Record<string, CardAffiliate> = {
  // Transferable bank currencies — the cards that earn the points you transfer out.
  'amex-mr': {
    cardName: 'American Express Gold Card',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/gold-card/'),
    earnRate: '4x dining & U.S. supermarkets',
    bonusMiles: 60000,
    bonusSpend: 6000,
    note: 'Membership Rewards transfer to Delta, Air France-KLM, Virgin & more.',
  },
  'chase-ur': {
    cardName: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/rewards-credit-cards/sapphire/preferred'),
    earnRate: '2x–5x on travel',
    bonusMiles: 60000,
    bonusSpend: 4000,
    note: 'Ultimate Rewards transfer 1:1 to United, Hyatt, Air Canada & more.',
  },
  'citi-typ': {
    cardName: 'Citi Strata Premier',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-strata-premier-credit-card'),
    earnRate: '3x travel, dining & groceries',
    bonusMiles: 70000,
    bonusSpend: 4000,
    note: 'ThankYou points transfer to Turkish, Avianca, Qatar & more.',
  },
  'capital-one': {
    cardName: 'Capital One Venture X',
    issuer: 'Capital One',
    applyUrl: ref('https://www.capitalone.com/credit-cards/venture-x/'),
    earnRate: '2x everything, 10x hotels',
    bonusMiles: 75000,
    bonusSpend: 4000,
    note: 'Miles transfer to Air Canada, Avianca, Turkish, Flying Blue & more.',
  },
  bilt: {
    cardName: 'Bilt Mastercard',
    issuer: 'Wells Fargo',
    applyUrl: ref('https://www.biltrewards.com/card'),
    earnRate: '1x rent (no fee), 3x dining',
    bonusMiles: 0,
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
    note: 'Free checked bag + priority boarding on United flights.',
  },
  delta: {
    cardName: 'Delta SkyMiles Gold (Amex)',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold/'),
    earnRate: '2x Delta, dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 2000,
    note: 'First checked bag free on Delta flights.',
  },
  american: {
    cardName: 'Citi / AAdvantage Platinum Select',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-aadvantage-platinum-select-card'),
    earnRate: '2x American, dining & gas',
    bonusMiles: 50000,
    bonusSpend: 2500,
    note: 'Free checked bag + preferred boarding on American.',
  },
  alaska: {
    cardName: 'Alaska Airlines Visa',
    issuer: 'Bank of America',
    applyUrl: ref('https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/'),
    earnRate: '3x Alaska, 2x dining',
    bonusMiles: 60000,
    bonusSpend: 3000,
    note: 'Annual Companion Fare; powers Atmos Rewards redemptions.',
  },
  southwest: {
    cardName: 'Southwest Rapid Rewards Plus',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/southwest/rapid-rewards-plus'),
    earnRate: '2x Southwest, transit & internet',
    bonusMiles: 50000,
    bonusSpend: 1000,
    note: 'Points count toward the Companion Pass.',
  },
  jetblue: {
    cardName: 'JetBlue Plus Card',
    issuer: 'Barclays',
    applyUrl: ref('https://cards.barclaycardus.com/banking/cards/jetblue-plus-card/'),
    earnRate: '6x JetBlue, 2x dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 1000,
    note: 'Free first checked bag + 10% points back on redemptions.',
  },
  aeroplan: {
    cardName: 'Aeroplan Card',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/aeroplan'),
    earnRate: '3x Air Canada, dining & groceries',
    bonusMiles: 50000,
    bonusSpend: 3000,
    note: 'Free first checked bag on Air Canada flights.',
  },
  'avios-ba': {
    cardName: 'British Airways Visa Signature',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/british-airways'),
    earnRate: '3x British Airways, 2x travel',
    bonusMiles: 75000,
    bonusSpend: 5000,
    note: 'Travel Together ticket after a spend threshold; earns Avios.',
  },
  'virgin-atlantic': {
    cardName: 'Virgin Atlantic World Elite Mastercard',
    issuer: 'Synchrony',
    applyUrl: ref('https://www.virginatlantic.com/credit-card'),
    earnRate: '3x Virgin Atlantic, 1.5x else',
    bonusMiles: 60000,
    bonusSpend: 2000,
    note: 'Flying Club points; strong on ANA & Delta partner awards.',
  },
}

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

// The full table (defensive copy) keyed by canonical program id — for menus,
// the MCP best_card_for_program tool, and tests.
export function listCardAffiliates(): Record<string, CardAffiliate> {
  return { ...CARDS }
}
