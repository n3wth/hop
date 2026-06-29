import { redirect } from 'next/navigation'
import { auth0 } from '@/lib/auth0'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import Icon from '@/components/Icon'

// Account / profile page. Auth-gated — anonymous visitors go to login. Shows the
// Auth0 profile; saved searches + booking history (Supabase) land here next.
export default async function AccountPage() {
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
                Signed in
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
              className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-[12px] bg-white px-5 py-3 text-[14px] font-semibold text-[#073e3e] transition-colors hover:bg-[#fffdf6] sm:self-center"
            >
              Log out
            </a>
          </div>
        </section>

        {/* saved searches */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[18px] font-semibold tracking-[-0.01em] text-text">
              Saved searches
            </h2>
            <a
              href="/search"
              className="text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep"
            >
              New search
            </a>
          </div>
          <EmptyCard
            icon="loyalty"
            title="No saved searches yet"
            body="Save a route from the results page and hop will keep watching its value — we'll flag it when points beat cash."
          />
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
