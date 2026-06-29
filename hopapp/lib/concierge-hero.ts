// THE conversational front door — one voice, one copy source.
//
// hop has a single way in: talk to it. That entry shows up in two places — a
// teaser on the home hero (components/landing/AgentComposer) and the full
// landing on /ask (components/Concierge's Landing). Before this file, the two
// drifted: different eyebrows, headings, chips, and placeholders, in two
// visual languages. A visitor who tapped a chip on home was asked the same
// opening question twice, two different ways.
//
// This module is the SINGLE source of truth for that copy so the two surfaces
// can never diverge again. The shared <ConciergeHero> renders it; both surfaces
// render <ConciergeHero>. Pick the canonical voice here, change it once.
//
// The canonical voice is the photographic /ask hero's: eyebrow "Your points
// concierge", heading "Where to next?". Warm, personal, confident — it assumes
// the relationship rather than pitching a product.

/** One canonical set of one-tap starters. Same prompts, same order, both
 *  surfaces — so a chip on home is the same chip on /ask. The signed-in voice
 *  swaps the generic points line for the member's own ("my Amex points"). */
export function conciergeChips(signedIn: boolean): string[] {
  return [
    'Somewhere warm for a long weekend',
    'Cheapest way to Tokyo',
    signedIn ? 'Best use of my Amex points' : 'Best use of my points',
    'Off the beaten path',
  ]
}

/** One canonical placeholder, both surfaces. */
export const CONCIERGE_PLACEHOLDER = 'somewhere warm, ~40k points…'

/** The eyebrow above the heading — identical on home and /ask. */
export const CONCIERGE_EYEBROW = 'Your points concierge'

// The hero copy, resolved for the visitor. `signedIn` + an optional first name
// warm the heading; `totalPoints` (when present) grounds the sub in the real
// balance. The result is identical on both surfaces for the same visitor.
export interface ConciergeHeroCopy {
  eyebrow: string
  heading: string
  sub: string
  placeholder: string
  chips: string[]
}

export function conciergeHeroCopy(opts: {
  signedIn: boolean
  first?: string
  totalPoints?: number
}): ConciergeHeroCopy {
  const { signedIn, first, totalPoints } = opts

  // Heading — the canonical "Where to next?", warmed with a name when we have one.
  const heading = first ? `Where to next, ${first}?` : 'Where to next?'

  // Sub — one promise, phrased for what we know. Grounded in the member's real
  // points when present; the marketing promise otherwise. Same sentence shape
  // either way so the two surfaces never read as different products.
  const sub = totalPoints
    ? `Tell hop a vibe, a budget, or a city you can't stop thinking about. With ~${totalPoints.toLocaleString('en-US')} points, hop reads award space and cash for the same trip and tells you the verdict — miles or money, which one actually wins.`
    : "Tell hop a vibe, a budget, or a city you can't stop thinking about. hop reads award space and cash for the same trip, knows your point balances, and tells you the verdict — miles or money, which one actually wins."

  return {
    eyebrow: CONCIERGE_EYEBROW,
    heading,
    sub,
    placeholder: CONCIERGE_PLACEHOLDER,
    chips: conciergeChips(signedIn),
  }
}
