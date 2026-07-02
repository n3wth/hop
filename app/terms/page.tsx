import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import LegalShell from '@/components/LegalShell'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Terms of Service',
  description: 'The terms that govern your use of hop, the points-vs-cash flight tool.',
  path: '/terms',
})

export default async function TermsPage() {
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
        eyebrow="Legal"
        title="Terms of Service"
        intro="These terms govern your use of hop. By using the service you agree to them. Please read them carefully."
        lastUpdated="June 29, 2026"
      >
        <h2>1. Acceptance of terms</h2>
        <p>
          By accessing or using hop (the &ldquo;Service&rdquo;), you agree to be bound by these
          Terms of Service. If you do not agree, do not use the Service. The Service is operated
          by <strong>hop Travel, Inc.</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;,
          &ldquo;hop&rdquo;).
        </p>

        <h2>2. What hop is</h2>
        <p>
          hop is an information and booking-facilitation tool. It helps you compare paying for
          flights with cash versus redeeming airline miles and points, surfaces award
          &ldquo;sweet spots&rdquo;, and lets you record the loyalty balances you choose to track.
          hop is <strong>not</strong> an airline, travel agent of record for award tickets, or a
          travel provider. We do not own, operate, or control the flights, fares, or loyalty
          programs we display.
        </p>

        <h2>3. Information accuracy &amp; no advice</h2>
        <p>
          Flight prices, award availability, taxes, fees, and the cents-per-point
          &ldquo;verdict&rdquo; we show are drawn from third-party sources and from your own
          inputs. They can be incomplete, out of date, or wrong, and can change at any time before
          you book. Our cents-per-point figures and any &ldquo;verdict&rdquo; are{' '}
          <strong>informational only and are not financial, travel, or tax advice</strong>. You are
          responsible for confirming all details with the airline or provider before you transact.
        </p>

        <h2>4. Third-party services</h2>
        <p>
          The Service relies on third parties, including (among others) Duffel (flight search and
          cash booking), airlines and their loyalty programs, seats.aero (award availability),
          AwardWallet (optional loyalty-balance sync), Google (sign-in), Neon (data storage),
          and Unsplash (destination imagery). Your use of those services is also subject to their
          own terms and privacy policies. We are not responsible for third-party services and do
          not guarantee their availability or accuracy.
        </p>

        <h2>5. Bookings &amp; payments</h2>
        <p>
          <strong>Cash bookings.</strong> When you book a paid flight through hop, the booking is
          facilitated via Duffel and fulfilled by the airline or travel provider. Your payment card
          is collected and processed by Duffel&rsquo;s hosted payment component; hop does not store
          your full card details. The airline&rsquo;s and Duffel&rsquo;s terms, fare rules, and
          conditions of carriage apply to your ticket.
        </p>
        <p>
          <strong>Award (points) bookings.</strong> hop does not process award bookings. For
          redemptions, hop deep-links you out to the airline&rsquo;s own website, where you
          complete the booking directly with the airline under its terms. hop is not a party to
          that transaction.
        </p>

        <h2>6. Cancellations &amp; changes</h2>
        <p>
          Cancellations, changes, refunds, schedule changes, and disruptions are governed by the
          rules of the airline or travel provider and, for cash bookings, by Duffel. hop does not
          set or control those rules. Where we can help direct or surface a request we will, but
          the provider is the final authority on your ticket.
        </p>

        <h2>7. Your responsibilities</h2>
        <ul>
          <li>Provide accurate information, including any loyalty balances you enter manually.</li>
          <li>Verify fares, availability, taxes, and rules with the provider before booking.</li>
          <li>Comply with the terms of the airlines and loyalty programs you use.</li>
          <li>Use the Service lawfully and not attempt to disrupt or scrape it.</li>
        </ul>

        <h2>8. Accounts</h2>
        <p>
          Sign-in is provided through Google. You are responsible for activity under your account
          and for keeping your credentials secure. You may delete your account; see our{' '}
          <Link href="/privacy">Privacy Policy</Link> for what that removes.
        </p>

        <h2>9. Intellectual property</h2>
        <p>
          The Service, including its design, text, and branding, is owned by us or our licensors
          and is protected by applicable law. Airline names, loyalty-program names, and imagery
          belong to their respective owners and are used for identification only. You may not copy
          or reuse the Service except as permitted by these terms.
        </p>

        <h2>10. Disclaimers &amp; limitation of liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
          warranties of any kind to the extent permitted by law. To the maximum extent permitted by
          law, we are not liable for any indirect, incidental, or consequential damages, or for
          losses arising from inaccurate information, third-party services, or bookings made with
          airlines or providers. Our total liability for any claim relating to the Service is
          limited to the greater of the amounts you paid us in the twelve months before the claim
          or US$100. Nothing in these terms limits liability that cannot be limited by law.
        </p>

        <h2>11. Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be reflected by
          updating the &ldquo;Last updated&rdquo; date above. Continued use after changes take
          effect constitutes acceptance.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These terms are governed by the laws of the State of Delaware, USA, without regard to
          conflict-of-law rules. Any dispute will be resolved in the state or federal courts
          located in Delaware, and you consent to their jurisdiction and venue.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about these terms? Email{' '}
          <a href="mailto:support@hop.flights">support@hop.flights</a>.
        </p>
      </LegalShell>
      <div className="mx-auto max-w-[var(--container-shell)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
