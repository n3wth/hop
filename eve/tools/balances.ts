// balances — the user's real loyalty holdings. Wraps lib/accounts.getUserBalances,
// the ONE resolver every hop surface uses: it merges MANUAL programs (Supabase
// hop_manual_balances, the primary path) with an optional AwardWallet live link
// (hop_user_accounts), de-duped by program code (AwardWallet wins where it covers,
// manual fills the rest).
//
// Never throws; returns [] when the user has connected nothing yet — that empty
// state is real and the agent should treat it as "no programs yet," NOT fall back
// to fabricated balances. This is the ground truth the agent personalizes from.

import { defineTool } from 'eve/tools'
import { z } from 'zod'
import { getUserBalances } from '../../lib/accounts'

export default defineTool({
  name: 'balances',
  description:
    "Get the user's real loyalty-point balances (manual programs merged with their AwardWallet link, de-duped by program). Returns an empty list when they've connected nothing yet — treat that as a genuine empty state, never invent balances. Use this to ground every personalized quote.",
  inputSchema: z.object({
    userId: z.string().describe('Auth0 sub of the user whose balances to resolve.'),
  }),
  async execute({ userId }) {
    const balances = await getUserBalances(userId)
    const totalPoints = balances.reduce((sum, b) => sum + b.balance, 0)
    // The agent reads these; it never edits or invents them.
    return { balances, totalPoints, connected: balances.length > 0 }
  },
})
