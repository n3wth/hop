import AppShell from '@/components/AppShell'
import LegalShellSkeleton from '@/components/LegalShellSkeleton'

// Route-level loading UI for /terms. The page resolves the Auth0 session +
// balances before it can render the header chip, so this fills the gap with
// the same LegalShell measure used by /support and /privacy.
export default function Loading() {
  return (
    <AppShell hideSearch>
      <div className="mx-auto max-w-[var(--container-sm)]">
        <LegalShellSkeleton />
      </div>
    </AppShell>
  )
}
