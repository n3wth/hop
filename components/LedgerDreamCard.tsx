'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import type { DreamCardData } from '@/lib/dream-view'

export type { DreamCardData }

// THE LEDGER DREAM card — a cinematic, flat, on-brand "Dream of the Week" built
// FROM the user's real points stack. The destination, miles, cpp, cash value and
// the exact pool→program PROOF are all the ENGINE's (lib/ledger-dream), resolved
// server-side and passed in. The card SHOWS the server-rendered narration as-is
// on first paint — no gateway call fires on mount, so a passive view costs zero
// AI. Live AI narration only streams in when the user explicitly asks for a new
// dream via "Dream me another".
//
// "Dream me another" walks the ranked dream list (wrapping around), re-narrating
// a different corner of their wealth — same deterministic engine. With a single
// dream it simply re-narrates the same one, so the affordance is always live.
// DreamCardData is the engine→client serializer's shape (lib/dream-view),
// re-exported above.

function compactMiles(n: number): string {
  const k = n / 1000
  return `${Number.isInteger(k) ? k : k.toFixed(1)}K`
}
function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default function LedgerDreamCard({
  dream,
  // How many distinct reachable dreams exist (drives the "another" affordance).
  variantCount = 1,
}: {
  dream: DreamCardData
  variantCount?: number
}) {
  const [blurb, setBlurb] = useState(dream.initialBlurb)
  const [index, setIndex] = useState(0)
  const [streaming, setStreaming] = useState(false)
  // Announced to screen readers ONCE when a stream completes — the live blurb
  // paragraph itself is not a live region (it would announce every token).
  const [announce, setAnnounce] = useState('')
  // The card currently shown (updates after a successful "another" fetch so the
  // photo/proof swap together with the new blurb, never mid-stream).
  const [view, setView] = useState<DreamCardData>(dream)
  const abortRef = useRef<AbortController | null>(null)

  // Narrate the dream at `i`. Streams prose from /api/dream and types it in. On
  // any failure the existing blurb stays — the card never breaks.
  const narrate = useCallback(async (i: number) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setStreaming(true)
    let text = ''
    try {
      const res = await fetch('/api/dream', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ index: i }),
        signal: ctrl.signal,
      })
      if (!res.ok || !res.body) return
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let first = true
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (!chunk) continue
        if (first) {
          // First token arrived — clear the placeholder and type the live answer.
          text = chunk
          first = false
        } else {
          text += chunk
        }
        setBlurb(text)
      }
    } catch {
      // aborted or network error — keep whatever is shown.
    } finally {
      if (abortRef.current === ctrl) {
        setStreaming(false)
        // Announce the completed narration once, now that it's settled.
        if (text) setAnnounce(text)
      }
    }
  }, [])

  // NO narration call on mount. The server already rendered a grounded blurb
  // (dream.initialBlurb), shown above as the initial state — a passive view of
  // the card costs zero AI. We only abort any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // "Dream me another" walks the ranked dream list and WRAPS around, so it always
  // produces a dream even when there's only one reachable (it re-narrates that
  // one). Fetches the next dream's CARD (engine pick) via a tiny GET to swap the
  // visible data, then streams the new AI narration.
  const dreamAnother = useCallback(() => {
    const count = Math.max(1, variantCount)
    const next = (index + 1) % count
    setIndex(next)
    // Immediate feedback on tap — show a "Dreaming…" state and flip the caret on
    // before the network resolves, so the button never feels dead.
    setStreaming(true)
    setBlurb('Dreaming…')
    void (async () => {
      try {
        const res = await fetch(`/api/dream/card?index=${next}`, { method: 'GET' })
        if (res.ok) {
          const data = (await res.json()) as DreamCardData
          setView(data)
          // narrate() will replace this once the first token streams in.
        }
      } catch {
        // keep the current card; narration below still re-fetches.
      }
      void narrate(next)
    })()
  }, [index, narrate, variantCount])

  const v = view

  return (
    <article className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-paper lg:rounded-[var(--radius-hero)]">
      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* ── HERO PHOTO ──────────────────────────────────────────────────── */}
        <div
          className="relative min-h-[260px] overflow-hidden lg:min-h-[420px]"
          style={{ background: 'var(--color-brand-deep)' }}
        >
          {v.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.photo.url}
              alt={v.photo.alt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div aria-hidden className="h-full w-full" style={{ background: 'var(--color-brand-deep)' }} />
          )}

          {/* legibility scrim (image overlay — allowed) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(7,62,62,0.82) 0%, rgba(7,62,62,0.30) 42%, rgba(7,62,62,0.05) 72%)',
            }}
          />

          {/* No eyebrow pill here — the section heading directly above already
              names the variant ("A dream worth saving toward." / "The trip your
              points already bought."), and repeating it on the photo read as
              duplicate chrome. The cpp chip carries the only on-photo data. */}

          {/* cpp chip */}
          {v.cpp !== undefined ? (
            <span
              className="absolute right-4 top-4 flex items-baseline gap-1 rounded-full px-3 py-1.5"
              style={{ background: 'var(--color-good-bg)' }}
              title="cents per point — how hard each point works here"
            >
              <span className="hop-price text-[16px] leading-none text-good">
                {v.cpp.toFixed(1)}
              </span>
              <span className="text-[10px] font-semibold tracking-[var(--track-label)] text-good">¢/pt</span>
            </span>
          ) : null}

          {/* city + flag */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 p-5 sm:p-6">
            <span
              className={`fi fi-${v.countryCode} mb-1.5 h-[18px] w-[24px] flex-shrink-0 rounded-[2px]`}
              aria-hidden
            />
            <div className="min-w-0">
              <h3 className="truncate font-display text-[34px] font-semibold leading-[1.02] tracking-[-0.02em] text-white sm:text-[40px]">
                {v.city}
              </h3>
              <p className="truncate text-[12.5px] font-semibold uppercase tracking-[var(--track-tag)] text-white/85">
                {v.country}
              </p>
            </div>
          </div>
        </div>

        {/* ── NARRATION + PROOF ───────────────────────────────────────────── */}
        <div className="flex flex-col p-5 sm:p-7 lg:p-8">
          {/* AI narration — second-person, evocative, grounded in the engine.
              NOT a live region (it would announce every streamed token); the
              completed text is announced once via the SR-only region below. */}
          <p className="font-display text-[19px] leading-[1.4] tracking-[-0.01em] text-text sm:text-[22px]">
            {blurb}
            {streaming ? (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-[0.9em] w-[2px] translate-y-[1px] bg-brand align-middle motion-safe:animate-pulse"
              />
            ) : null}
          </p>
          {/* Announces the finished narration once it has settled. */}
          <span className="sr-only" role="status" aria-live="polite">
            {announce}
          </span>

          {/* ── THE PROOF — how you afford it, straight from the engine ────── */}
          <div className="mt-6 rounded-[var(--radius)] border border-hair bg-sunk p-4 sm:p-5">
            <div className="flex items-center gap-1.5">
              <Icon name="shield" size={12} className="text-brand" />
              <span className="text-[10.5px] font-semibold uppercase tracking-[var(--track-eyebrow)] text-text3">
                How you afford it
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3.5">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">Award</div>
                <div className="hop-price mt-1 text-[20px] leading-none text-text">
                  {compactMiles(v.milesNeeded)}
                  <span className="font-sans ml-1 text-[12px] font-medium text-text3">
                    mi{v.cabin ? ` · ${v.cabin}` : ''}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                  Cash you skip
                </div>
                <div className="hop-price mt-1 text-[20px] leading-none text-text">
                  {money(v.cashValue)}
                </div>
              </div>
            </div>

            {/* the pool → program path */}
            <div className="mt-4 border-t border-hair pt-3.5">
              <div className="text-[10px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
                The path
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[14px] font-semibold text-text">
                {v.transferFrom ? (
                  <>
                    <span className="text-text2">{v.transferFrom.source}</span>
                    <Icon name="swap_horiz" size={16} className="text-brand" />
                    <span className="text-brand">{v.program}</span>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-text2">
                      {v.transferFrom.ratio}
                    </span>
                  </>
                ) : v.viaKind === 'direct' ? (
                  <>
                    <span className="text-brand">{v.program}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-[11.5px] font-semibold text-good">
                      <Icon name="check_circle" size={12} weight="fill" />
                      held directly
                    </span>
                  </>
                ) : (
                  <span className="text-text2">{v.pathLabel}</span>
                )}
              </div>
              {v.effectiveBalance !== undefined && !v.saveToward ? (
                <p className="mt-2 text-[12.5px] leading-[1.5] text-text2">
                  You hold{' '}
                  <b className="hop-num font-semibold text-text">
                    {v.effectiveBalance.toLocaleString('en-US')}
                  </b>{' '}
                  toward {v.program} — enough, with{' '}
                  <span className="hop-num">
                    {Math.max(0, v.effectiveBalance - v.milesNeeded).toLocaleString('en-US')}
                  </span>{' '}
                  to spare.
                </p>
              ) : v.saveToward ? (
                <p className="mt-2 text-[12.5px] leading-[1.5] text-text2">
                  Connect your programs and hop will show the exact transfer that
                  unlocks this.
                </p>
              ) : null}
            </div>
          </div>

          {/* ── CTAs ─────────────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={v.searchHref}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] bg-brand px-5 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              <Icon name="flight" size={16} />
              {v.saveToward ? 'See the route' : 'Make it real'}
            </Link>
            <button
              type="button"
              onClick={dreamAnother}
              disabled={streaming}
              className="inline-flex items-center gap-2 rounded-[var(--radius)] border border-border bg-paper px-5 py-3 text-[14.5px] font-semibold text-text transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
            >
              <Icon name="lightbulb" size={16} />
              Dream me another
            </button>
          </div>

          {v.photo ? (
            <p className="mt-4 text-[10.5px] text-text3">
              Photo: {v.photo.credit.name} / Unsplash
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
