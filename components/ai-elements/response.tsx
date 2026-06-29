'use client'

// AI Elements — Response (themed for hop).
// The official AI Elements <Response> renders streamed assistant markdown via
// Streamdown (handling incomplete-markdown gracefully mid-stream). We keep that
// exact behavior and contract — children is the markdown string — and apply
// hop's prose styling (the .hop-md scope + brand link/typography tokens). Flat,
// readable, no decorative chrome.

import type { ComponentProps } from 'react'
import { Streamdown } from 'streamdown'

export type ResponseProps = ComponentProps<typeof Streamdown>

export function Response({ className = '', ...props }: ResponseProps) {
  return (
    <Streamdown
      className={`hop-md text-[15px] leading-[1.7] text-text sm:text-[16px] ${className}`}
      parseIncompleteMarkdown
      {...props}
    />
  )
}

export default Response
