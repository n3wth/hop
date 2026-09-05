import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { toNavUser } from '@/lib/nav-user'
import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs, type UserPrefs } from '@/lib/prefs'
import { isGmailHistoryEnabled } from '@/lib/env'
import { ORIGIN_STORAGE_KEY } from '@/lib/origin-constants'
import { pageMeta } from '@/lib/seo'
import AppShell from '@/components/AppShell'
import Concierge, { type ConciergePhoto, type ConciergeInitialMessage } from '@/components/Concierge'
import { destinations, topValue, imageQuery } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import { getConversation } from '@/lib/conversations'

// Self-contained metadata: Next 16 merges metadata shallowly across layout →
// page, so we restate a route-specific canonical + OG/Twitter card (via the
// shared pageMeta helper) rather than inherit the homepage social card. The
// description states the verdict intent — points or cash, which one wins.
export const metadata: Metadata = pageMeta({
  title: 'Ask hop',
  description:
    'Name a destination or describe the trip. hop reads published saver charts and cash for the same route and tells you which one wins.',
  path: '/ask',
})

// /ask — hop's AI concierge. An immersive, app-like front door for "where should
// I go with my points?". The Concierge panel owns the hero state (a warm focal
// prompt, prominent input, evocative chips, and a backdrop of destination
// photography). Auth-aware: when signed in we ground the answer in the user's
// real total points (live AwardWallet, mock fixtures otherwise). The page never
// crashes if balances can't load — the concierge simply answers untethered.
export default async function AskPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  // A home composer can deep-link here with ?q=… to start the conversation
  // immediately. searchParams is a Promise in Next 16.
  const sp = await searchParams
  const rawQ = sp.q
  const initialQuery =
    typeof rawQ === 'string' ? rawQ : Array.isArray(rawQ) ? rawQ[0] : undefined

  const session = await auth0.getSession()
  const su = session?.user
  const user = toNavUser(su)

  // Persistent "where from" cookie — the origin the user set anywhere in the app.
  // It backs the concierge's departure airport when no saved home-airport pref
  // exists (and even when signed out), so recs stay anchored to where they fly.
  const cookieStore = await cookies()
  const cookieOrigin = cookieStore.get(ORIGIN_STORAGE_KEY)?.value?.trim().toUpperCase()
  const originFallback = cookieOrigin && /^[A-Z]{3}$/.test(cookieOrigin) ? cookieOrigin : undefined

  // Context for the concierge — the user's real points (total + per-program),
  // their home airport, resumed thread, and destination photography. These four
  // sources are all independent (keyed only on su?.sub, or nothing at all for
  // the photos) — fetched together so a signed-in visit to /ask is one round
  // trip instead of up to four sequential ones. Live when configured, mock
  // otherwise; only computed when signed in. Never crashes the page.
  const [real, prefs, persisted, imgs] = await Promise.all([
    su?.sub ? getUserBalances(su.sub) : Promise.resolve([]),
    su?.sub ? getPrefs(su.sub) : Promise.resolve({} as UserPrefs),
    su?.sub ? getConversation(su.sub) : Promise.resolve([]),
    destinationImages(destinations.map((d) => imageQuery(d))),
  ])

  let totalPoints: number | undefined
  let programs: { program: string; balance: number }[] | undefined
  let homeAirport: string | undefined = originFallback
  if (user) {
    // Unified per-user balances (manual + AwardWallet, merged). Mock ONLY in
    // local dev (MOCK=1); a real user with no programs has none — the concierge
    // simply answers untethered rather than citing fabricated balances.
    const useMock = real.length === 0 && /^(1|true|yes)$/i.test(process.env.MOCK ?? '')
    const balances = real.length > 0 ? real : useMock ? mockBalances() : []
    totalPoints = balances.length > 0 ? balances.reduce((sum, b) => sum + b.balance, 0) : undefined
    programs = balances.map((b) => ({ program: b.program, balance: b.balance }))
    // Saved pref wins when present; otherwise keep the cookie origin fallback.
    homeAirport = prefs.homeAirport ?? originFallback
  }

  // Resume the signed-in user's persisted concierge thread so /ask picks up
  // where they left off (with a quiet "start over" in the UI). Signed-out users
  // get an empty thread (session-only memory). Never crashes the page.
  const initialMessages: ConciergeInitialMessage[] = su?.sub
    ? persisted
        .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
          m.role === 'user' || m.role === 'assistant',
        )
        .map((m) => ({ role: m.role, content: m.content }))
    : []

  // Destination photography for the mood gallery + suggestion cards. Fetched
  // server-side (keeps the Unsplash key off the client), cached per query.
  // Keyed by IATA code so the client can look up by suggestion / gallery code.
  const photos: Record<string, ConciergePhoto> = {}
  for (const d of destinations) {
    const img = imgs[imageQuery(d)]
    if (img) {
      photos[d.code] = {
        thumb: img.thumb,
        alt: img.alt,
        city: d.city,
        country: d.country,
        countryCode: d.countryCode,
        credit: img.credit,
      }
    }
  }
  const galleryCodes = topValue(8).map((d) => d.code)

  // Whether the Gmail travel-history seam is live (env flag + Google creds). When
  // off, the in-chat / hero "Connect Gmail" affordances keep their honest "Soon"
  // state; when on, they become real (the /auth/gmail/start route self-gates too).
  const gmailEnabled = isGmailHistoryEnabled()

  // The concierge IS the page on /ask: it fills the full-viewport stage flush
  // under the sticky TopNav and IS the only scroll region — nothing is parked
  // below it. The empty state centers a calm greeting in the stage; the first
  // message swaps that middle for the streamed thread with the composer docked at
  // the floor throughout (zero layout jump). The expert-booking request ("Have hop
  // book it", roadmap §6 / N-290, Phase 1 — a manual concierge request, not
  // instant booking) is reachable from the control rail as a slide-up sheet ON the
  // surface, so it never needs a below-fold scroll. We pass the session email
  // (prefill) + live points (context for the human agent) through to that sheet.
  return (
    <AppShell user={user} pointsTotal={totalPoints} homeAirport={homeAirport} hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <Concierge
          totalPoints={totalPoints}
          programs={programs}
          homeAirport={homeAirport}
          photos={photos}
          galleryCodes={galleryCodes}
          signedIn={!!user}
          gmailEnabled={gmailEnabled}
          initialMessages={initialMessages}
          initialQuery={initialQuery}
          escalationEmail={user?.email}
        />
      </div>
    </AppShell>
  )
}
