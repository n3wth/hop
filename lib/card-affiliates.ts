import { canonicalizeProgram } from './programs'

export interface CardAffiliate {
  /** Unique key — matches program id when 1:1, or bank currency slug like 'amex-mr'. */
  id: string
  /** Human-facing card product name, e.g. "American Express Gold Card". */
  cardName: string
  /** Issuing bank or partner, e.g. "American Express", "Chase". */
  issuer: string
  /** Outbound affiliate application URL (with tracking param attached). */
  applyUrl: string
  /** Short headline earn rate, e.g. "4x dining & U.S. supermarkets". */
  earnRate: string
  /** Annual fee in USD or string description. */
  annualFee: number | string
  /** Numeric welcome bonus miles/points (e.g. 60000). 0 = no bonus. */
  bonusMiles: number
  /** Spend required in USD to earn the bonus (e.g. 6000). 0 = no spend requirement. */
  bonusSpend?: number
  /** Months allowed to reach the spend threshold (e.g. 6). 0 = no time limit. */
  bonusMonths?: number
  /** Optional context or caveat note. */
  note?: string
}

/**
 * Look up the primary affiliate card for a loyalty program or bank currency.
 * Accepts canonical program ids ('united', 'amex-mr'), canonical program display
 * names ("United MileagePlus"), or loose free-text program names ("United").
 * Uses `canonicalizeProgram` internally so call sites don't need pre-sanitization.
 */
export function cardForProgram(programOrId: string): CardAffiliate | undefined {
  if (!programOrId) return undefined

  // 1. Direct hit on CARD_TABLE by exact id or alias.
  const direct = cardById(programOrId)
  if (direct) return direct

  // 2. Canonicalize through lib/programs.ts — normalizes free text ("united",
  // "United MileagePlus", "alaska atmos") into a program entry with an .id.
  const prog = canonicalizeProgram(programOrId)
  if (!prog) return undefined

  // 3. Look up by the canonical program id.
  const byProgId = cardById(prog.id)
  if (byProgId) return byProgId

  // 4. Map bank currencies that don't match 1:1 by program id.
  const bankMap: Record<string, string> = {
    amex: 'amex-mr',
    chase: 'chase-ur',
    capone: 'capone-vx',
    'capital-one': 'capone-vx',
    citi: 'citi-typ',
    bilt: 'bilt',
  }
  const bankCardId = bankMap[prog.id]
  if (bankCardId) return cardById(bankCardId)

  return undefined
}

/**
 * Direct lookup by card table key (e.g. 'united', 'amex-mr').
 */
export function cardById(id: string): CardAffiliate | undefined {
  if (!id) return undefined
  const key = id.toLowerCase().trim()
  const entry = CARD_TABLE[key] ?? CARD_ALIAS_MAP[key]
  if (!entry) return undefined
  return entry
}

/**
 * Construct the internal redirect URL for outclick tracking (/api/go/card/[id]).
 */
export function cardOutclickPath(cardOrId: string | Pick<CardAffiliate, 'id'>, program?: string): string {
  const cardId = typeof cardOrId === 'string' ? cardOrId : cardOrId.id
  const base = `/api/go/card/${encodeURIComponent(cardId)}`
  const context = (program ?? '').trim()
  return context ? `${base}?program=${encodeURIComponent(context)}` : base
}

/**
 * Returns every card affiliate in the table, sorted by issuer then card name.
 */
