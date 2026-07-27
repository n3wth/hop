'use client'

import type { ComponentProps, FormEvent, KeyboardEvent } from 'react'
import { useRef } from 'react'
import Icon from '../Icon'

export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error'

export type PromptInputProps = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

// Same shape as the home teaser's composer (components/ConciergeHero) — one
// search-box treatment everywhere it's shown: rounded-[16px], solid white,
// border only on focus.
export function PromptInput({ className = '', onSubmit, children, ...props }: PromptInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`flex items-end gap-2.5 rounded-[16px] border-2 border-transparent bg-surface px-4 py-2.5 transition-colors focus-within:border-brand ${className}`}
      {...props}
    >
      {children}
    </form>
  )
}

export type PromptInputTextareaProps = ComponentProps<'textarea'> & {
  onEnter?: () => void
}

export function PromptInputTextarea({
  className = '',
  onEnter,
  onKeyDown,
  onChange,
  rows = 1,
  ...props
}: PromptInputTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  function grow() {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e)
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      onEnter?.()
    }
  }

  return (
    <textarea
      ref={ref}
      rows={rows}
      onChange={(e) => {
        grow()
        onChange?.(e)
      }}
      onKeyDown={handleKeyDown}
      enterKeyHint="send"
      className={`no-inner-ring min-h-[28px] w-full flex-1 resize-none bg-transparent py-1 text-[16px] leading-[1.55] text-text outline-none placeholder:text-text3 ${className}`}
      {...props}
    />
  )
}

export type PromptInputSubmitProps = ComponentProps<'button'> & {
  status?: ChatStatus
  onStop?: () => void
}

export function PromptInputSubmit({
  status = 'ready',
  onStop,
  disabled,
  className = '',
  ...props
}: PromptInputSubmitProps) {
  const busy = status === 'streaming' || status === 'submitted'

  // Same pill treatment as the home teaser's "Ask hop →" button — labeled,
  // rounded-[12px], brand-filled. Busy state swaps the label for "Stop".
  if (busy) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop"
        className={`flex flex-shrink-0 items-center gap-1.5 self-end rounded-[12px] bg-brand-deep px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-ink ${className}`}
      >
        <Icon name="stop" size={12} weight="fill" />
        Stop
      </button>
    )
  }

  const isError = status === 'error'
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label={isError ? 'Try again' : 'Ask hop'}
      className={`flex flex-shrink-0 items-center gap-1.5 self-end rounded-[12px] bg-brand px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text3 ${className}`}
      {...props}
    >
      {isError ? 'Retry' : 'Ask hop'}
      <Icon name={isError ? 'refresh' : 'arrow_right'} size={16} />
    </button>
  )
}

export default PromptInput
