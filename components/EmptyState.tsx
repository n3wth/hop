import Link from 'next/link'
import { EmptyState as AstryxEmptyState } from '@astryxdesign/core/EmptyState'
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
//
// Thin wrapper over Astryx's EmptyState: the dashed-border/paper-panel look
// is themed via lib/astryx-theme.ts's `components['empty-state']` override
// (Astryx only exposes the outer container to theme overrides, not the
// inner title/description elements — those pick up hop's heading font via
// the theme's `typography.heading` config instead of an exact px match to
// the original hand-rolled 22px title).
export default function EmptyState({ route, fromCode, toCode }: EmptyStateProps) {
  // Reconstruct a real search link with the same route pre-filled so the CTA
  // lands on an editable search instead of a dead "#". Falls back to /search.
  const params = new URLSearchParams()
  if (fromCode) params.set('from', fromCode)
  if (toCode) params.set('to', toCode)
  const href = params.toString() ? `/search?${params.toString()}` : '/search'

  return (
    <AstryxEmptyState
      icon={
        <div className="hop-float grid place-items-center opacity-90">
          <Logo size={84} carve="var(--color-paper)" className="text-brand" />
        </div>
      }
      headingLevel={2}
      title={`No flights found${route ? ` for ${route}` : ''}.`}
      description="Nothing came back for these dates. Try shifting your travel days or loosening the route — there's usually a better window nearby."
      actions={
        <Link
          href={href}
          className="inline-flex items-center gap-[8px] rounded-[12px] border-[1.5px] border-text px-[20px] py-[12px] text-[14px] font-semibold text-text transition-colors hover:bg-text hover:text-white"
        >
          <Icon name="search" size={16} />
          Adjust your search
        </Link>
      }
    />
  )
}
