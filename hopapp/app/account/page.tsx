import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { getUserAwId, getManualBalances } from '@/lib/accounts'
import { getBalances } from '@/lib/awardwallet'
import { hasEnv, isGmailHistoryEnabled } from '@/lib/env'
import { getTravelHistory } from '@/lib/travel-history'
import { isGmailConnected } from '@/lib/travel-history-sync'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'
import SiteFooter from '@/components/SiteFooter'
import ProgramsManager from '@/components/ProgramsManager'
import GmailHistory from '@/components/GmailHistory'
import McpAccess from '@/components/McpAccess'
import { listTokens } from '@/lib/api-tokens'
import StandingOrders from '@/components/StandingOrders'
import Counterfactual from '@/components/Counterfactual'
import type { Balance } from '@/lib/types'
import { listStandingOrders } from '@/lib/standing-orders'
import { listAlerts, countUnseenAlerts } from '@/lib/standing-order-alerts'

// Human-readable note for the AwardWallet handshake outcome (?aw=… flag the
// OAuth start/callback routes set on their redirect back to /account).
const AW_NOTES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  connected: { tone: 'ok', text: 'AwardWallet connected — your balances will auto-sync.' },
  unconfigured: { tone: 'warn', text: 'Auto-sync isn’t available yet. Add programs manually below.' },
  denied: { tone: 'warn', text: 'AwardWallet access was declined. You can add programs manually.' },
  state: { tone: 'warn', text: 'That connect link expired. Try connecting again.' },
  noid: { tone: 'warn', text: 'AwardWallet didn’t return an account. Try again.' },
  error: { tone: 'warn', text: 'Couldn’t finish connecting. Try again.' },
}

// Human-readable note for the Gmail handshake outcome (?gmail=… flag the Gmail
// OAuth start/callback routes set on their redirect back to /account).
const GMAIL_NOTES: Record<string, { tone: 'ok' | 'warn'; text: string }> = {
  connected: { tone: 'ok', text: 'Gmail connected — hop is learning from your past trips.' },
  unconfigured: { tone: 'warn', text: 'Gmail history isn’t available yet.' },
  denied: { tone: 'warn', text: 'Gmail access was declined. Nothing was read.' },
  state: { tone: 'warn', text: 'That connect link expired. Try connecting again.' },
  error: { tone: 'warn', text: 'Couldn’t finish connecting Gmail. Try again.' },
}

