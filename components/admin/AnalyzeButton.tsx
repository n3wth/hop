'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/app/actions/admin-analysis'

interface Props {
  label: string
  run: () => Promise<AnalysisResult>
}

// On-demand "Analyze" — owner clicks, one LLM call narrates the section's
// already-computed data (app/actions/admin-analysis.ts), result renders
// inline. No standing cost: nothing runs until clicked. Mirrors the
// plain-useState pending/error pattern SupportConsole.tsx already uses for
// its owner actions.
export default function AnalyzeButton({ label, run }: Props) {
  const [pending, setPending] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [err, setErr] = useState('')

  async function onClick() {
    setPending(true)
    setErr('')
    const result = await run()
    setPending(false)
    if (result.ok) {
      setText(result.text)
    } else {
      setErr(result.error)
    }
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="text-[12px] font-semibold text-brand transition-colors hover:text-text disabled:opacity-50"
      >
        {pending ? `Analyzing ${label}…` : `Analyze ${label}`}
      </button>
      {text ? (
        <p className="mt-2 rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5 text-[13px] leading-[1.5] text-text2">
          {text}
        </p>
      ) : null}
      {err ? <p className="mt-2 text-[12px] text-weak">{err}</p> : null}
    </div>
  )
}
