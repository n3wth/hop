import AppShell from '@/components/AppShell'
import LegalShellSkeleton from '@/components/LegalShellSkeleton'
import { getSessionNavUser } from '@/lib/nav-user'

// Route-level loading UI for /privacy. The page resolves balances (pointsTotal)
// before it can render the header chip — that's still skipped here — but user
// (a cheap session read) is resolved so the avatar doesn't flip for signed-in
// visitors. Uses the same LegalShell measure as /support and /terms.
export default async function Loading() {
  const user = await getSessionNavUser()
  return (
    <AppShell user={user} hideSearch>
      <div className="mx-auto max-w-[var(--container-sm)]">
        <LegalShellSkeleton />
      </div>
    </AppShell>
  )
}
