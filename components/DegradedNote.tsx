import Icon from './Icon'

export interface DegradedNoteProps {
  degraded: string[]
}

// Human label per failed source. 'balances' is only ever recorded when a
// signed-in user's OWN connected programs failed to refresh — a signed-out or
// no-program viewer has nothing to refresh, so empty is expected and this note
// never fires for them (see lib/search.ts). cash/awards failing changes what we
// can compare, so we always say.
const COPY: Record<string, string> = {
  awards: 'Award data is unavailable right now — showing cash only.',
  cash: 'Cash fares are unavailable right now — showing points only.',
  balances: 'Couldn’t refresh your balances just now — figures may be stale.',
}

// Subtle inline note when an upstream source failed. Calm neutral tint, one
// line — surfaces the gap rather than silently dropping it. Renders nothing
// if every degraded source is one we don't message (or the list is empty).
// Note: this is NOT a cpp value-tier signal, so it never uses the good/ok/weak
// tokens (those are reserved for cents-per-point classification) — it uses the
// same neutral border-border/bg-sunk treatment as other "heads up" notices.
export default function DegradedNote({ degraded }: DegradedNoteProps) {
  const messages = degraded.map((d) => COPY[d]).filter(Boolean)
  if (messages.length === 0) return null

  return (
    <div
      role="status"
      className="mt-[18px] flex items-start gap-[10px] rounded-[12px] border border-border bg-sunk px-[16px] py-[11px] text-[13px] leading-[1.45] text-text2"
    >
      <span className="mt-[1px] flex-shrink-0">
        <Icon name="notifications" size={16} />
      </span>
      <span>{messages.join(' ')}</span>
    </div>
  )
}
