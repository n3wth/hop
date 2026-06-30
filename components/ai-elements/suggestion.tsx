'use client'

import type { ComponentProps } from 'react'

export type SuggestionsProps = ComponentProps<'div'>

// Wrapping flex row — chips wrap naturally on smaller viewports.
export function Suggestions({ className = '', children, ...props }: SuggestionsProps) {
  return (
    <div className={`${className}`} {...props}>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

export type SuggestionProps = Omit<ComponentProps<'button'>, 'onClick'> & {
  suggestion: string
  onClick?: (suggestion: string) => void
}

export function Suggestion({
  suggestion,
  onClick,
  className = '',
  children,
  ...props
}: SuggestionProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(suggestion)}
      className={`flex-shrink-0 rounded-full border border-border bg-paper px-3.5 py-1.5 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand disabled:pointer-events-none disabled:border-border-soft disabled:text-text3 ${className}`}
      {...props}
    >
      {children || suggestion}
    </button>
  )
}

export default Suggestion
