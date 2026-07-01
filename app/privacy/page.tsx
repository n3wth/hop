import Link from 'next/link'
import { auth0 } from '@/lib/auth0'
import { getUserBalances } from '@/lib/accounts'
import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import LegalShell from '@/components/LegalShell'
import { pageMeta } from '@/lib/seo'

export const metadata = pageMeta({
  title: 'Privacy Policy',
  description: 'What data hop collects, how it is used, and the controls you have over it.',
  path: '/privacy',
})

export default async function PrivacyPage() {
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
        title="Privacy Policy"
        intro="This policy explains what data hop collects, why, who we share it with, and the controls you have."
        lastUpdated="June 29, 2026"
      >
        <h2>Who we are</h2>
        <p>
          hop is operated by <strong>hop Travel, Inc.</strong> For privacy questions, contact{' '}
          <a href="mailto:privacy@hop.flights">privacy@hop.flights</a>.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account &amp; profile.</strong> When you sign in via Auth0 we store your Auth0
            user identifier and basic profile fields it provides (such as name, email, and avatar).
          </li>
          <li>
            <strong>Home airport.</strong> The home airport you set, used to personalize search.
          </li>
          <li>
            <strong>Loyalty balances.</strong> Balances you enter manually, and — only if you
            choose to connect it — balances synced from AwardWallet.
          </li>
          <li>
            <strong>Saved searches.</strong> Searches you save so you can return to them.
          </li>
          <li>
            <strong>Bookings.</strong> Records of cash bookings you make through hop (such as
            itinerary and provider references).
          </li>
          <li>
            <strong>Payment details.</strong> For cash bookings, your card is collected and
            processed by Duffel&rsquo;s hosted payment component. hop does not receive or store your
            full card number.
          </li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To run the core service: compare cash vs. miles and show award sweet spots.</li>
          <li>To personalize results to your home airport and tracked balances.</li>
          <li>To facilitate cash bookings via Duffel and keep your booking records.</li>
          <li>To maintain your account, security, and sessions.</li>
        </ul>

        <h2>Third parties we share with</h2>
        <p>We rely on the following service providers to operate hop:</p>
        <ul>
          <li>
            <strong>Auth0</strong> — sign-in and identity.
          </li>
          <li>
            <strong>Supabase</strong> — database storage for your home airport, balances, saved
            searches, and bookings.
          </li>
          <li>
            <strong>Duffel</strong> — flight search and cash-booking processing, including payment.
          </li>
          <li>
            <strong>AwardWallet</strong> — optional loyalty-balance sync that you connect and can
            revoke. When connected, hop receives the balances it returns.
          </li>
          <li>
            <strong>Google (Gmail)</strong> — optional, explicit-consent connection so hop can learn
            from your past trips. We request read-only access and read only your
            travel-confirmation emails (a tight search). We store only the normalized trip facts
            (destination, month, airline, cabin, whether points were used) — never the emails
            themselves — and you can disconnect and delete them at any time.
          </li>
          <li>
            <strong>seats.aero</strong> — award availability data.
          </li>
          <li>
            <strong>Unsplash</strong> — destination imagery (image requests are made to Unsplash).
          </li>
        </ul>
        <p>
          We do not sell your personal data. Each provider processes data under its own terms and
          privacy policy.
        </p>

        <h2>Data retention</h2>
        <p>
          We keep your data while your account is active and as needed to provide the service. When
          you delete your account, we delete or anonymize the data we hold for you, except where we
          must retain records to meet legal, accounting, or fraud-prevention obligations. We delete
          most personal data within 30 days of account deletion; booking and transaction records
          are kept up to 7 years to meet accounting and legal obligations.
        </p>

        <h2>Your rights &amp; controls</h2>
        <ul>
          <li>
            <strong>Access and correction.</strong> View and edit your home airport, balances, and
            saved searches from your <Link href="/account">account</Link>.
          </li>
          <li>
            <strong>Disconnect AwardWallet.</strong> You can revoke the AwardWallet connection at
            any time from your <Link href="/account">account</Link>; we stop syncing balances from
            it.
          </li>
          <li>
            <strong>Disconnect Gmail.</strong> You can revoke Gmail access at any time from your{' '}
            <Link href="/account">account</Link>; we revoke our token with Google and delete the
            stored trips.
          </li>
          <li>
            <strong>Delete your account.</strong> You can request account deletion from your{' '}
            <Link href="/account">account</Link> or by emailing{' '}
            <a href="mailto:privacy@hop.flights">privacy@hop.flights</a>.
          </li>
        </ul>
        <p>
          Depending on where you live, you may have additional rights over your personal data. We
          honor applicable requests. To exercise a right, email{' '}
          <a href="mailto:privacy@hop.flights">privacy@hop.flights</a> and we will respond
          within 30 days.
        </p>

        <h2>Cookies</h2>
        <p>
          hop uses essential cookies needed to sign you in and keep your session active (set by
          Auth0 and Supabase). We do not run a third-party advertising or cross-site tracking
          stack.
        </p>

        <h2>Children</h2>
        <p>
          hop is not directed to children and is not intended for anyone under 16. We do not
          knowingly collect data from children under that age.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable technical and organizational measures to protect your data, and rely on
          established providers (Auth0, Supabase, Duffel) for sensitive operations. No method of
          storage or transmission is perfectly secure.
        </p>

        <h2>International transfers</h2>
        <p>
          Our providers may process and store data in countries other than yours. Where data is
          transferred internationally, we rely on the safeguards offered by those providers, such
          as the EU Standard Contractual Clauses.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          We may update this policy; material changes will be reflected by updating the
          &ldquo;Last updated&rdquo; date above.
        </p>

        <h2>Contact</h2>
        <p>
          Email <a href="mailto:privacy@hop.flights">privacy@hop.flights</a> with any privacy
          question or request.
        </p>
      </LegalShell>
      <div className="mx-auto max-w-[var(--container-app)]">
        <SiteFooter />
      </div>
    </AppShell>
  )
}
