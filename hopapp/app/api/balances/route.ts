// GET /api/balances — thin debugging handler for the AwardWallet client.

import { getBalances } from '@/lib/awardwallet'

export async function GET() {
  const result = await getBalances()
  return Response.json(result)
}
