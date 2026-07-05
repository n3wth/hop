'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CONCIERGE_PLACEHOLDER, conciergeChips } from '@/lib/concierge-hero'

// The signed-in hero's composer — the same conversation door as /ask, restyled
// for the cream canvas instead of ConciergeHero's teal photo panel. One voice:
// placeholder + chips come from lib/concierge-hero, so a chip tapped here is
// the same chip on /ask. Submit opens the conversation at /ask?q=….
export default function HeroAsk() {
  const router = useRouter()
  const [value, setValue] = useState('')

  function go(q: string) {
    const trimmed = q.trim()
    if (!trimmed) return
    router.push(`/ask?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          go(value)
        }}
      >
        <div className="flex items-center gap-2 rounded-[16px] border border-border bg-paper py-2 pl-5 pr-2 transition-colors focus-within:border-brand sm:gap-3 sm:py-2.5">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={CONCIERGE_PLACEHOLDER}
            aria-label="Tell hop where you want to go"
            enterKeyHint="go"
            className="no-inner-ring min-w-0 flex-1 bg-transparent py-1.5 text-[16px] font-medium text-text outline-none placeholder:font-normal placeholder:text-text3"
          />
          <button
            type="submit"
            aria-label="Ask hop"
            disabled={!value.trim()}
            className="hop-press flex flex-shrink-0 items-center gap-1.5 rounded-[12px] bg-brand px-5 py-2.5 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ask hop
            <span aria-hidden className="text-[15px] leading-none">→</span>
          </button>
        </div>
      </form>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {conciergeChips(true).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => go(p)}
            className="rounded-full border border-border bg-paper px-3.5 py-2 text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-brand"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
