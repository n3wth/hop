import Link from 'next/link'

// A door into the concierge from the structured search form, for the
// questions a route/date picker can't answer ("where can I go", "what's the
// best redemption this month"). Same seed-prompt set as docs/content-plan.md
// §5 (the /ask suggested-prompt chips), trimmed to the three most relevant to
// someone who landed on /search without a route in mind yet.
const SEED_PROMPTS = [
  'Where can I go right now with the points I have?',
  "What's the best value flight I can book with my points this month?",
  'Where can I fly business class for the fewest points?',
]

export default function SearchAskChips() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
      <span className="text-[13px] text-text3">Or ask hop —</span>
      {SEED_PROMPTS.map((q) => (
        <Link
          key={q}
          href={`/ask?q=${encodeURIComponent(q)}`}
          className="rounded-full border border-border bg-paper px-3.5 py-[7px] text-[13px] font-medium text-text2 transition-colors hover:border-brand hover:text-text"
        >
          {q}
        </Link>
      ))}
    </div>
  )
}
