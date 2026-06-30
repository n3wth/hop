import { ReactNode } from 'react'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses =
    'rounded-[12px] font-medium transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed'

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-[13px]',
    md: 'px-4 py-2 text-[14px]',
    lg: 'px-6 py-3 text-[15px]',
  }

  const variantClasses = {
    primary:
      'bg-brand text-white hover:bg-brand-deep active:bg-brand-ink',
    secondary:
      'bg-paper text-text border border-border hover:bg-sunk active:bg-cream-warm',
    outline:
      'border-[1.5px] border-brand text-brand hover:bg-brand-light active:bg-brand-mint-deep',
  }

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
