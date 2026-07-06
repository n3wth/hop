import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { auth0 } from '@/lib/auth0'
import { auth } from '@/lib/auth'
import { getUserId } from '@/lib/session'
import { getUserAwId, getManualBalances } from '@/lib/accounts'
import { safeReturnTo, returnToRouteLabel, loginHrefFor } from '@/lib/safe-return'
import { toNavUser } from '@/lib/nav-user'
import UserAvatarImage from '@/components/UserAvatarImage'
import { getBalances } from '@/lib/awardwallet'
import {
  hasEnv,
  isBalanceSyncEnabled,
  isBillingEnabled,
  isCredentialSyncEnabled,
  isCredentialAutosyncLive,
  isGmailHistoryEnabled,
  isEmailPasswordAuthEnabled,
  isPasskeyEnabled,
  isStandingOrdersCronLive,
  resolveAuthSecret,
} from '@/lib/env'
import { formatSyncAddress, getOrCreateSyncAlias, makeSyncAddress } from '@/lib/balance-sync'
import { listCredentials } from '@/lib/credential-vault'
import BalanceSyncPaste from '@/components/BalanceSyncPaste'
import ProgramLogins from '@/components/ProgramLogins'
import { getTravelHistory } from '@/lib/travel-history'
import { isGmailConnected } from '@/lib/travel-history-sync'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'
import SiteFooter from '@/components/SiteFooter'
import ProgramsManager from '@/components/ProgramsManager'
import AirlineStatusManager from '@/components/AirlineStatusManager'
import GmailHistory from '@/components/GmailHistory'
import McpAccess from '@/components/McpAccess'
import DeleteAccount from '@/components/DeleteAccount'
import { listTokens } from '@/lib/api-tokens'
import { getProfile } from '@/lib/travel-profile'
import { projectProfile } from '@/lib/memory-view'
import { listPendingInferredFacts } from '@/lib/inferred-facts'
import { listObservations } from '@/lib/memory-outcomes'
import MemoryKnows from '@/components/MemoryKnows'
import type { AirlineStatus, TravelProfile } from '@/lib/travel-profile-model'
import StandingOrders from '@/components/StandingOrders'
import Counterfactual from '@/components/Counterfactual'
import type { Balance } from '@/lib/types'
import { listStandingOrders, countActiveStandingOrders } from '@/lib/standing-orders'
import { listAlerts, countUnseenAlerts } from '@/lib/standing-order-alerts'
import { getUserTier, ALERT_LIMITS } from '@/lib/subscription'
import { BillingSection } from '@/components/BillingSection'
import SecurityPassword from '@/components/auth/SecurityPassword'
import SecurityPasskeys, { type PasskeyInfo } from '@/components/auth/SecurityPasskeys'

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