// Account / profile page. Auth-gated — anonymous visitors go to login. Shows the
// Auth0 profile + "Your programs" (manual balances, optional AwardWallet sync).
export default async function AccountPage({
  // Next.js 16: searchParams is async.
  searchParams,
}: {
  searchParams: Promise<{ aw?: string; gmail?: string }>
}) {
  const session = await auth0.getSession()
  if (!session) redirect('/auth/login')

  const u = session.user
  const name = u.name ?? u.email ?? 'Traveler'
  const initial = name.trim().charAt(0).toUpperCase()
  const user = {
    initial,
    name: u.name ?? undefined,
    email: u.email ?? undefined,
    picture: u.picture ?? undefined,
  }

  // Manual programs (primary) + the optional AwardWallet link (live balances).
  const [manual, awId] = await Promise.all([
    u.sub ? getManualBalances(u.sub) : Promise.resolve([]),
    u.sub ? getUserAwId(u.sub) : Promise.resolve(null),
  ])
  const awConnected = !!awId
  let awBalances: Balance[] = []
  let awReason: string | undefined
  if (awConnected && awId) {
    const res = await getBalances(awId).catch(() => ({
      ok: false as const,
      reason: 'request failed',
    }))
    if (res.ok) awBalances = res.data
    else awReason = res.reason
  }
  const awUnconfigured = !hasEnv('AWARDWALLET_CONNECT_URL')

  // Standing orders + the alerts the cron has recorded. Degrade to empty on any
  // failure (every lib fn is try/caught) so the page never breaks.
  const [orders, alerts, unseen] = await Promise.all([
    u.sub ? listStandingOrders(u.sub) : Promise.resolve([]),
    u.sub ? listAlerts(u.sub) : Promise.resolve([]),
    u.sub ? countUnseenAlerts(u.sub) : Promise.resolve(0),
  ])
  // The scheduled runner only re-checks when its flag is on — surface that
  // honestly so the user knows whether watches are live yet.
  const cronLive = /^(1|true|yes)$/i.test(process.env.STANDING_ORDERS_CRON_ENABLED ?? '')

  // Gmail travel-history seam: connection state + the trips hop has learned.
  // Both helpers degrade to empty/not-connected on any failure.
  const gmailEnabled = isGmailHistoryEnabled()
  const [gmailState, travelHistory] = await Promise.all([
    u.sub ? isGmailConnected(u.sub) : Promise.resolve({ connected: false, email: null }),
    u.sub ? getTravelHistory(u.sub) : Promise.resolve(null),
  ])
  // "Add to Claude" MCP tokens for this user (list = no secrets).
  const mcpTokens = u.sub ? await listTokens(u.sub) : []

  // Merged held programs (manual + AwardWallet) so Counterfactual's presets are
  // about THIS user's real stack — "+50k of your largest", a swap of their two
  // biggest holdings — instead of static programs they may not hold. Dedup by
  // program, keeping the larger balance.
  const programBalances = (() => {
    const m = new Map<string, { program: string; balance: number }>()
    for (const b of [...manual, ...awBalances]) {
      const cur = m.get(b.program)
      if (!cur || b.balance > cur.balance) m.set(b.program, { program: b.program, balance: b.balance })
    }
    return [...m.values()]
  })()

  const sp = await searchParams
  const awFlag = sp.aw
  const awNote = awFlag ? AW_NOTES[awFlag] : undefined
  const gmailFlag = sp.gmail
  const gmailNote = gmailFlag ? GMAIL_NOTES[gmailFlag] : undefined

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-[820px] pb-4 pt-8 sm:pt-12 xl:max-w-[1200px]">
        {/* profile hero — teal plane, matches the editorial system */}
        <section
          className="overflow-hidden rounded-[20px] text-[#eafaf7] lg:rounded-[24px]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-10">
            <span className="grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 font-display text-[30px] font-semibold text-white ring-1 ring-white/20">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.picture}
                  alt=""
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9fe0d6]">
                Your account
              </div>
              <h1 className="mt-1 truncate font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[30px]">
                {name}
              </h1>
              {user.email && user.email !== name ? (
                <div className="mt-[3px] truncate text-[14px] text-[#c7ece5]">{user.email}</div>
              ) : null}
            </div>
            <a
              href="/auth/logout"
              className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-[12px] border border-white/25 px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/10 sm:self-center"
            >
              Log out
            </a>
          </div>
        </section>

        {/* in-page nav — the account is long once populated; anchor jumps give it
            real IA so the power features (watches, what-if, trips, Claude) aren't
            reachable only by scrolling past everything. Color-only hover. */}
        <nav className="mt-8 flex flex-wrap gap-2 border-b border-hair pb-5">
          {[
            { href: '#programs', label: 'Programs' },
            { href: '#trips', label: 'Trips' },
            { href: '#watches', label: 'Watches' },
            { href: '#whatif', label: 'What-if' },
            { href: '#claude', label: 'Claude' },
          ].map((a) => (
            <a
              key={a.href}
              href={a.href}
              className="rounded-full border border-border bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:border-brand hover:text-brand"
            >
              {a.label}
            </a>
          ))}
        </nav>

        {/* On wide screens the groups sit side-by-side so the page fills the
            width and the power features aren't buried below a long scroll: left
            = what hop knows about you, right = what hop does + developer access.
            Below xl it collapses back to the single readable column. */}
        <div className="mt-12 grid grid-cols-1 items-start gap-x-12 xl:grid-cols-2">
        {/* ── COLUMN A — GROUP 1 — YOUR TRAVEL PROFILE ───────────────────────
            What hop knows about you: the programs you hold and where you've
            flown. These describe your identity, so they sit together. */}
        <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text3">
          Your travel profile
        </div>

        {/* your programs — manual balances (primary) + optional AwardWallet sync */}
        <section id="programs" className="mt-6 scroll-mt-24">
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              Your programs
            </h2>
            <p className="mt-1 text-[13.5px] text-text2">
              The points and miles hop uses to tell you when to pay with points instead of cash.
            </p>
          </div>
          {awNote ? (
            <p
              className={`mt-3 rounded-[12px] border px-4 py-2.5 text-[13px] font-medium ${
                awNote.tone === 'ok'
                  ? 'border-brand-light bg-brand-light text-brand-deep'
                  : 'border-border bg-sunk text-text2'
              }`}
            >
              {awNote.text}
            </p>
          ) : null}
          <ProgramsManager
            manual={manual}
            awConnected={awConnected}
            awBalances={awBalances}
            awReason={awReason}
            awUnconfigured={awUnconfigured}
          />
        </section>

        {/* trips — Gmail travel-history seam (explicit consent). Lives in the
            travel-profile group: like programs, it's what hop knows about you. */}
        <section id="trips" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            Trips
          </h2>
          <p className="mt-1 text-[13.5px] text-text2">
            Let hop learn from where you’ve flown — so its suggestions fit how you
            actually travel.
          </p>
          {gmailNote ? (
            <p
              className={`mt-3 rounded-[12px] border px-4 py-2.5 text-[13px] font-medium ${
                gmailNote.tone === 'ok'
                  ? 'border-brand-light bg-brand-light text-brand-deep'
                  : 'border-border bg-sunk text-text2'
              }`}
            >
              {gmailNote.text}
            </p>
          ) : null}
          <GmailHistory
            enabled={gmailEnabled}
            connected={gmailState.connected}
            email={gmailState.email}
            trips={travelHistory?.trips ?? []}
          />
        </section>
        </div>
        {/* ── COLUMN B — GROUP 2 + GROUP 3 ───────────────────────────────────
            What hop does for you, plus developer access. On xl this column sits
            beside the travel profile; below xl it stacks under it. */}
        <div className="mt-14 xl:mt-0">

        {/* ── GROUP 2 — WHAT HOP DOES FOR YOU ────────────────────────────────
            The active tools: watch a route, or ask what a different stack would
            unlock. A larger gap above encodes the group break. */}
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text3">
          What hop does for you
        </div>

        {/* standing orders — the verdict that watches */}
        <section id="watches" className="mt-6 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              Standing orders
            </h2>
            <a
              href="/search"
              className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
            >
              New search
            </a>
          </div>
          <p className="mt-1 text-[13.5px] text-text2">
            Watch a route in plain English. hop re-runs its verdict on a schedule
            and tells you only when points beat cash on your terms.
          </p>
          <StandingOrders orders={orders} alerts={alerts} unseen={unseen} cronLive={cronLive} />
        </section>

        {/* counterfactual you — "what if I had a different points portfolio?" */}
        <section id="whatif" className="mt-10 scroll-mt-24">
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              What if…
            </h2>
            <p className="mt-1 text-[13.5px] text-text2">
              Travel&apos;s first financial mirror — see what a different points stack would unlock.
            </p>
          </div>
          <Counterfactual programs={programBalances} />
        </section>

        {/* ── GROUP 3 — DEVELOPERS ───────────────────────────────────────────
            Power-user plumbing. Collapsed by default so the heavy config block
            doesn't dominate the page for the common visitor (color-only summary,
            no motion — flat-design safe). */}
        <div className="mt-14 text-[11px] font-semibold uppercase tracking-[0.18em] text-text3">
          Developers
        </div>

        {/* add to claude — MCP access tokens (collapsed) */}
        <section id="claude" className="mt-6 scroll-mt-24">
          <details className="group/mcp rounded-[16px] border border-border bg-surface">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-5 py-4 transition-colors hover:bg-sunk [&::-webkit-details-marker]:hidden">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
                  Use hop from Claude (MCP)
                </h2>
                <p className="mt-1 text-[13.5px] text-text2">
                  Mint a token to call hop&apos;s points-vs-cash engine from Claude or any
                  MCP client.
                </p>
              </div>
              <Icon
                name="expand_more"
                size={20}
                className="flex-shrink-0 text-text3 transition-transform group-open/mcp:rotate-180"
              />
            </summary>
            <div className="border-t border-hair px-5 py-5">
              <McpAccess initialTokens={mcpTokens} />
            </div>
          </details>
        </section>
        </div>
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
