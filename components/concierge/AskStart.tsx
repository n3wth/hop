'use client'

// AskStart — the /ask empty state, reimagined as a CALM CREAM editorial start.
//
// The concierge's front door used to be a full-bleed dark photographic hero (the
// shared <ConciergeHero> at density="full"). That read as a different app from
// the thread it collapses into. AskStart replaces it with a quiet, native start
// on the cream canvas that shares the thread's measure and chrome: a small brand
// eyebrow, a display heading, a one-line subhead, the SAME composer the thread
// uses (ai-elements/prompt-input — never a second forked input), one row of paper
// starter chips, and an optional slim destination strip that seeds a prompt on
// tap. Sending the first message swaps this for the streamed conversation.
//
// Flat + on-brand: paper elements on the cream canvas (so the paper composer and
// chips read as raised against the page), brand tokens, hover = color only, motion
// is reduced-motion-safe (.hop-rise is inert). No dark backdrop, no mood gallery.
// The heading/eyebrow/chips/placeholder come from lib/concierge-hero (one voice),
// so this start and the home teaser can never drift.

import { type FormEvent } from 'react'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
} from '../ai-elements/prompt-input'

// A slim destination tile — a small rounded thumbnail that seeds a starter prompt
// on tap. Serializable (the server already passes this shape down to Concierge).
export interface AskStartDestination {
  city: string
  thumb: string
  alt: string
  countryCode: string
}

export interface AskStartProps {
  /** Resolved copy from lib/concierge-hero (one source, shared with the home). */
  eyebrow: string
  heading: string
  /** The canonical subhead — for signed-in visitors this states their points
   *  number ("With ~40,000 points…"). Shared with the home so the two never drift. */
  sub: string
  placeholder: string
  chips: string[]
  /** Controlled composer value + setter (Concierge owns the state). */
  input: string
  setInput: (v: string) => void
  /** Submit the typed value (Concierge wires this to useChat). */
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  /** Send a starter/destination prompt straight through. */
  onStarter: (prompt: string) => void
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  /** Passed through to the shared composer (unreachable here — sending flips the
   *  surface to the thread — but wired for parity with the thread composer). */
  onStop?: () => void
  /** Optional quiet destination strip; omit for a chips-only start. */
  destinations?: AskStartDestination[]
}

export default function AskStart({
  eyebrow,
  heading,
  sub,
  placeholder,
  chips,
  input,
  setInput,
  onSubmit,
  onStarter,
  status,
  onStop,
  destinations = [],
}: AskStartProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
      <div
        className="hop-rise hop-ask-measure flex flex-col items-center text-center"
        style={{ ['--hop-delay' as string]: '40ms' }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand sm:text-[12px]">
          {eyebrow}
        </span>

        <h1 className="mt-4 font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.02em] text-text sm:text-[40px]">
          {heading}
        </h1>

        <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.6] text-text2 sm:text-[16px]">
          {sub}
        </p>

        {/* THE composer — the same ai-elements/prompt-input the thread pins to the
            floor (it IS the <form>, so no outer form wraps it), so the empty state
            and the conversation feel like one surface. */}
        <div className="mt-7 w-full max-w-[600px]">
          <PromptInput onSubmit={onSubmit}>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onEnter={() => onStarter(input)}
              placeholder={placeholder}
              aria-label="Tell hop where you want to go"
            />
            <PromptInputSubmit status={status} onStop={onStop} disabled={!input.trim()} />
          </PromptInput>
        </div>

        {/* one row of paper starter chips — the canonical concierge seed prompts. */}
        {chips.length ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => onStarter(chip)}
                className="hop-press rounded-full border border-border bg-paper px-4 py-2 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand"
              >
                {chip}
              </button>
            ))}
          </div>
        ) : null}

        {/* a quiet accent: a slim strip of paper destination thumbnails. Captions
            sit BELOW the photo (no scrim needed), keeping it flat and editorial.
            Tapping one seeds a starter prompt — inspiration, not a dark gallery. */}
        {destinations.length ? (
          <div className="mt-8 flex w-full flex-wrap justify-center gap-2.5">
            {destinations.map((d) => (
              <button
                key={d.city}
                type="button"
                onClick={() => onStarter(`Cheapest way to ${d.city}`)}
                aria-label={`Cheapest way to ${d.city}`}
                className="hop-press group flex w-[92px] flex-col overflow-hidden rounded-[var(--radius)] border border-border bg-paper transition-colors hover:border-brand"
              >
                <span className="block h-14 w-full overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={d.thumb}
                    alt=""
                    aria-hidden
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="flex items-center gap-1 px-2 py-1.5">
                  <span
                    className={`fi fi-${d.countryCode} h-[9px] w-[13px] flex-shrink-0 rounded-[1px]`}
                    aria-hidden
                  />
                  <span className="truncate text-[11px] font-medium text-text2 transition-colors group-hover:text-brand">
                    {d.city}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
