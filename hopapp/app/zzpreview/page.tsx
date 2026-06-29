import AppShell from '@/components/AppShell'
import SiteFooter from '@/components/SiteFooter'
import SignedInHome from '@/components/landing/SignedInHome'
import { mockBalances } from '@/lib/mock'
import type { SearchState } from '@/components/SearchBar'

const SEED: SearchState = { from: 'SFO', to: 'JFK', depart: '2026-07-09', ret: '2026-07-12', adults: 1, oneWay: false }

export default function Preview() {
  const balances = mockBalances()
  const totalPoints = balances.reduce((s, b) => s + b.balance, 0)
  const user = { initial: 'O', name: 'Oliver Newth', email: 'oliver@newth.ai' }
  return (
    <AppShell user={user} pointsTotal={totalPoints} hideSearch>
      <div className="mx-auto max-w-[1180px]">
        <SignedInHome first="Oliver" programs={balances.length} totalPoints={totalPoints} seed={SEED} />
      </div>
      <div className="mx-auto max-w-[1180px]"><SiteFooter /></div>
    </AppShell>
  )
}
