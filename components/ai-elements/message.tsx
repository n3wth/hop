'use client'

import type { HTMLAttributes, ReactNode } from 'react'
import FlyingBunny from '../FlyingBunny'

export type MessageRole = 'user' | 'assistant' | 'system'

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: MessageRole
}

export function Message({ className = '', from, ...props }: MessageProps) {
  const role = from === 'user' ? 'is-user' : 'is-assistant'
  return (
    <div
      className={`group flex w-full flex-col gap-2.5 ${from === 'user' ? `${role} items-end` : role} ${className}`}
      {...props}
    />
  )
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>

export function MessageContent({ children, className = '', ...props }: MessageContentProps) {
  return (
    <div
      className={
        'flex w-fit min-w-0 max-w-full flex-col gap-2.5 text-[15px] ' +
        // User: right-aligned bubble with rounded corners (flat top-right = tail)
        'group-[.is-user]:max-w-[80%] group-[.is-user]:rounded-[22px] group-[.is-user]:rounded-tr-[5px] group-[.is-user]:bg-brand-tint group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-text ' +
        // Assistant: full-width open prose
        'group-[.is-assistant]:w-full ' +
        className
      }
      {...props}
    >
      {children}
    </div>
  )
}

// The hop byline that precedes an assistant turn.
export function AssistantByline({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <FlyingBunny size={24} carve="var(--color-bg)" />
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">hop</span>
      {children}
    </div>
  )
}

export default Message
