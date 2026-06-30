// standing_orders — "the verdict that watches." Lets the user (in any channel)
// set up, list, and pause a watch on a route+threshold. hop re-runs the UNCHANGED
// verdict engine on a schedule and alerts only when their verdict crosses the line.
//
// create wraps parseStandingOrder (NL → validated StandingOrderDraft) +
// createStandingOrder (persist). list/pause wrap the CRUD. The parser only
// TRANSLATES freeform text into a validated shape — it never invents economics; the
// draft is re-clamped (minCpp floored to 2.5, seats/programs bounded) before persist.
//
// These are the agent's only write tools besides deliver, and they only ever touch
// the calling user's own rows (every query is scoped by userId in code).

import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { parseStandingOrder } from '../../lib/standing-orders-parser'
import {
  createStandingOrder,
  listStandingOrders,
  setStandingOrderActive,
} from '../../lib/standing-orders'

// Create a watch from plain English. "watch SFO→NRT business above 4cpp, depart
// 2026-03-12" → parsed + validated draft → persisted. Returns the new watch id, or
// a reason it couldn't (no usable route/date → the agent asks for one).
export const createWatch = defineTool({
  name: 'create_standing_order',
  description:
    'Create a standing order (a watch) from the user\'s plain-English request, e.g. "watch SFO→NRT business above 4cpp departing 2026-03-12". Parses + validates the request (minCpp is floored to hop\'s 2.5 line), then persists it. If no usable route or departure date is found, returns ok:false with a reason — ask the user for the missing piece rather than guessing.',
  inputSchema: z.object({
    userId: z.string().describe('Auth0 sub of the owner.'),
    text: z.string().describe("The user's natural-language watch request."),
    homeAirport: z
      .string()
      .optional()
      .describe('Optional saved home IATA, used as the origin when the text names only a destination.'),
  }),
  async execute({ userId, text, homeAirport }) {
    const draft = await parseStandingOrder(text, {
      today: new Date().toISOString().slice(0, 10),
      homeAirport,
    })
    if (!draft) {
      return { ok: false as const, reason: 'no-usable-route-or-date' }
    }
    const id = await createStandingOrder(userId, draft)
    if (!id) return { ok: false as const, reason: 'not-saved-or-over-limit' }
    return { ok: true as const, id, draft }
  },
})

// List the user's watches, newest first (empty on any failure).
export const listWatches = defineTool({
  name: 'list_standing_orders',
  description: "List the user's standing orders (watches), newest first.",
  inputSchema: z.object({
    userId: z.string().describe('Auth0 sub of the owner.'),
  }),
  async execute({ userId }) {
    return { orders: await listStandingOrders(userId) }
  },
})

// Pause or resume a watch the user owns (scoped by id AND userId). A paused watch
// is kept but skipped by the sweep schedule.
export const pauseWatch = defineTool({
  name: 'pause_standing_order',
  description:
    'Pause or resume a standing order the user owns. Pausing keeps the watch but stops the sweep from running (or charging for) it.',
  inputSchema: z.object({
    userId: z.string().describe('Auth0 sub of the owner.'),
    id: z.string().describe('The watch id to update.'),
    active: z.boolean().describe('false = pause, true = resume.'),
  }),
  async execute({ userId, id, active }) {
    const ok = await setStandingOrderActive(userId, id, active)
    return { ok }
  },
})

export default [createWatch, listWatches, pauseWatch]
