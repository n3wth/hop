// Shared authorization for the app/api/cron/* routes. Vercel Cron sends
// `Authorization: Bearer ${CRON_SECRET}` when the secret is configured. With
// no secret the check fails CLOSED in production — an unset CRON_SECRET must
// not leave the cron endpoints publicly invocable — and stays open outside
// production so local/manual runs need no setup. Pure + total; reads
// process.env at call time so importing never throws.

import { timingSafeEqual } from 'node:crypto'

export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const expected = Buffer.from(`Bearer ${secret}`)
  const got = Buffer.from(request.headers.get('authorization') ?? '')
  // The length check may run in variable time; only the byte comparison needs
  // to be constant-time (timingSafeEqual throws on unequal lengths).
  return got.length === expected.length && timingSafeEqual(got, expected)
}
