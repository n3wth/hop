import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  surface?: 'paper' | 'surface' | 'sunk'
  radius?: 'sm' | 'md' | 'lg'
  interactive?: boolean
  as?: 'div' | 'section' | 'article' | 'li' | 'p'
  children: React.ReactNode
}

export default function Card({
  surface = 'surface',
  radius = 'md',
  interactive = false,
  as: Component = 'div',
  children,
  className = '',
  ...props
}: CardProps) {
  const bgClass = {
    paper: 'bg-paper',
    surface: 'bg-surface',
    sunk: 'bg-sunk',
  }[surface]

  const radiusClass = {
    sm: 'rounded-[var(--radius-sm)]',
    md: 'rounded-[var(--radius)]',
    lg: 'rounded-[var(--radius-lg)]',
  }[radius]

  const borderClass = 'border border-border'
  
  const interactiveClass = interactive
    ? 'hover:border-brand transition-colors duration-200 cursor-pointer'
    : ''

  return (
    <Component
      className={`${borderClass} ${bgClass} ${radiusClass} ${interactiveClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
