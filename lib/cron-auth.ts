// Shared authorization for the app/api/cron/* routes. Vercel Cron sends
// `Authorization: Bearer ${CRON_SECRET}` when the secret is configured. With
// no secret the check fails CLOSED in production — an unset CRON_SECRET must
// not leave the cron endpoints publicly invocable — and stays open outside
// production so local/manual runs need no setup. Pure + total; reads
// process.env at call time so importing never throws.

export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}
