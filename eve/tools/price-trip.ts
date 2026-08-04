// price_trip — one-glance destination economics. Wraps
// lib/concierge-tools.priceTrip: for a single hop destination (by IATA code) and
// the user's balances, it returns miles needed, typical cash, cpp (computeCpp),
// what the user effectively holds (direct OR via transfer), affordability, and a
// coarse points/cash/save verdict — all from hop's dataset + engine.
//
// This is the SAME deterministic helper the concierge's price_trip tool calls, on
// the SAME POINTS_THRESHOLD_CPP (2.5) line, so a proactive quote never contradicts
// the in-app one. ENGINE COMPUTES, AGENT NARRATES: never state a miles/cpp/
// affordability number you didn't get from here.
//
// Unknown codes return an { error } shape (not a throw) so the agent recovers
// gracefully instead of inventing a destination.

import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { priceTrip, type PriceTripBalance } from '../../lib/concierge-tools'
import { getUserBalances } from '../../lib/accounts'

export default defineTool({
  name: 'price_trip',
  description:
    "Quote hop's DETERMINISTIC points economics for one destination by IATA code: miles needed, cash, cents-per-point, what the user effectively has (direct or via transfer), affordability, and the points/cash/save verdict. ALWAYS call this before stating any miles, cpp, or affordability number for a destination. Pass userId to use the user's real balances.",
  inputSchema: z.object({
    code: z.string().length(3).describe('IATA code of a hop destination, e.g. "NRT" for Tokyo.'),
    userId: z
      .string()
      .optional()
      .describe("Better Auth user.id. When present, prices against the user's real balances."),
  }),
  async execute({ code, userId }) {
    // Map the shared Balance model to priceTrip's narrower input.
    const balances: PriceTripBalance[] = userId
      ? (await getUserBalances(userId)).map((b) => ({ program: b.program, balance: b.balance }))
      : []

    // Returns PriceTripResult OR { error, code } — both are safe to hand the model.
    return priceTrip(code, balances)
  },
})
