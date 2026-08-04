'use client'

import { useState, useMemo, useCallback } from 'react'
import { useChat } from '@ai-sdk/react'
import { ConciergeTransport, type HopUIMessage, type ConciergeRequestContext } from '@/lib/concierge-transport'
import EscalationCTA from '@/components/EscalationCTA'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Eyebrow from '@/components/ui/Eyebrow'

export interface SupportChatProps {
  signedIn: boolean
  email?: string
  totalPoints?: number
  programs?: { program: string; balance: number }[]
  homeAirport?: string
}

const SEED_CHIPS = [
  'Why did hop say pay cash?',
  "Where's my booking request?",
  'My balance looks wrong',
]

function textOf(m: HopUIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export default function SupportChat({
  signedIn,
  email,
  totalPoints,
  programs,
  homeAirport,
}: SupportChatProps) {
  const [showEscalate, setShowEscalate] = useState(false)
  const [inputVal, setInputVal] = useState('')

  const getContext = useCallback(
    (): ConciergeRequestContext => ({
      totalPoints,
      programs,
      homeAirport,
    }),
    [totalPoints, programs, homeAirport]
  )

  const transport = useMemo(
    () => new ConciergeTransport(getContext, '/api/support-agent'),
    [getContext]
  )

  const { messages, sendMessage, status, stop } = useChat<HopUIMessage>({
    transport,
  })

  const isBusy = status === 'submitted' || status === 'streaming'

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const q = inputVal.trim()
    if (!q || isBusy) return
    setInputVal('')
    sendMessage({ text: q })
  }

  const handleChipClick = (chipText: string) => {
    if (isBusy) return
    sendMessage({ text: chipText })
  }

  return (
    <Card className="mb-8 p-6 bg-surface border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-border">
        <div>
          <Eyebrow className="text-muted mb-1">Support Assistant</Eyebrow>
          <h3 className="text-lg font-semibold text-foreground">
            Ask about your account or a verdict
          </h3>
          <p className="text-xs text-muted">
            Answers come from your account and hop&apos;s engine — computed, not guessed.
          </p>
        </div>
        {!signedIn && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded border border-amber-200/50 dark:border-amber-800/50">
            Signed out · KB mode
          </span>
        )}
      </div>

      {messages.length === 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted mb-2 font-medium">Quick questions:</p>
          <div className="flex flex-wrap gap-2">
            {SEED_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className="text-xs px-3 py-1.5 rounded-full border border-border bg-paper hover:border-brand/40 text-foreground transition-colors cursor-pointer"
              >
                {chip}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-4 mb-4 max-h-[400px] overflow-y-auto pr-1">
          {messages.map((m) => {
            const textContent = textOf(m)
            const toolParts = m.parts.filter(
              (p): p is Extract<typeof p, { type: 'data-tool' }> => p.type === 'data-tool'
            )

            return (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                {/* Tool activity frames */}
                {toolParts.length > 0 && (
                  <div className="space-y-1 mb-1.5">
                    {toolParts.map((tp, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] text-muted flex items-center gap-1.5 bg-paper/60 px-2.5 py-1 rounded border border-border/60"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand/60 animate-pulse" />
                        <span>{(tp.data as unknown as Record<string, unknown>)?.detail ? String((tp.data as unknown as Record<string, unknown>).detail) : 'Consulting engine…'}</span>
                      </div>
                    ))}
                  </div>
                )}

                {textContent && (
                  <div
                    className={`max-w-[85%] rounded-lg px-3.5 py-2 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-brand text-brand-foreground'
                        : 'bg-paper text-foreground border border-border'
                    }`}
                  >
                    {textContent}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Input composer */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder={
            signedIn
              ? 'Ask about your balances, a flight verdict, or how hop works…'
              : 'Ask a question about how hop works…'
          }
          className="flex-1 rounded-md border border-border bg-paper px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-brand"
        />
        {isBusy ? (
          <Button type="button" variant="secondary" onClick={stop}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!inputVal.trim()}>
            Send
          </Button>
        )}
      </form>

      {/* Persistent human escalation affordance */}
      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
        <span className="text-xs text-muted">Need personal help from our team?</span>
        <button
          type="button"
          onClick={() => setShowEscalate(true)}
          className="text-xs text-brand hover:underline font-medium cursor-pointer"
        >
          Talk to a human →
        </button>
      </div>

      {showEscalate && (
        <div className="mt-4 p-4 rounded-lg bg-paper border border-border">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-sm font-semibold">Request Human Follow-up</h4>
            <button
              type="button"
              onClick={() => setShowEscalate(false)}
              className="text-xs text-muted hover:text-foreground"
            >
              Close ✕
            </button>
          </div>
          <EscalationCTA embedded defaultEmail={email} onCancel={() => setShowEscalate(false)} />
        </div>
      )}
    </Card>
  )
}
