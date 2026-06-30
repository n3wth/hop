import { ReactNode } from 'react'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'good' | 'ok' | 'weak' | 'neutral'
  size?: 'sm' | 'md'
  children: ReactNode
}

export default function Badge({
  variant = 'neutral',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  const baseClasses = 'inline-flex items-center rounded-full font-medium'

  const sizeClasses = {
    sm: 'px-2 py-1 text-[12px]',
    md: 'px-3 py-1.5 text-[13px]',
  }

  const variantClasses = {
    good: 'bg-good-bg text-good',
    ok: 'bg-ok-bg text-ok',
    weak: 'bg-weak-bg text-weak',
    neutral: 'bg-cream-warm text-text',
  }

  return (
    <span
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
