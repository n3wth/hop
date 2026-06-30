import Link from 'next/link'
import Logo from './Logo'
import Icon from './Icon'

export interface EmptyStateProps {
  /** "SFO → LAX" — echoed back so the message feels specific. */
  route?: string
  /** Origin/destination codes — used to reconstruct a real "adjust" link
      back into the search with the same route pre-filled. */
  fromCode?: string
  toCode?: string
}

// Calm empty state for when no flights/awards come back. The bunny + a plain
// message + an adjust affordance — never a blank panel. Sits inside the "Other
// ways to fly" section in place of the cards.
export default function EmptyState({ route, fromCode, toCode }: EmptyStateProps) {
  // Reconstruct a real search link with the same route pre-filled so the CTA
  // lands on an editable search instead of a dead "#". Falls back to /search.
  const params = new URLSearchParams()
  if (fromCode) params.set('from', fromCode)
  if (toCode) params.set('to', toCode)
  const href = params.toString() ? `/search?${params.toString()}` : '/search'

  return (
    <div className="flex flex-col items-center rounded-[20px] border-[1.5px] border-dashed border-border bg-paper px-8 py-[58px] text-center">
      <div className="hop-float grid place-items-center opacity-90">
        <Logo size={84} carve="var(--color-paper)" className="text-brand" />
      </div>

      <h2 className="mt-6 font-display text-[22px] font-semibold tracking-[-0.01em] text-text">
        No flights found{route ? ` for ${route}` : ''}.
      </h2>
      <p className="mt-2 max-w-[42ch] text-[14px] leading-[1.55] text-text2">
        Nothing came back for these dates. Try shifting your travel days or
        loosening the route — there&apos;s usually a better window nearby.
      </p>

      <Link
        href={href}
        className="mt-7 inline-flex items-center gap-[8px] rounded-[12px] border-[1.5px] border-text px-[20px] py-[12px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
      >
        <Icon name="search" size={16} />
        Adjust your search
      </Link>
    </div>
  )
}