// The account page is private, per-user, and behind auth — keep it out of the
// index. (Crawlers redirect to login anyway, but say it plainly.)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Account / profile page. Auth-gated — anonymous visitors go to login. Shows the
// Auth0 profile + "Your programs" (manual balances, optional AwardWallet sync).
export default async function AccountPage({
  // Next.js 16: searchParams is async.
  searchParams,
}: {
  searchParams: Promise<{ aw?: string; gmail?: string; upgraded?: string; returnTo?: string }>
}) {
  // Query first: aw/gmail callback flags and an inbound returnTo survive the
  // login round-trip instead of dumping the visitor on a bare /account.
  const sp = await searchParams
  const session = await auth0.getSession()
  if (!session) redirect(loginHrefFor('/account', sp))

  const u = session.user
  const name = u.name ?? u.email ?? 'Traveler'
  const initial = name.trim().charAt(0).toUpperCase()
  // One construction for the header user everywhere (id for analytics
  // identify, Gravatar fallback for accounts without an IdP picture).
  // Non-null: the session redirect above guarantees u exists.
  const user = toNavUser(u)!

  // Manual programs (primary) + the optional AwardWallet link (only the id;
  // the live-balances CALL needs this id, so it stays a genuine dependency).
  const [manual, awId] = await Promise.all([
    u.sub ? getManualBalances(u.sub) : Promise.resolve([]),
    u.sub ? getUserAwId(u.sub) : Promise.resolve(null),
  ])
  const awConnected = !!awId
  const awUnconfigured = !hasEnv('AWARDWALLET_CONNECT_URL')
  // The scheduled runner only re-checks when its flag is on — surface that
  // honestly so the user knows whether watches are live yet.
  const cronLive = isStandingOrdersCronLive()
  const billingEnabled = isBillingEnabled()
  const gmailEnabled = isGmailHistoryEnabled()
  const balanceSyncEnabled = isBalanceSyncEnabled()
  const credentialSyncEnabled = isCredentialSyncEnabled()

  // Balance-sync surfaces (all flag-gated): the pretty forwarding address is
  // minted lazily, and credential logins load only when the vault is on.
  const [syncAlias, programLogins] = await Promise.all([
    balanceSyncEnabled && u.sub ? getOrCreateSyncAlias(u.sub) : Promise.resolve(null),
    credentialSyncEnabled && u.sub ? listCredentials(u.sub) : Promise.resolve([]),
  ])
  const syncAddress = syncAlias
    ? formatSyncAddress(syncAlias)
    : balanceSyncEnabled && u.sub
      ? makeSyncAddress(u.sub, resolveAuthSecret())
      : null

  // Five independent groups — the AwardWallet live-balances call (a real
  // third-party request, typically the slowest leg) and four Neon-backed
  // Promise.all groups — none reads another's output, so they run together
  // instead of the AwardWallet call blocking the rest from even starting.
  // Every group still degrades to its own empty/free fallback on failure.
  const [awResult, [orders, alerts, unseen], [tier, activeAlerts], [gmailState, travelHistory], [mcpTokens, profile, inferred, observed]] =
    await Promise.all([
      awConnected && awId
        ? getBalances(awId).catch(() => ({ ok: false as const, reason: 'request failed' }))
        : Promise.resolve(null),
      Promise.all([
        u.sub ? listStandingOrders(u.sub) : Promise.resolve([]),
        u.sub ? listAlerts(u.sub) : Promise.resolve([]),
        u.sub ? countUnseenAlerts(u.sub) : Promise.resolve(0),
      ]),
      billingEnabled
        ? Promise.all([
            u.sub ? getUserTier(u.sub) : Promise.resolve('free' as const),
            u.sub ? countActiveStandingOrders(u.sub) : Promise.resolve(0),
          ])
        : Promise.resolve(['free', 0] as const),
      Promise.all([
        u.sub ? isGmailConnected(u.sub) : Promise.resolve({ connected: false, email: null }),
        u.sub ? getTravelHistory(u.sub) : Promise.resolve(null),
      ]),
      Promise.all([
        u.sub ? listTokens(u.sub) : Promise.resolve([]),
        u.sub ? getProfile(u.sub) : Promise.resolve({} as TravelProfile),
        u.sub ? listPendingInferredFacts(u.sub) : Promise.resolve([]),
        u.sub ? listObservations(u.sub) : Promise.resolve([]),
      ]),
    ])

  let awBalances: Balance[] = []
  let awReason: string | undefined
  if (awResult) {
    if (awResult.ok) awBalances = awResult.data
    else awReason = awResult.reason
  }

  // Security section data — resolved via getUserId()/auth.api directly (not
  // the auth0 compat shim the rest of this file still reads through) per
  // CLAUDE.md's stated direction for new code. Independent of every group
  // above; degrades to "no password / no passkeys" on any failure rather than
  // breaking the page.
  const emailPasswordAuthEnabled = isEmailPasswordAuthEnabled()
  const passkeyAuthEnabled = isPasskeyEnabled()
  const [hasPassword, passkeys] = await (async () => {
    if (!emailPasswordAuthEnabled && !passkeyAuthEnabled) return [false, [] as PasskeyInfo[]] as const
    try {
      const requestHeaders = await headers()
      const securityUserId = await getUserId()
      if (!securityUserId) return [false, [] as PasskeyInfo[]] as const
      const [accounts, passkeyRows] = await Promise.all([
        emailPasswordAuthEnabled
          ? auth.api.listUserAccounts({ headers: requestHeaders }).catch(() => [])
          : Promise.resolve([]),
        passkeyAuthEnabled
          ? auth.api.listPasskeys({ headers: requestHeaders }).catch(() => [])
          : Promise.resolve([]),
      ])
      const hasCredentialAccount = accounts.some((a) => a.providerId === 'credential')
      return [hasCredentialAccount, passkeyRows as PasskeyInfo[]] as const
    } catch {
      return [false, [] as PasskeyInfo[]] as const
    }
  })()
  const airlineStatuses: AirlineStatus[] = profile.airlineStatuses ?? []

  // AwardWallet sync already carries elite tiers under Balance.status — surface
  // them as one-tap suggestions for the status editor (deduped by program; the
  // editor hides any the user already holds). Cash-currency "Transferable" notes
  // aren't elite tiers, so drop them.
  const statusSuggestions: AirlineStatus[] = (() => {
    const seen = new Set<string>()
    const out: AirlineStatus[] = []
    for (const b of awBalances) {
      const tier = b.status?.trim()
      if (!tier || tier.toLowerCase() === 'transferable') continue
      const key = b.program.trim().toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ program: b.program, tier })
    }
    return out
  })()

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

  const awFlag = sp.aw
  const awNote = awFlag ? AW_NOTES[awFlag] : undefined
  const gmailFlag = sp.gmail
  const gmailNote = gmailFlag ? GMAIL_NOTES[gmailFlag] : undefined
  // R1.1 activation bridge — the verdict CTA sends signed-in users here with
  // returnTo=<their exact search>. The banner link survives program-add (the
  // server action revalidates this same URL), so the way back is always one
  // tap and the search is never lost to the bounce.
  const returnTo = safeReturnTo(sp.returnTo)
  const returnRoute = returnTo ? returnToRouteLabel(returnTo) : null

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-shell)] pb-4 pt-8 sm:pt-12">
        {returnTo ? (
          <Link
            href={returnTo}
            className="mb-5 flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-brand bg-brand-tint px-5 py-4 transition-colors hover:border-brand-deep"
          >
            <span className="text-[14px] font-medium text-text">
              Add your programs, then pick up where you left off.
            </span>
            <span className="flex flex-shrink-0 items-center gap-[6px] text-[14px] font-semibold text-brand">
              Back to your {returnRoute ? `${returnRoute} ` : ''}search
              <span aria-hidden>→</span>
            </span>
          </Link>
        ) : null}
        {/* profile hero — teal plane, matches the editorial system */}
        <section
          className="overflow-hidden rounded-[var(--radius-lg)] text-hero-cream lg:rounded-[var(--radius-hero)]"
          style={{ background: 'var(--color-brand)' }}
        >
          <div className="flex flex-col gap-5 px-6 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-10">
            <span className="grid h-20 w-20 flex-shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 font-display text-[30px] font-semibold text-white ring-1 ring-white/20">
              {/* Same source chain as the nav avatar (picture → Gravatar →
                  initial), so the hero can never show a broken image. */}
              <UserAvatarImage
                picture={u.picture ?? undefined}
                email={u.email ?? undefined}
                initial={initial}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-hero-eyebrow">
                Your account
              </div>
              <h1 className="mt-1 truncate font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-white sm:text-[30px]">
                {name}
              </h1>
              {user.email && user.email !== name ? (
                <div className="mt-[3px] truncate text-[14px] text-hero-body">{user.email}</div>
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
            real IA so the power features (watches, what-if, trips, developer
            access) aren't reachable only by scrolling past everything.
            Color-only hover. */}
        <nav className="mt-8 flex flex-wrap gap-2 border-b border-hair pb-5">
          {[
            { href: '#knows', label: 'Knows you' },
            { href: '#programs', label: 'Programs' },
            { href: '#status', label: 'Status' },
            { href: '#trips', label: 'Trips' },
            { href: '#watches', label: 'Watches' },
            ...(billingEnabled ? [{ href: '#billing', label: 'Plan' }] : []),
            { href: '#whatif', label: 'What-if' },
            { href: '#security', label: 'Security' },
            { href: '#developers', label: 'Developers' },
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
        <div className="mt-12 flex flex-col gap-12 xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-16">
        {/* ── COLUMN A — GROUP 1 — YOUR TRAVEL PROFILE ───────────────────────
            What hop knows about you: the programs you hold and where you've
            flown. These describe your identity, so they sit together. */}
        <div>
        <div className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
          Your travel profile
        </div>

        {/* what hop knows — the glass box over the durable travel_profile. The
            trust foundation for hop's growing memory: see + forget what it holds. */}
        <section id="knows" className="mt-6 scroll-mt-24">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            What hop knows about you
          </h2>
          <p className="mt-1 text-[13.5px] leading-[1.5] text-text2">
            The durable facts hop remembers and uses to fit its answers to you.
            Forget anything you&apos;d rather it didn&apos;t keep.
          </p>
          <div className="mt-4">
            <MemoryKnows facts={projectProfile(profile)} noticed={inferred} observed={observed} />
          </div>
        </section>

        {/* your programs — manual balances (primary) + optional AwardWallet sync */}
        <section id="programs" className="mt-10 scroll-mt-24">
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
          {/* credential auto-sync (flag-gated) — hop signs in and reads your
              balance on a schedule; honest per-login status. */}
          {credentialSyncEnabled && u.sub ? (
            <div className="mt-4">
              <ProgramLogins logins={programLogins} autosyncLive={isCredentialAutosyncLive()} />
            </div>
          ) : null}
          {/* balance sync (flag-gated) — paste a statement / forward balance
              emails; the AwardWallet-independent syncing seam. */}
          {balanceSyncEnabled && u.sub ? (
            <div className="mt-4">
              <BalanceSyncPaste syncAddress={syncAddress} />
            </div>
          ) : null}
        </section>

        {/* elite status — the airline/hotel tiers the user holds. Sits with the
            travel profile: like programs, it's what hop knows about you, and the
            concierge reasons over it (lounge access, upgrades, free bags). */}
        <section id="status" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            Elite status
          </h2>
          <p className="mt-1 text-[13.5px] text-text2">
            Where you have status — so hop’s concierge factors lounges, upgrades,
            and free bags into its picks.
          </p>
          <AirlineStatusManager statuses={airlineStatuses} suggestions={statusSuggestions} />
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
        <div>

        {/* ── GROUP 2 — WHAT HOP DOES FOR YOU ────────────────────────────────
            The active tools: watch a route, or ask what a different stack would
            unlock. A larger gap above encodes the group break. */}
        <div className="text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
          What hop does for you
        </div>

        {/* standing orders — the verdict that watches */}
        <section id="watches" className="mt-6 scroll-mt-24">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              Standing orders
            </h2>
            <Link
              href="/search"
              className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
            >
              New search
            </Link>
          </div>
          <p className="mt-1 text-[13.5px] text-text2">
            Watch a route in plain English. hop re-runs its verdict on a schedule
            and tells you only when points beat cash on your terms.
          </p>
          <StandingOrders orders={orders} alerts={alerts} unseen={unseen} cronLive={cronLive} />
        </section>

        {/* plan / billing — flag-gated: absent entirely until HOP_ENABLE_BILLING
            + the Stripe keys are set. Sits with the watches it un-caps. Tier
            truth is the webhook-written row; ?upgraded=1 is display only. */}
        {billingEnabled ? (
          <BillingSection
            tier={tier}
            activeCount={activeAlerts}
            freeLimit={ALERT_LIMITS.free}
            upgraded={sp.upgraded === '1'}
            yearlyAvailable={hasEnv('STRIPE_PRICE_ID_PRO_YEARLY')}
          />
        ) : null}

        {/* counterfactual you — "what if I had a different points portfolio?" */}
        <section id="whatif" className="mt-10 scroll-mt-24">
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              What if…
            </h2>
            <p className="mt-1 text-[13.5px] text-text2">
              See what a different points stack would unlock.
            </p>
          </div>
          <Counterfactual programs={programBalances} />
        </section>

        {/* security — password + passkeys, for anyone who wants a way in that
            doesn't depend on Google. A mainstream concern (not power-user
            config), so it's its own top-level section, not folded into
            Developers below. */}
        <section id="security" className="mt-10 scroll-mt-24">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            Security
          </h2>
          <p className="mt-1 text-[13.5px] text-text2">
            Add a password or a passkey so you can sign in without Google.
          </p>
          <div className="mt-4 space-y-4">
            <SecurityPassword enabled={emailPasswordAuthEnabled} hasPassword={hasPassword} />
            <SecurityPasskeys enabled={passkeyAuthEnabled} passkeys={passkeys} />
          </div>
        </section>

        {/* ── GROUP 3 — DEVELOPERS ───────────────────────────────────────────
            Power-user plumbing. Collapsed by default so the heavy config block
            doesn't dominate the page for the common visitor (color-only summary,
            no motion — flat-design safe). */}
        <div
          id="developers"
          className="mt-14 scroll-mt-24 text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3"
        >
          Developers
        </div>

        {/* MCP access tokens (collapsed) */}
        <section id="mcp" className="mt-6 scroll-mt-24">
          <details className="group/mcp rounded-[var(--radius)] border border-border bg-surface">
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

        {/* Danger zone — the /privacy deletion promise, honored in-product. */}
        <DeleteAccount />
        </div>
        </div>

        <SiteFooter />
      </div>
    </AppShell>
  )
}
