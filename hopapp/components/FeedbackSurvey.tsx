'use client'

import { useState, useCallback } from 'react'
import { usePostHog } from 'posthog-js/react'

const RATINGS = [
  { value: 1, label: '😞' },
  { value: 2, label: '😐' },
  { value: 3, label: '🙂' },
  { value: 4, label: '😊' },
  { value: 5, label: '🤩' },
]

interface FeedbackSurveyProps {
  /** Optional context — what page/surface the feedback is about. */
  context?: string
  /** Compact inline mode (no card chrome). */
  compact?: boolean
}

export default function FeedbackSurvey({
  context = 'page',
  compact = false,
}: FeedbackSurveyProps) {
  const posthog = usePostHog()
  const [rating, setRating] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const submit = useCallback(() => {
    if (rating == null) return
    posthog?.capture('feedback_submitted', {
      rating,
      note: note.trim() || null,
      context,
      url: typeof window !== 'undefined' ? window.location.pathname : '',
    })
    setSubmitted(true)
  }, [posthog, rating, note, context])

  if (submitted) {
    return (
      <div className="text-center text-[13px] text-text2">
        Thanks for your feedback.
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-text3">Was this helpful?</span>
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-label={`Rate ${r.value}`}
            onClick={() => {
              setRating(r.value)
              posthog?.capture('feedback_submitted', {
                rating: r.value,
                note: null,
                context,
                url: typeof window !== 'undefined' ? window.location.pathname : '',
              })
              setSubmitted(true)
            }}
            className="hop-interactive grid h-7 w-7 place-items-center rounded-full text-[15px] leading-none hover:bg-sunk"
          >
            {r.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="rounded-[16px] border border-border bg-paper p-5">
      <div className="mb-3 text-[14px] font-semibold text-text">
        How was your experience?
      </div>
      <div className="mb-4 flex items-center gap-1.5">
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            aria-label={`Rate ${r.value}`}
            onClick={() => setRating(r.value)}
            className={`hop-interactive grid h-10 w-10 place-items-center rounded-full text-[20px] leading-none transition-all ${
              rating === r.value
                ? 'bg-brand-light ring-1 ring-brand'
                : 'hover:bg-sunk'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
      {rating != null && (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything else you'd like to share? (optional)"
            rows={2}
            className="mb-3 w-full resize-none rounded-[10px] border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none placeholder:text-text3 focus:border-brand"
          />
          <button
            type="button"
            onClick={submit}
            className="hop-interactive hop-press rounded-full bg-brand px-5 py-2 text-[13px] font-semibold text-white hover:bg-brand-deep"
          >
            Send feedback
          </button>
        </>
      )}
    </div>
  )
}
