// hop balance-sync Email Worker — the relay leg of the email rail (see
// docs/plans/2026-07-05-balance-sync.md in the main repo).
//
// Receives mail forwarded to a user's personal sync address
// (sync+<userId>.<sig>@hop.flights, minted by lib/balance-sync in the app),
// extracts a plain-text body, and relays it to the app's ingest endpoint with
// a shared Bearer secret. ALL intelligence lives server-side: the app verifies
// the address HMAC, runs extraction, and clamps every number against the
// email's own text — this Worker deliberately holds no logic that could drift
// from that single pipeline.
//
// Deploy notes (mirrors the valuations Worker flow):
//   1. wrangler secret put HOP_BALANCE_INGEST_SECRET   (same value as Vercel)
//   2. wrangler deploy
//   3. Cloudflare dashboard → Email Routing on the zone → enable, then set the
//      catch-all route (Email Routing has no `sync+*` wildcard) to this
//      Worker. Non-sync mail is dropped here without a relay call.

import PostalMime from 'postal-mime'

export interface Env {
  HOP_BALANCE_INGEST_URL: string
  HOP_BALANCE_INGEST_SECRET: string
}

// Keep parity with the app's MAX_SYNC_TEXT_CHARS — anything longer is noise.
const MAX_TEXT = 20_000

// Crude HTML → text for multipart mail without a text/plain part. Good enough:
// the server-side extractor tolerates messy input, and a lost balance is fine
// while a fabricated one is impossible (server clamp).
function htmlToText(html: string): string {
  return html
    .replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+/g, ' ')
}

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    // Catch-all delivers everything on the zone — only sync addresses relay.
    const to = (message.to ?? '').trim()
    if (!to.toLowerCase().startsWith('sync+')) return

    if (!env.HOP_BALANCE_INGEST_URL || !env.HOP_BALANCE_INGEST_SECRET) return

    ctx.waitUntil(
      (async () => {
        try {
          const parsed = await PostalMime.parse(message.raw)
          const text = (parsed.text ?? htmlToText(parsed.html ?? '')).slice(0, MAX_TEXT)
          await fetch(env.HOP_BALANCE_INGEST_URL, {
            method: 'POST',
            headers: {
              authorization: `Bearer ${env.HOP_BALANCE_INGEST_SECRET}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ to, subject: parsed.subject ?? '', text }),
          })
        } catch {
          // Fire-and-forget: a relay failure must never bounce the mail.
        }
      })(),
    )
  },
}
