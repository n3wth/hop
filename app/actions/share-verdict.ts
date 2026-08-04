'use server'

import { headers } from 'next/headers'
import { getUserId } from '@/lib/session'
import { clientIpFromHeaders } from '@/lib/rate-limit'
import { shareVerdict as mintReceipt, type ShareVerdictReason } from '@/lib/shared-verdicts'
import { absoluteUrl } from '@/lib/seo'

// Server action behind the ShareVerdict button. Never trusts the client: the
// gate, rate limit, param validation, and the engine re-run all happen here
// (lib/shared-verdicts.ts#shareVerdict), keyed by the Better Auth user id when
// signed in, else the caller's IP (server actions get no Request — headers()
// from next/headers is the mechanically correct source; see
// lib/rate-limit.ts#clientIpFromHeaders).
export async function shareVerdict(
  raw: Record<string, string | undefined>,
): Promise<{ ok: true; url: string } | { ok: false; reason: ShareVerdictReason }> {
  const userId = await getUserId()
  const rateLimitKey = userId ?? clientIpFromHeaders(await headers())
  const result = await mintReceipt({ raw, rateLimitKey, createdBy: userId })
  if (!result.ok) return result
  return { ok: true, url: absoluteUrl(`/v/${result.id}`) }
}
