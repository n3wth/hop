'use client'

// AI Elements — Conversation (themed for hop).
// Adopts the official AI Elements <Conversation> family and its real auto-scroll
// engine (use-stick-to-bottom — the same library the upstream component uses), so
// new turns and streaming text keep the view pinned to the bottom while letting
// the user scroll up to read history. Restyled to hop's flat house style: no
// shadows/translucency; the scroll-to-bottom affordance is a solid brand pill
// whose only hover change is color. The StickToBottom smoothing respects the
// user's motion settings via the library; our button adds no extra motion.

import type { ComponentProps } from 'react'
import { useCallback } from 'react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'
import Icon from '../Icon'

export type ConversationProps = ComponentProps<typeof StickToBottom>

export function Conversation({ className = '', ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={`relative flex-1 overflow-y-auto ${className}`}
      initial="smooth"
      resize="smooth"
      role="log"
      {...props}
    />
  )
}

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>

export function ConversationContent({ className = '', ...props }: ConversationContentProps) {
  return <StickToBottom.Content className={`flex flex-col gap-8 ${className}`} {...props} />
}

export type ConversationScrollButtonProps = ComponentProps<'button'>

// Appears only when the user has scrolled away from the bottom; taps back down.
// Flat solid brand pill, color-only hover, no lift.
export function ConversationScrollButton({ className = '', ...props }: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  const onClick = useCallback(() => {
    void scrollToBottom()
  }, [scrollToBottom])

  if (isAtBottom) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Scroll to latest"
      className={`absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-brand-deep ${className}`}
      {...props}
    >
      <Icon name="expand_more" size={16} />
      Latest
    </button>
  )
}

export default Conversation
