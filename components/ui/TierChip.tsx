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

interface TierChipProps {
  cpp: number;
  className?: string;
}

export function TierChip({ cpp, className }: TierChipProps) {
  if (!isFinite(cpp)) return null;

  // Derive tier internally
  const tierKey: CppTier = cpp >= 3.0 ? 'green' : cpp >= 1.5 ? 'amber' : 'muted';

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIER_CLASS[tierKey]} ${className}`}>
      {TIER_WORD[tierKey]}
    </span>
  );
}
