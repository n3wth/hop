import AppShell from '@/components/AppShell'
import ResultsSkeleton from '@/components/ResultsSkeleton'

// Route-level loading UI. Next wraps page.js in a Suspense boundary with this as
// the fallback, so it shows immediately on navigation/search while the Server
// Component fetches (live APIs take ~3s). Reuses the real shell so only the
// results plane swaps in — the nav and frame stay put.
export default function Loading() {
  return (
    <AppShell
      from="San Francisco"
      to="Los Angeles"
      dates="Jul 9 – 12"
      who="1 adult"
      fromCode="SFO"
      toCode="LAX"
    >
      <ResultsSkeleton />
    </AppShell>
  )
}
