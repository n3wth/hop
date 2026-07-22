import { FarePolicyCard } from 'hop'

export function RefundableWithFee() {
  return (
    <FarePolicyCard
      airline="United"
      policy={{
        refundable: { allowed: true, penaltyAmount: '100.00', penaltyCurrency: 'USD' },
        changeable: { allowed: true, penaltyAmount: '0.00', penaltyCurrency: 'USD' },
      }}
    />
  )
}

export function NonRefundable() {
  return (
    <FarePolicyCard
      airline="Delta"
      policy={{
        refundable: { allowed: false },
        changeable: { allowed: false },
      }}
    />
  )
}

export function Unstated() {
  return <FarePolicyCard airline="Spirit" />
}
