import Link from 'next/link'
import type { Metadata } from 'next'
import { getSessionNavUser } from '@/lib/nav-user'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'

// Private transactional landing page — keep it out of the index.
export const metadata: Metadata = {
  title: 'Unsubscribed',
  robots: { index: false, follow: false },
}

// Landing page for GET /api/newsletter-signup/unsubscribe's redirect. Always
// the same copy regardless of whether the token matched a real subscriber —
// the ROUTE deliberately ignores unsubscribeNewsletter's return value so a
// stale link can't be used to probe addresses (unsubscribeNewsletter itself
// does report the real match/no-match outcome now, for observability — see
// its comment in lib/newsletter.ts).
export default async function NewsletterUnsubscribedPage() {
  const user = await getSessionNavUser()

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto flex max-w-[var(--container-xs)] flex-col items-center gap-3 py-24 text-center">
        <Icon name="check_circle" size={24} weight="fill" className="text-brand" />
        <h1 className="font-display text-[26px] font-semibold text-text">You won&apos;t hear from us.</h1>
        <p className="max-w-[40ch] text-[15px] leading-[1.55] text-text2">
          You&apos;re off the weekly digest. You can rejoin any time from the footer.
        </p>
        <Link href="/" className="mt-2 text-[14px] font-semibold text-brand hover:text-brand-deep">
          Back to hop
        </Link>
      </div>
    </AppShell>
  )
}
