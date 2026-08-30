import { Badge, type BadgeVariant } from '@astryxdesign/core/Badge'
import { CppTier } from '@/lib/types';

export const TIER_CLASS: Record<string, string> = {
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

// hop's three cpp tiers, mapped onto Astryx's non-semantic (tinted, not
// solid-loud) categorical Badge variants — the closest match to the
// original's soft `bg-*-bg text-*` pill look. The colors themselves come
// from lib/astryx-theme.ts's --color-background-green/-yellow/-orange and
// --color-text-green/-yellow/-orange token overrides (mapped onto hop's own
// good/ok/weak tokens), not from this file.
const TIER_VARIANT: Record<CppTier, BadgeVariant> = {
  green: 'green',
  amber: 'yellow',
  muted: 'orange',
};

interface TierChipProps {
  cpp: number;
  className?: string;
}

// Thin wrapper over Astryx's Badge — see components/ui/Chip.tsx's comment:
// currently unreferenced (call sites read the TIER_* maps above directly),
// kept for prop-API parity with the original hand-rolled component.
export function TierChip({ cpp, className }: TierChipProps) {
  if (!isFinite(cpp)) return null;

  // Derive tier internally
  const tierKey: CppTier = cpp >= 3.0 ? 'green' : cpp >= 1.5 ? 'amber' : 'muted';

  return (
    <Badge variant={TIER_VARIANT[tierKey]} label={TIER_WORD[tierKey]} className={className} />
  );
}
