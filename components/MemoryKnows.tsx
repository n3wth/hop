'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from './Icon'
import { groupFacts, type MemoryFact } from '@/lib/memory-view'
import type { InferredFact } from '@/lib/inferred-facts'
import type { Observation } from '@/lib/memory-outcomes'
import { forgetFact, confirmInference, dismissInference } from '@/app/account/memory-actions'

// "What hop knows about you" — the glass box. Renders the durable facts hop holds
// (from the user's travel_profile, projected by lib/memory-view) as plain,
// source-tagged rows the user can FORGET. This is the trust foundation for hop's
// growing memory: before it learns anything new, you can see and correct what it
// already remembers. Flat editorial, no modals — a two-step inline confirm on
// forget (mirrors ProgramsManager / AirlineStatusManager).
//
// Numbers never appear here (no cpp/verdict) — these are personal facts only.

// Human source label. Today everything is user-stated; the 'noticed'/'observed'
// branches are ready for the later inference/outcome milestones.
function sourceLabel(source: MemoryFact['source']): string {
  switch (source) {
    case 'noticed':
      return 'hop noticed this'
    case 'observed':
      return 'from what you booked'
    default:
      return 'you told me this'
  }
}

function FactRow({ fact, onForgotten }: { fact: MemoryFact; onForgotten: (id: string) => void }) {
  const router = useRouter()
  const [armed, setArmed] = useState(false)
  const [pending, startTransition] = useTransition()

  const forget = () => {
    if (!armed) {
      setArmed(true)
      return
    }
    startTransition(async () => {
      const res = await forgetFact(fact.kind, fact.entry)
      if (res.ok) {
        onForgotten(fact.id)
        router.refresh()
      } else {
        setArmed(false)
      }
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-hair py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text3">
            {fact.label}
          </span>
          <span className="font-display text-[15px] font-semibold tracking-[-0.01em] text-text">
            {fact.value}
          </span>
        </div>
        <span className="mt-0.5 block text-[12px] text-text3">{sourceLabel(fact.source)}</span>
      </div>
      <button
        type="button"
        onClick={forget}
        disabled={pending}
        className={`hop-press flex-shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
          armed
            ? 'border-weak bg-weak-bg text-weak'
            : 'border-border bg-paper text-text2 hover:border-weak hover:text-weak'
        }`}
        aria-label={armed ? `Confirm forget ${fact.value}` : `Forget ${fact.value}`}
      >
        {pending ? 'Forgetting…' : armed ? 'Confirm?' : 'Forget'}
      </button>
    </div>
  )
}

// How each travel-party value reads at the end of "You usually travel …?".
const PARTY_PHRASE: Record<string, string> = {
  solo: 'solo',
  couple: 'as a two',
  family: 'as a family',
  group: 'with a group',
}

// Turn an inferred fact into a warm, first-person question the user answers.
function describeInference(f: InferredFact): string {
  const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
  switch (f.kind) {
    case 'cabin':
      return `You usually fly ${cap(f.value)} on long trips?`
    case 'travelParty':
      return `You usually travel ${PARTY_PHRASE[f.value] ?? f.value}?`
    case 'lovedDestinations':
      return `You keep coming back to ${f.value}?`
    case 'avoidedDestinations':
      return `You'd rather skip ${f.value}?`
  }
}

// A pending "hop noticed …" suggestion — the user confirms (→ promoted into their
// stated profile) or dismisses. Two plain buttons, flat, no modal.
function NoticedRow({ fact, onResolved }: { fact: InferredFact; onResolved: (id: string) => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const act = (fn: (id: string) => Promise<{ ok: boolean }>) =>
    startTransition(async () => {
      const res = await fn(fact.id)
      if (res.ok) {
        onResolved(fact.id)
        router.refresh()
      }
    })

  return (
    <div className="flex items-center justify-between gap-3 border-b border-hair py-3 last:border-b-0">
      <span className="min-w-0 text-[14px] leading-[1.4] text-text">{describeInference(fact)}</span>
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => act(confirmInference)}
          className="hop-press rounded-full bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
        >
          Yes
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(dismissInference)}
          className="hop-press rounded-full border border-border bg-paper px-3.5 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:border-text2 disabled:opacity-60"
        >
          Not really
        </button>
      </div>
    </div>
  )
}

export default function MemoryKnows({
  facts,
  noticed = [],
  observed = [],
}: {
  facts: MemoryFact[]
  noticed?: InferredFact[]
  observed?: Observation[]
}) {
  // Optimistically drop a forgotten row so the UI responds before revalidate.
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [resolved, setResolved] = useState<Set<string>>(new Set())
  const visible = facts.filter((f) => !hidden.has(f.id))
  const groups = groupFacts(visible)
  const pendingNoticed = noticed.filter((n) => !resolved.has(n.id))

  const onForgotten = (id: string) => setHidden((prev) => new Set(prev).add(id))
  const onResolved = (id: string) => setResolved((prev) => new Set(prev).add(id))

  const noticedBlock =
    pendingNoticed.length > 0 ? (
      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">
          <Icon name="lightbulb" size={13} />
          hop noticed
        </h3>
        <div className="rounded-[16px] border border-border bg-brand-tint px-4">
          {pendingNoticed.map((n) => (
            <NoticedRow key={n.id} fact={n} onResolved={onResolved} />
          ))}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-text3">
          Guesses from how you chat. Confirm one and hop remembers it for good; dismiss and it won&apos;t ask again.
        </p>
      </div>
    ) : null

  // "hop observed" — read-only reflections of what you DID (places you passed on).
  // No buttons: these mirror your own behavior. hop uses them to rank, never to hide.
  const observedBlock =
    observed.length > 0 ? (
      <div>
        <h3 className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-text3">
          <Icon name="trending_up" size={13} />
          hop observed
        </h3>
        <div className="rounded-[16px] border border-border bg-surface px-4">
          {observed.map((o) => (
            <div
              key={o.id}
              className="border-b border-hair py-3 text-[14px] leading-[1.4] text-text2 last:border-b-0"
            >
              {o.text}
            </div>
          ))}
        </div>
        <p className="mt-1 text-[12px] leading-[1.5] text-text3">
          Picked up from what you tap. hop uses this to rank what it leads with — it never hides a place you ask for.
        </p>
      </div>
    ) : null

  if (groups.length === 0 && !noticedBlock && !observedBlock) {
    return (
      <div className="rounded-[16px] border border-dashed border-border bg-paper px-5 py-7 text-center">
        <span className="grid mx-auto h-10 w-10 place-items-center rounded-full bg-brand-light text-brand">
          <Icon name="lightbulb" size={20} />
        </span>
        <p className="mt-3 text-[14px] leading-[1.55] text-text2">
          hop hasn&apos;t learned anything durable about you yet. Tell it in{' '}
          <a href="/ask" className="font-semibold text-brand hover:text-brand-deep">
            the concierge
          </a>{' '}
          — &ldquo;I fly business, love Lisbon, never suggest Cancun&rdquo; — and it&apos;ll remember it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {noticedBlock}
      {groups.map((g) => (
        <div key={g.group}>
          <h3 className="mb-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand">
            {g.title}
          </h3>
          <div className="rounded-[16px] border border-border bg-surface px-4">
            {g.facts.map((f) => (
              <FactRow key={f.id} fact={f} onForgotten={onForgotten} />
            ))}
          </div>
        </div>
      ))}
      {groups.length > 0 ? (
        <p className="text-[12.5px] leading-[1.5] text-text3">
          hop uses these to make its answers fit you. Forget anything you don&apos;t want it to remember — it
          won&apos;t cite it again.
        </p>
      ) : null}
      {observedBlock}
    </div>
  )
}
