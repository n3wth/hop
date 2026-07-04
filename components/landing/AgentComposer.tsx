'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ConciergeHero, { type ConciergeHeroPhoto } from '@/components/ConciergeHero'
import { conciergeHeroCopy } from '@/lib/concierge-hero'

// The agent front door, on the HOME. A teaser of the SAME conversational hero
// that lives on /ask — one visual language, one voice (lib/concierge-hero +
// <ConciergeHero>), so tapping a chip here and landing in /ask reads as one
// continuous motion, not a re-introduction.
//
// On submit it opens the conversation in /ask?q=… (the concierge auto-asks
// there and collapses straight to the thread — no second hero). Talking to hop
// is the PRIMARY action on the home; search/destinations come after.
//
// One component, two voices via `variant`:
//   • 'in'  — signed-in: warm, personal, grounded in the member's real points.
//   • 'out' — signed-out: the marketing promise; submit takes them into the
//             agent, which routes through sign-in when they go to act.
export default function AgentComposer({
  variant,
  first,
  totalPoints,
  backdrop,
  headingTag,
}: {
  variant: 'in' | 'out'
  /** Signed-in member's first name, for the greeting. */
  first?: string
  /** Total usable points — grounds the signed-in prompt copy when present. */
  totalPoints?: number
  /** Optional photographic backdrop, matching the /ask hero imagery. */
  backdrop?: ConciergeHeroPhoto
  /** Heading level — 'h2' where another element owns the page's h1 (the
   *  signed-out home, where the verdict hero leads). Defaults to h1. */
  headingTag?: 'h1' | 'h2'
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const signedIn = variant === 'in'

  function go(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`)
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    go(value)
  }

  const copy = conciergeHeroCopy({
    signedIn,
    first: signedIn ? first : undefined,
    totalPoints: signedIn ? totalPoints : undefined,
  })

  return (
    <ConciergeHero
      copy={copy}
      value={value}
      onValueChange={setValue}
      onSubmit={onSubmit}
      onChip={go}
      density="teaser"
      signedIn={signedIn}
      photos={backdrop ? [backdrop] : []}
      headingTag={headingTag}
    />
  )
}
