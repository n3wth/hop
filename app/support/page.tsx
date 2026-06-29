import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import LegalShell from '@/components/LegalShell'

export const metadata = {
  title: 'Support · hop',
  description: 'Help with adding points, cash-vs-miles, bookings, and your account.',
}

export default async function SupportPage() {
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

  let pointsTotal: number | undefined
  if (user && su?.sub) {
    const real = await getUserBalances(su.sub)
    if (real.length > 0) pointsTotal = real.reduce((s, b) => s + b.balance, 0)
  }

  return (
    <AppShell user={user} pointsTotal={pointsTotal} hideSearch>
      <LegalShell
        eyebrow="Support"
        title="Help center"
        intro="Quick answers to the things people ask most. Can't find it? Email us — a real person reads it."
      >
        <h2>Getting started</h2>

        <h3>How do I add my points?</h3>
        <p>
          Go to your <Link href="/account">account</Link> and add each loyalty program with its
          current balance. You can type balances in by hand, or connect{' '}
          <strong>AwardWallet</strong> to sync them automatically. Manual entries are always under
          your control — edit or remove them any time.
        </p>

        <h3>How does hop decide cash vs. miles?</h3>
        <p>
          For each option hop computes <strong>cents per point</strong> (CPP): how much real value
          each mile pulls in that redemption. Higher is better. When the value clears our
          &ldquo;great&rdquo; threshold, points usually win; when it&rsquo;s low, cash is the
          smarter buy. The full method is on{' '}
          <Link href="/values">How we value points</Link>. The figures are informational, not
          financial advice — always confirm with the airline before booking.
        </p>

        <h3>Why does hop deep-link to the airline for award bookings?</h3>
        <p>
          Award (points) tickets are issued by the airline&rsquo;s own loyalty program, so hop sends
          you to the airline&rsquo;s site to complete the redemption directly with them under their
          terms. hop doesn&rsquo;t process award bookings. For paid (cash) flights, hop facilitates
          the booking in-app via Duffel.
        </p>

        <h2>Managing your account</h2>

        <h3>How do I change my home airport?</h3>
        <p>
          Open your <Link href="/account">account</Link> and update your home airport. New searches
          will default to it.
        </p>

        <h3>How do I disconnect AwardWallet?</h3>
        <p>
          In your <Link href="/account">account</Link>, revoke the AwardWallet connection. hop stops
          syncing balances from it immediately. Any balances you entered manually stay until you
          remove them.
        </p>

        <h3>How do I delete my account?</h3>
        <p>
          You can request deletion from your <Link href="/account">account</Link> or by emailing
          us. See the <Link href="/privacy">Privacy Policy</Link> for what gets removed.
        </p>

        <h2>Bookings &amp; payments</h2>

        <h3>I have a problem with a booking — who do I contact?</h3>
        <p>
          For <strong>cash bookings</strong> made through hop, the airline is the provider and the
          booking is processed via Duffel. Have your booking reference ready and contact the airline
          for changes, cancellations, or disruptions; you can also reach us and we&rsquo;ll help
          point you to the right place. For <strong>award bookings</strong>, you booked directly on
          the airline&rsquo;s site, so contact the airline&rsquo;s loyalty program.
        </p>

        <h3>The price or availability changed — why?</h3>
        <p>
          Fares, taxes, and award availability come from third parties and the airlines, and can
          change at any time before you book. hop shows the best information it has, but the
          provider&rsquo;s live price at checkout is the real one.
        </p>

        <h2>Contact us</h2>
        <p>
          Still stuck? Email{' '}
          <a href="mailto:support@hop.n3wth.com">support@hop.n3wth.com</a>{' '}
          <strong>[BRACKETED: confirm support email]</strong>. Include your account email and, for
          booking issues, the booking reference — it helps us help you faster.
        </p>
      </LegalShell>
      <div className="mx-auto max-w-[1180px]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
