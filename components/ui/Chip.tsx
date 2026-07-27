import { Badge } from '@astryxdesign/core/Badge'
import { CppTier } from '@/lib/types';

export const TIER_CLASS: Record<CppTier, string> = {
  green: 'bg-good-bg text-good',
  amber: 'bg-ok-bg text-ok',
  muted: 'bg-weak-bg text-weak',
};

export const TIER_WORD: Record<CppTier, string> = {
  green: 'Excellent',
  amber: 'Good',
  muted: 'Fair',
};

export const TIER_BAR: Record<CppTier, string> = {
  green: 'bg-good',
  amber: 'bg-ok',
  muted: 'bg-weak',
};

interface ChipProps {
  children: React.ReactNode;
  tone?: 'brand' | 'neutral';
  className?: string;
}

// Thin wrapper over Astryx's Badge — kept for its prop API (tone, not
// Badge's `variant`), but currently unreferenced anywhere in the app; every
// call site reads the TIER_* maps above directly instead (see ResultRow.tsx,
// DealCard.tsx, DestinationSuggestions.tsx, DestinationGuideCard.tsx). Those
// maps are untouched by the Astryx port — they're plain Tailwind class
// strings other components compose into their own markup, not tied to this
// component's render path.
//
// `tone` isn't one of Astryx's own Badge variants (brand/neutral vs.
// Astryx's semantic/categorical vocabulary), so the two tones are painted
// directly via `style` (inline styles always win over Badge's own token-
// driven variant colors) rather than adding one-off theme variants for a
// component nothing currently renders.
export function Chip({ children, tone = 'neutral', className }: ChipProps) {
  const style =
    tone === 'brand'
      ? { backgroundColor: 'var(--color-brand)', color: '#ffffff' }
      : { backgroundColor: 'var(--color-surface)', color: 'var(--color-text)' }
  return (
    <Badge variant="neutral" label={children} style={style} className={className} />
  );
}
