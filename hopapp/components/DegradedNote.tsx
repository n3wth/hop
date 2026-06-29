import Icon from './Icon'

export interface DegradedNoteProps {
  degraded: string[]
}

// Human label per failed source. Balances failing is silent (the wallet just
// shows what it has); cash/awards failing changes what we can compare, so we say.
const COPY: Record<string, string> = {
  awards: 'Award data is unavailable right now — showing cash only.',
  cash: 'Cash fares are unavailable right now — showing points only.',
  balances: 'Couldn’t refresh your balances just now — figures may be stale.',
}

// Subtle inline note when an upstream source failed. Calm amber tint, one line —
// surfaces the gap rather than silently dropping it. Renders nothing if every
// degraded source is one we don't message (or the list is empty).
export default function DegradedNote({ degraded }: DegradedNoteProps) {
  const messages = degraded.map((d) => COPY[d]).filter(Boolean)
  if (messages.length === 0) return null

  return (
    <div
      role="status"
      className="mt-[18px] flex items-start gap-[10px] rounded-[12px] border border-ok-bg bg-ok-bg/60 px-[16px] py-[11px] text-[13px] leading-[1.45] text-ok"
    >
      <span className="mt-[1px] flex-shrink-0">
        <Icon name="notifications" size={16} />
      </span>
      <span>{messages.join(' ')}</span>
    </div>
  )
}
