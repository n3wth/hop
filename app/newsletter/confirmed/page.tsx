import Link from 'next/link'
import type { Metadata } from 'next'
import { getSessionNavUser } from '@/lib/nav-user'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'

// Private transactional landing page — keep it out of the index.
export const metadata: Metadata = {
  title: 'Confirm your subscription',
  robots: { index: false, follow: false },
}

// Landing page for GET /api/newsletter-signup/confirm's redirect. Copy is
// intentionally split from the signup form's success state: the form says
// "check your inbox" (nothing is confirmed yet), this page says "you're in"
// (the double opt-in actually completed).
export default async function NewsletterConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const q = await searchParams
  const ok = q.ok !== '0'
  const user = await getSessionNavUser()

  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto flex max-w-[var(--container-xs)] flex-col items-center gap-3 py-24 text-center">
        <Icon
          name={ok ? 'check_circle' : 'error'}
          size={24}
          weight="fill"
          className={ok ? 'text-brand' : 'text-weak'}
        />
        <h1 className="font-display text-[26px] font-semibold text-text">
          {ok ? "You're in." : "That link didn't work."}
        </h1>
        <p className="max-w-[40ch] text-[15px] leading-[1.55] text-text2">
          {ok
            ? "You'll get your wallet's best redemption once a week."
            : 'The confirmation link is invalid or already used — try joining again from the footer.'}
        </p>
        <Link href="/" className="mt-2 text-[14px] font-semibold text-brand hover:text-brand-deep">
          Back to hop
        </Link>
      </div>
    </AppShell>
  )
}
