// Award facade — the only import site for assembleSearch and /api/awards.
// Stage A: published charts. seats.aero is stub-disabled and is not a branch.

import type { ApiResult, FlightOption, SearchParams } from '@/lib/types'
import { quoteChart } from '@/lib/award-charts'

export async function searchAwards(
  params: SearchParams,
): Promise<ApiResult<FlightOption[]>> {
  return quoteChart(params)
}
