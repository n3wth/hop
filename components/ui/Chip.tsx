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

export function Chip({ children, tone = 'neutral', className }: ChipProps) {
  const toneClass = tone === 'brand' ? 'bg-brand text-white' : 'bg-surface text-text';
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${toneClass} ${className}`}>
      {children}
    </span>
  );
}
