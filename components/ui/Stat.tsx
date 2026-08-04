import React from 'react'

export interface StatProps {
  value: React.ReactNode
  label: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  align?: 'left' | 'center' | 'end'
  onDark?: boolean
  className?: string
}

export default function Stat({
  value,
  label,
  size = 'md',
  align = 'end',
  onDark = false,
  className = '',
}: StatProps) {
  const valueSizeClass = {
    sm: 'text-[15px]',
    md: 'text-[18px]',
    lg: 'text-[24px]',
  }[size]

  const alignClass = {
    left: 'items-start text-start',
    center: 'items-center text-center',
    end: 'items-end text-end',
  }[align]

  const valueColorClass = onDark ? 'text-white' : 'text-text'
  const labelColorClass = onDark ? 'text-hero-body' : 'text-text3'

  return (
    <div className={`flex flex-col leading-none ${alignClass} ${className}`}>
      <span className={`hop-num font-semibold ${valueSizeClass} ${valueColorClass}`}>
        {value}
      </span>
      <span className={`mt-[5px] text-[11px] uppercase tracking-[var(--track-label)] ${labelColorClass}`}>
        {label}
      </span>
    </div>
  )
}
