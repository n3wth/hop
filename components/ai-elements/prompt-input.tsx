'use client'

// AI Elements — PromptInput (themed for hop).
// Adopts the official AI Elements composer structure and behavior — a form that
// owns the input value, an auto-growing textarea where Enter submits and
// Shift+Enter inserts a newline, and a submit control that reflects the chat
// status (ready → send, streaming/submitted → stop, error → retry). Restyled to
// hop's flat house style: a solid surface that gets a brand border on focus, a
// solid brand send button with color-only hover. This is the persistent composer
// that anchors the conversation.

import type { ComponentProps, FormEvent, KeyboardEvent } from 'react'
import { useRef } from 'react'
import Icon from '../Icon'
import { Loader } from './loader'

// Mirrors the AI SDK ChatStatus union used by useChat().status.
export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error'

export type PromptInputProps = Omit<ComponentProps<'form'>, 'onSubmit'> & {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
}

export function PromptInput({ className = '', onSubmit, children, ...props }: PromptInputProps) {
  return (
    <form
      onSubmit={onSubmit}
      className={`flex items-end gap-2 rounded-[16px] border-[1.5px] border-border bg-paper px-3 py-2 transition-colors focus-within:border-brand sm:gap-3 sm:px-3.5 ${className}`}
      {...props}
    >
      {children}
    </form>
  )
}

export type PromptInputTextareaProps = ComponentProps<'textarea'> & {
  // Called when the user presses Enter (without Shift). The parent submits.
  onEnter?: () => void
}

// Auto-growing textarea. Enter submits; Shift+Enter is a newline. Caps growth so
// the composer never dominates the viewport.
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
      className={`min-h-[24px] w-full flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-[1.5] text-text outline-none placeholder:text-text3 ${className}`}
      {...props}
    />
  )
}

export type PromptInputSubmitProps = ComponentProps<'button'> & {
  status?: ChatStatus
  onStop?: () => void
}

// The composer's primary action. ready → "Ask hop" (send); streaming/submitted →
// "Stop" (square); error → retry. Disabled-empty falls back to ready styling.
export function PromptInputSubmit({
  status = 'ready',
  onStop,
  disabled,
  className = '',
  ...props
}: PromptInputSubmitProps) {
  const busy = status === 'streaming' || status === 'submitted'

  if (busy) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop"
        className={`mb-0.5 flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-deep px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-ink ${className}`}
      >
        <Loader size={15} />
        <span className="hidden sm:inline">Stop</span>
      </button>
    )
  }

  const isError = status === 'error'
  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label={isError ? 'Try again' : 'Ask hop'}
      className={`mb-0.5 flex flex-shrink-0 items-center gap-1.5 rounded-full bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-border disabled:text-text3 ${className}`}
      {...props}
    >
      <span className="hidden sm:inline">{isError ? 'Try again' : 'Ask hop'}</span>
      <Icon name={isError ? 'info' : 'flight'} size={16} className={isError ? '' : 'rotate-90'} />
    </button>
  )
}

export default PromptInput
