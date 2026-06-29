'use client'

// AI Elements — Message (themed for hop).
// Adopts the official <Message from=...> / <MessageContent> structure (the
// `group .is-user` / `.is-assistant` convention that lets content style itself by
// role). Restyled to hop: USER turns are a compact brand-tint bubble aligned
// right; ASSISTANT turns are open prose led by hop's flying-bunny mark + label.
// Flat, solid surfaces — the brand-tint bubble is the only fill, no shadows.

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
      className={`group flex w-full flex-col gap-2 ${from === 'user' ? `${role} items-end` : role} ${className}`}
      {...props}
    />
  )
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>

export function MessageContent({ children, className = '', ...props }: MessageContentProps) {
  return (
    <div
      className={
        'flex w-fit min-w-0 max-w-full flex-col gap-2 text-[15px] ' +
        'group-[.is-user]:max-w-[88%] group-[.is-user]:rounded-[16px] group-[.is-user]:rounded-tr-[6px] group-[.is-user]:bg-brand-tint group-[.is-user]:px-4 group-[.is-user]:py-2.5 group-[.is-user]:text-text ' +
        'group-[.is-assistant]:w-full ' +
        className
      }
      {...props}
    >
      {children}
    </div>
  )
}

// The hop byline that precedes an assistant turn — the flying-bunny mark + label.
// Mirrors the official Message avatar slot, themed as hop's identity.
export function AssistantByline({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <FlyingBunny size={26} carve="var(--color-bg)" />
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">hop</span>
      {children}
    </div>
  )
}

export default Message
