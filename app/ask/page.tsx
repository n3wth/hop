import type { Metadata } from 'next'
import { auth0 } from '@/lib/auth0'
import { mockBalances } from '@/lib/mock'
import { getUserBalances } from '@/lib/accounts'
import { getPrefs } from '@/lib/prefs'
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
    'Tell hop a vibe, a budget, or a city. It reads award space and cash for the same trip and gives you the verdict — points or cash, which one wins.',
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
  const user = su
    ? {
        initial: (su.name ?? su.email ?? 'U').trim().charAt(0).toUpperCase(),
        name: su.name ?? su.email ?? undefined,
        email: su.email ?? undefined,
        picture: su.picture ?? undefined,
      }
    : null

  // Context for the concierge — the user's real points (total + per-program) and
  // their home airport (where realistic trips depart from). Live when configured,
  // mock otherwise; only computed when signed in. Never crashes the page.
  let totalPoints: number | undefined
  let programs: { program: string; balance: number }[] | undefined
  let homeAirport: string | undefined
  if (user) {
    // Unified per-user balances (manual + AwardWallet, merged). Mock ONLY in
    // local dev (MOCK=1); a real user with no programs has none — the concierge
    // simply answers untethered rather than citing fabricated balances.
    const real = su?.sub ? await getUserBalances(su.sub) : []
    const useMock = real.length === 0 && /^(1|true|yes)$/i.test(process.env.MOCK ?? '')
    const balances = real.length > 0 ? real : useMock ? mockBalances() : []
    totalPoints = balances.length > 0 ? balances.reduce((sum, b) => sum + b.balance, 0) : undefined
    programs = balances.map((b) => ({ program: b.program, balance: b.balance }))
    const prefs = su?.sub ? await getPrefs(su.sub) : {}
    homeAirport = prefs.homeAirport
  }

  // Resume the signed-in user's persisted concierge thread so /ask picks up
  // where they left off (with a quiet "start over" in the UI). Signed-out users
  // get an empty thread (session-only memory). Never crashes the page.
  let initialMessages: ConciergeInitialMessage[] = []
  if (su?.sub) {
    const persisted = await getConversation(su.sub)
    initialMessages = persisted
      .filter((m): m is { role: 'user' | 'assistant'; content: string } =>
        m.role === 'user' || m.role === 'assistant',
      )
      .map((m) => ({ role: m.role, content: m.content }))
  }

  // Destination photography for the mood gallery + suggestion cards. Fetched
  // server-side (keeps the Unsplash key off the client), cached per query.
  // Keyed by IATA code so the client can look up by suggestion / gallery code.
  const imgs = await destinationImages(destinations.map((d) => imageQuery(d)))
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
      }
    }
  }
  const galleryCodes = topValue(6).map((d) => d.code)

  // The concierge IS the page on /ask: a full-height immersive stage flush under
  // the sticky TopNav. The empty state shows the warm guided hero centered in the
  // stage; the first message turns the stage into the immersive thread (single
  // scroll region, pinned composer). No marketing footer competes with the chat —
  // the surface is the product. Concierge owns the per-state layout internally.
  return (
    <AppShell user={user} pointsTotal={totalPoints} hideSearch noPadX>
      <div className="hop-ask-stage flex flex-col">
        <Concierge
          totalPoints={totalPoints}
          programs={programs}
          homeAirport={homeAirport}
          photos={photos}
          galleryCodes={galleryCodes}
          signedIn={!!user}
          initialMessages={initialMessages}
          initialQuery={initialQuery}
        />
      </div>
    </AppShell>
  )
}
