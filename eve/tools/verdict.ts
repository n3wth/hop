// verdict — the moat, exposed as a tool. Wraps lib/search.assembleSearch: the
// ONE function the whole product funnels through. Given a route + dates +
// balances, it fans out to upstream sources, computes per-option economics
// (cpp/tier/ranking), picks the best redemption, and renders the verdict.
//
// ENGINE COMPUTES, AGENT NARRATES: every number returned here is computed by
// lib/* deterministic code. The model reads verdict/pick/summary/degraded and
// composes prose around them — it never invents an economic value.
//
// assembleSearch ALWAYS resolves (never throws); upstream failures land in
// `degraded[]` ('cash'/'awards'/'balances') so a dead API degrades one section
// instead of failing the run. The tool surfaces `degraded` so the agent can say
// so plainly.

import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { assembleSearch } from '../../lib/search'
import { getUserBalances } from '../../lib/accounts'
import type { Balance } from '../../lib/types'
import type { TravelPrefs } from '../../lib/prefs-model'

export default defineTool({
  name: 'verdict',
  description:
    "Run hop's deterministic points-vs-cash engine for one route + dates and return the verdict (use-points | pay-cash | none), the picked option, a summary (cheapest cash, best miles, best cpp, dollars saved), the ranked options, and any degraded sections. ALWAYS call this before stating any verdict, cpp, miles, or savings number — never invent them. Pass userId to ground it in the user's REAL balances (manual + AwardWallet); omit it and pass balances for a stateless quote.",
  inputSchema: z.object({
    from: z.string().length(3).describe('Origin IATA code, e.g. "SFO".'),
    to: z.string().length(3).describe('Destination IATA code, e.g. "NRT".'),
    depart: z.string().describe('Departure date, ISO YYYY-MM-DD.'),
    return: z.string().optional().describe('Return date, ISO YYYY-MM-DD. Omit for one-way.'),
    adults: z.number().int().min(1).max(9).default(1).describe('Adult passengers.'),
    cabin: z
      .enum(['economy', 'premium', 'business', 'first'])
      .optional()
      .describe('Requested cabin. Omit for economy.'),
    userId: z
      .string()
      .optional()
      .describe("Auth0 sub. When present, resolves the user's real balances via getUserBalances."),
    prefs: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional natural-language travel prefs (TravelPrefs) applied as a filter/tiebreaker.'),
  }),
  async execute({ from, to, depart, return: ret, adults, cabin, userId, prefs }) {
    // Real balances when we know who's asking; otherwise stateless (engine falls
    // back to the env-global AwardWallet fetch only when balances is undefined).
    const balances: Balance[] | undefined = userId ? await getUserBalances(userId) : undefined

    const result = await assembleSearch(
      { from, to, depart, return: ret, adults, cabin },
      balances,
      prefs as TravelPrefs | undefined,
    )

    // Return the engine's output verbatim. The agent narrates these numbers.
    return {
      verdict: result.verdict, // 'use-points' | 'pay-cash' | 'none'
      pick: result.pick, // best redemption (or cheapest cash); carries cpp/miles/taxes/program
      summary: result.summary, // { cheapestCash, bestMiles, bestCpp, saveVsCash }
      options: result.options, // ranked, trimmed list shown to the user
      degraded: result.degraded, // sections that failed upstream — say so plainly
    }
  },
})
