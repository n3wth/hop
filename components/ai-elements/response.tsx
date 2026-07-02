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
      // Streamed words fade in softly (the ChatGPT feel) instead of popping in.
      // Streamdown only animates characters NEW to each render (it never
      // re-animates already-visible text), and the reduced-motion block in
      // globals.css forces these inline animations inert for users who opt out.
      animated={{ animation: 'fadeIn', sep: 'word', duration: 240 }}
      {...props}
    />
  )
}

export default Response