export function listCardAffiliates(): CardAffiliate[] {
  return Object.values(CARD_TABLE)
    .sort((a, b) => a.issuer.localeCompare(b.issuer) || a.cardName.localeCompare(b.cardName))
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

// Append the affiliate tracking param to a base application URL.
// Uses NEXT_PUBLIC_CJ_AFFILIATE_TAG env var (fallback to 'hop-card' for dev).
function ref(url: string): string {
  const tag = process.env.NEXT_PUBLIC_CJ_AFFILIATE_TAG ?? 'hop-card'
  return `${url}${url.includes('?') ? '&' : '?'}ref=${tag}`
}

// --- Affiliate table --------------------------------------------------------
// Covers the transferable bank currencies + the airline programs hop references
// in lib/valuations.ts / lib/destinations.ts. Bonus figures are public,
// representative offers (vary by promo); refresh alongside the valuations table.
// Hotel programs are intentionally omitted — hop only verdicts flights.
// (id is injected from the table key below, so it can never drift.)
const CARD_TABLE_RAW: Record<string, Omit<CardAffiliate, 'id'>> = {
  // Transferable bank currencies — the cards that earn the points you transfer out.
  'amex-mr': {
    cardName: 'American Express Gold Card',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/gold-card/'),
    earnRate: '4x dining & U.S. supermarkets',
    annualFee: 250,
    bonusMiles: 60000,
    bonusSpend: 6000,
    bonusMonths: 6,
    note: 'Membership Rewards transfer to Delta, Air France-KLM, Virgin & more.',
  },
  'chase-ur': {
    cardName: 'Chase Sapphire Preferred',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/sapphire/preferred'),
    earnRate: '3x dining & streaming, 2x travel',
    annualFee: 95,
    bonusMiles: 60000,
    bonusSpend: 4000,
    bonusMonths: 3,
    note: 'Ultimate Rewards transfer 1:1 to United, Hyatt, Air Canada & more.',
  },
  'capone-vx': {
    cardName: 'Capital One Venture X',
    issuer: 'Capital One',
    applyUrl: ref('https://www.capitalone.com/credit-cards/venture-x/'),
    earnRate: '2x everywhere, 10x hotels & rentals via Capital One Travel',
    annualFee: 395,
    bonusMiles: 75000,
    bonusSpend: 4000,
    bonusMonths: 3,
    note: 'Miles transfer to Air Canada, Avianca, Turkish, Flying Blue & more.',
  },
  'citi-typ': {
    cardName: 'Citi Strata Premier',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-strata-premier-credit-card'),
    earnRate: '3x restaurants, supermarkets, gas & travel',
    annualFee: 95,
    bonusMiles: 75000,
    bonusSpend: 4000,
    bonusMonths: 3,
    note: 'ThankYou points transfer to Turkish, Avianca, Qatar & more.',
  },
  bilt: {
    cardName: 'Bilt Rewards Mastercard',
    issuer: 'Wells Fargo',
    applyUrl: ref('https://www.biltrewards.com/card'),
    earnRate: '1x rent (no fee), 3x dining, 2x travel',
    annualFee: 0,
    bonusMiles: 0,
    bonusSpend: 0,
    bonusMonths: 0,
    note: 'Earn on rent with no annual fee; transfers to United, Hyatt, Alaska.',
  },

  // Airline cobrand cards — mapped 1:1 by canonical program id.
  alaska: {
    cardName: 'Alaska Airlines Visa Signature',
    issuer: 'Bank of America',
    applyUrl: ref('https://www.bankofamerica.com/credit-cards/products/alaska-airlines-credit-card/'),
    earnRate: '3x Alaska purchases, companion fare annually',
    annualFee: 95,
    bonusMiles: 60000,
    bonusSpend: 3000,
    bonusMonths: 3,
    note: 'Annual Companion Fare; powers Atmos Rewards redemptions.',
  },
  american: {
    cardName: 'Citi / AAdvantage Platinum Select',
    issuer: 'Citi',
    applyUrl: ref('https://www.citi.com/credit-cards/citi-aadvantage-platinum-select-credit-card'),
    earnRate: '2x AA purchases, gas & dining',
    annualFee: 99,
    bonusMiles: 50000,
    bonusSpend: 2500,
    bonusMonths: 3,
    note: 'Free checked bag + preferred boarding on American.',
  },
  ana: {
    cardName: 'ANA CARD U.S.A. Visa',
    issuer: 'First National Bank of Omaha',
    applyUrl: ref('https://www.anacardusa.com/'),
    earnRate: '1x everywhere, 10% duty-free discount',
    annualFee: 70,
    bonusMiles: 5000,
    bonusSpend: 0,
    bonusMonths: 0,
    note: 'Duty-free discounts + flight bonus miles.',
  },
  avios: {
    cardName: 'British Airways Visa Signature',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/aadvantage-credit-cards/british-airways'),
    earnRate: '3x BA/Iberia/Aer Lingus, 10% off BA flights',
    annualFee: 95,
    bonusMiles: 75000,
    bonusSpend: 5000,
    bonusMonths: 3,
    note: 'Travel Together ticket after a spend threshold; earns Avios.',
  },
  delta: {
    cardName: 'Delta SkyMiles Gold (Amex)',
    issuer: 'American Express',
    applyUrl: ref('https://www.americanexpress.com/us/credit-cards/card/delta-skymiles-gold-american-express-card/'),
    earnRate: '2x Delta, dining & U.S. supermarkets',
    annualFee: 150,
    bonusMiles: 65000,
    bonusSpend: 2000,
    bonusMonths: 6,
    note: 'First checked bag free on Delta flights.',
  },
  emirates: {
    cardName: 'Emirates Skywards Premium World Elite',
    issuer: 'Barclays',
    applyUrl: ref('https://cards.barclaycardus.com/banking/cards/emirates-skywards-premium-world-elite-mastercard/'),
    earnRate: '3x Emirates, Gold tier status for first year',
    annualFee: 499,
    bonusMiles: 60000,
    bonusSpend: 3000,
    bonusMonths: 3,
    note: 'Gold tier status for first year + lounge access.',
  },
  flyingblue: {
    cardName: 'Air France KLM World Elite Mastercard',
    issuer: 'Bank of America',
    applyUrl: ref('https://www.bankofamerica.com/credit-cards/products/air-france-klm-credit-card/'),
    earnRate: '3x Air France/KLM, 60 XP on approval',
    annualFee: 89,
    bonusMiles: 70000,
    bonusSpend: 3000,
    bonusMonths: 3,
    note: '60 XP on approval + annual XP bonus.',
  },
  jetblue: {
    cardName: 'JetBlue Plus Card',
    issuer: 'Barclays',
    applyUrl: ref('https://cards.barclaycardus.com/banking/cards/jetblue-plus-card/'),
    earnRate: '6x JetBlue, 5,000 anniversary points',
    annualFee: 99,
    bonusMiles: 50000,
    bonusSpend: 1000,
    bonusMonths: 3,
    note: 'Free first checked bag + 10% points back on redemptions.',
  },
  singapore: {
    cardName: 'KrisFlyer UOB Credit Card',
    issuer: 'UOB',
    applyUrl: ref('https://www.uob.com.sg/personal/cards/credit-cards/travel/krisflyer-uob-card.page'),
    earnRate: '3x Singapore Airlines, Scoot & KrisShop',
    annualFee: 194,
    bonusMiles: 10000,
    bonusSpend: 2000,
    bonusMonths: 2,
    note: 'Fast-track KrisFlyer Elite Silver status.',
  },
  southwest: {
    cardName: 'Southwest Rapid Rewards Priority',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/southwest/priority'),
    earnRate: '3x Southwest, $75 annual Southwest credit',
    annualFee: 149,
    bonusMiles: 50000,
    bonusSpend: 1000,
    bonusMonths: 3,
    note: 'Points count toward Companion Pass.',
  },
  united: {
    cardName: 'United Explorer Card',
    issuer: 'Chase',
    applyUrl: ref('https://creditcards.chase.com/travel-credit-cards/united/explorer'),
    earnRate: '2x United, dining & hotel stays, free 1st checked bag',
    annualFee: 95,
    bonusMiles: 60000,
    bonusSpend: 3000,
    bonusMonths: 3,
    note: 'Free checked bag + priority boarding on United flights.',
  },
  virgin: {
    cardName: 'Virgin Atlantic World Elite Mastercard',
    issuer: 'Bank of America',
    applyUrl: ref('https://www.bankofamerica.com/credit-cards/products/virgin-atlantic-credit-card/'),
    earnRate: '3x Virgin Atlantic, tier status points per spend',
    annualFee: 90,
    bonusMiles: 30000,
    bonusSpend: 1000,
    bonusMonths: 3,
    note: 'Flying Club points; strong on ANA & Delta partner awards.',
  },
}

const CARD_TABLE: Record<string, CardAffiliate> = Object.fromEntries(
  Object.entries(CARD_TABLE_RAW).map(([id, card]) => [id, { id, ...card }]),
)

const CARD_ALIAS_MAP: Record<string, CardAffiliate> = {
  'capital-one': CARD_TABLE['capone-vx'],
  'avios-ba': CARD_TABLE['avios'],
  'virgin-atlantic': CARD_TABLE['virgin'],
  'flying-blue': CARD_TABLE['flyingblue'],
  aeroplan: CARD_TABLE['united'], // fallback
}
