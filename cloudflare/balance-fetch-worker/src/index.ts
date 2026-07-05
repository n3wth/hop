// hop balance-fetch Worker — the credential-sync fetch leg (see
// docs/plans/2026-07-05-credential-sync.md in the main repo).
//
// Receives POST /fetch { program, username, password } from the app's
// balance-autosync cron (Bearer-secret authed), signs in to the program's
// loyalty site with Cloudflare Browser Rendering, and returns the dashboard's
// visible TEXT. It computes NOTHING: the app runs the same extraction + clamp
// pipeline over this text as the paste/email rails, so a balance still has to
// appear in the page text before it can be trusted.
//
// Credentials are used only for the single automated login and never stored or
// logged here. Programs without a recipe return { ok:false, reason:'unsupported' }
// so the app can mark the row unsupported rather than retrying forever.
//
// This is the deliberately-thin, honest version: real anti-bot evasion (proxies,
// CAPTCHA solving, per-issuer MFA handling) is out of scope — a program that
// blocks the login returns a truthful failure the user sees on /account.

import puppeteer from '@cloudflare/puppeteer'

export interface Env {
  BROWSER: Fetcher
  HOP_BALANCE_FETCH_SECRET: string
}

// Per-program login recipe: where to go, how to fill the form, and what to read.
// Keyed on the app's canonical program id (lib/programs.ts). Start small and
// honest — add a recipe only after it's verified against the live site.
interface Recipe {
  loginUrl: string
  userSel: string
  passSel: string
  submitSel: string
  readySel: string // an element that only appears once signed in
}

const RECIPES: Record<string, Recipe> = {
  // Intentionally empty until a recipe is verified end-to-end against the live
  // site. An unknown program returns 'unsupported' below — the app shows that
  // state honestly instead of pretending sync works everywhere.
}

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

// Constant-time-ish Bearer check. Workers lack node:crypto.timingSafeEqual by
// default; a length-plus-accumulator compare is adequate for a shared secret.
function authorized(header: string | null, secret: string): boolean {
  if (!secret || !header || !header.startsWith('Bearer ')) return false
  const got = header.slice('Bearer '.length)
  if (got.length !== secret.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ secret.charCodeAt(i)
  return diff === 0
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/fetch') {
      return json({ ok: false, reason: 'not found' }, 404)
    }
    if (!authorized(request.headers.get('authorization'), env.HOP_BALANCE_FETCH_SECRET)) {
      return json({ ok: false, reason: 'unauthorized' }, 401)
    }

    let body: { program?: unknown; username?: unknown; password?: unknown }
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, reason: 'bad json' }, 400)
    }
    const program = typeof body.program === 'string' ? body.program : ''
    const username = typeof body.username === 'string' ? body.username : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!program || !username || !password) {
      return json({ ok: false, reason: 'missing fields' }, 400)
    }

    const recipe = RECIPES[program]
    if (!recipe) return json({ ok: false, reason: 'unsupported' })

    let browser
    try {
      browser = await puppeteer.launch(env.BROWSER)
      const page = await browser.newPage()
      await page.goto(recipe.loginUrl, { waitUntil: 'networkidle0', timeout: 45_000 })
      await page.type(recipe.userSel, username, { delay: 20 })
      await page.type(recipe.passSel, password, { delay: 20 })
      await Promise.all([
        page.click(recipe.submitSel),
        page.waitForSelector(recipe.readySel, { timeout: 30_000 }),
      ])
      const text = (await page.evaluate(() => document.body.innerText)) as string
      return json({ ok: true, text: text.slice(0, 20_000) })
    } catch (err) {
      const reason = err instanceof Error ? err.message.slice(0, 100) : 'login failed'
      return json({ ok: false, reason })
    } finally {
      if (browser) await browser.close()
    }
  },
}
