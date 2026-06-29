'use client'

// AI Elements — Suggestion (themed for hop).
// Adopts the official <Suggestions> (a horizontal, scrollable row) and
// <Suggestion suggestion onClick> contract verbatim, so follow-up chips behave
// exactly like upstream. Restyled to hop: flat brand-tint pills whose only hover
// change is color (no lift). Used for the follow-up row — "Compare these",
// "Cheaper", "Best weather", "When's cheapest".

import type { ComponentProps } from 'react'

export type SuggestionsProps = ComponentProps<'div'>

export function Suggestions({ className = '', children, ...props }: SuggestionsProps) {
  return (
    <div className={`-mx-1 overflow-x-auto px-1 ${className}`} {...props}>
      <div className="flex w-max flex-nowrap items-center gap-2">{children}</div>
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
      className={`flex-shrink-0 rounded-full border border-border bg-paper px-3.5 py-1.5 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand ${className}`}
      {...props}
    >
      {children || suggestion}
    </button>
  )
}

export default Suggestion
