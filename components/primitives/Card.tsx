import { ReactNode } from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'paper' | 'surface' | 'sunk'
  children: ReactNode
}

export default function Card({
  variant = 'paper',
  className = '',
  ...props
}: CardProps) {
  const baseClasses = 'rounded-[12px]'

  const variantClasses = {
    paper: 'bg-paper border border-border',
    surface: 'bg-surface border border-border',
    sunk: 'bg-sunk',
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  )
}
