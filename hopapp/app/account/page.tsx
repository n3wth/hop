import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import { getUserAwId, getManualBalances } from '@/lib/accounts'
import { getBalances } from '@/lib/awardwallet'
import { hasEnv } from '@/lib/env'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import ProgramsManager from '@/components/ProgramsManager'
import StandingOrders from '@/components/StandingOrders'
import Counterfactual from '@/components/Counterfactual'
import Icon from '@/components/Icon'
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

// Account / profile page. Auth-gated — anonymous visitors go to login. Shows the
// Auth0 profile + "Your programs" (manual balances, optional AwardWallet sync).
export default async function AccountPage({
  // Next.js 16: searchParams is async.
  searchParams,
}: {
  searchParams: Promise<{ aw?: string }>
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

  const awFlag = (await searchParams).aw
  const awNote = awFlag ? AW_NOTES[awFlag] : undefined

  return (
    <AppShell user={user}>
      <div className="mx-auto max-w-[820px] pb-4 pt-8 sm:pt-12">
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

        {/* your programs — manual balances (primary) + optional AwardWallet sync */}
        <section className="mt-10">
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

        {/* standing orders — the verdict that watches */}
        <section className="mt-10">
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
        <section className="mt-10">
          <div>
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              What if…
            </h2>
            <p className="mt-1 text-[13.5px] text-text2">
              Travel&apos;s first financial mirror — see what a different points stack would unlock.
            </p>
          </div>
          <Counterfactual />
        </section>

        {/* trips */}
        <section className="mt-10">
          <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
            Trips
          </h2>
          <EmptyCard
            icon="receipt_long"
            title="No trips yet"
            body="Flights you book through hop will show up here with their confirmation details."
          />
        </section>

        <SiteFooter />
      </div>
    </AppShell>
  )
}

// A calm, on-brand empty state — icon chip + title + one line. Not a blank box.
function EmptyCard({
  icon,
  title,
  body,
}: {
  icon: 'loyalty' | 'receipt_long'
  title: string
  body: string
}) {
  return (
    <div className="mt-4 flex items-start gap-4 rounded-[16px] border border-border bg-surface px-6 py-7">
      <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
        <Icon name={icon} size={22} />
      </span>
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-text">{title}</div>
        <p className="mt-1 max-w-[52ch] text-[13.5px] leading-[1.55] text-text2">{body}</p>
      </div>
    </div>
  )
}
