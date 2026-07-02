import type { FarePolicy, FareRule } from '@/lib/types'
import { describeFareRule } from '@/lib/booking'
import Icon, { type IconName } from '@/components/Icon'

// Flat "Change & cancellation" card for the booking + confirmation surfaces.
// States the fare's refund / change rules plainly (with any penalty) and a
// one-line pointer for making a change. When the airline gave no rules
// (`policy` undefined / both rules unstated), shows an honest "check at checkout"
// fallback rather than fabricating a policy. Server-safe (no client hooks).

// Pick an icon + token color for a rule. allowed → check (ok), not allowed →
// info (weak), unstated → info (muted text). Color is conveyed in text too, so
// this stays AA without relying on color alone.
function ruleVisual(rule: FareRule): { icon: IconName; tone: string } {
  if (rule.allowed === undefined) return { icon: 'info', tone: 'text-text3' }
  if (!rule.allowed) return { icon: 'info', tone: 'text-weak' }
  return { icon: 'check_circle', tone: 'text-ok' }
}

function Row({ rule, label }: { rule: FareRule; label: 'Refundable' | 'Changeable' }) {
  const { icon, tone } = ruleVisual(rule)
  return (
    <div className="flex items-start gap-2.5">
      <Icon name={icon} size={16} weight={icon === 'check_circle' ? 'fill' : 'regular'} className={`mt-px flex-shrink-0 ${tone}`} />
      <span className="text-[14px] leading-[1.45] text-text">{describeFareRule(rule, label)}</span>
    </div>
  )
}

export default function FarePolicyCard({
  policy,
  airline,
  className,
}: {
  policy?: FarePolicy
  airline?: string
  className?: string
}) {
  return (
    <section className={`rounded-[16px] border border-border bg-surface p-5 sm:p-6 ${className ?? ''}`}>
      <div className="mb-3.5 flex items-center gap-2">
        <Icon name="receipt_long" size={16} className="text-brand" />
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em] text-text">
          Change &amp; cancellation
        </h2>
      </div>

      {policy ? (
        <>
          <div className="space-y-2.5">
            <Row rule={policy.refundable} label="Refundable" />
            <Row rule={policy.changeable} label="Changeable" />
          </div>
          <p className="mt-4 border-t border-hair pt-3.5 text-[12px] leading-[1.5] text-text3">
            To change or cancel, contact {airline?.trim() || 'the airline'} or hop support. Penalties
            are set by the airline and shown above.
          </p>
        </>
      ) : (
        <p className="text-[14px] leading-[1.5] text-text2">
          Fare rules weren&apos;t provided for this fare. Check refund and change terms at checkout
          before you book.
        </p>
      )}
    </section>
  )
}
