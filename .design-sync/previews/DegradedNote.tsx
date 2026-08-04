import { DegradedNote } from 'hop'

export function AwardsDown() {
  return <DegradedNote degraded={['awards']} />
}

export function CashDown() {
  return <DegradedNote degraded={['cash']} />
}

export function BothDown() {
  return <DegradedNote degraded={['cash', 'awards']} />
}

export function BalancesStale() {
  return <DegradedNote degraded={['balances']} />
}
