import React from 'react'

export interface EyebrowProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode
  onDark?: boolean
  as?: 'span' | 'div'
}

export default function Eyebrow({
  children,
  onDark = false,
  as: Component = 'span',
  className = '',
  ...props
}: EyebrowProps) {
  const colorClass = onDark ? 'text-hero-eyebrow' : 'text-text3'
  return (
    <Component
      className={`text-[11px] font-semibold uppercase tracking-[var(--track-eyebrow)] ${colorClass} ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
}
