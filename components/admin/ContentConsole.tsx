'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { SweetSpotDraft, DraftStatus } from '@/lib/sweet-spot-drafts'
import {
  createSweetSpotDraftAction,
  draftSweetSpotWhyAction,
  updateSweetSpotDraftWhyAction,
  setSweetSpotDraftStatusAction,
} from '@/app/actions/admin'

// The owner-gated sweet-spot content review queue: draft the facts, ask the
// agent for the "why" copy, edit it, then approve/reject. Approving merges the
// entry into the live /sweet-spots pages (lib/sweet-spots-live.ts) — nothing
// here ever lets the agent originate a number, only the "why" prose.
export default function ContentConsole({
  drafts,
  programs,
}: {
  drafts: SweetSpotDraft[] | null
  programs: { slug: string; name: string }[]
}) {
  const [items, setItems] = useState(drafts ?? [])
  const pending = items.filter((d) => d.status === 'pending_review')
  const approved = items.filter((d) => d.status === 'approved')
  const rejected = items.filter((d) => d.status === 'rejected')

  const onCreated = (d: SweetSpotDraft) => setItems((prev) => [d, ...prev])
  const onChanged = (d: SweetSpotDraft) =>
    setItems((prev) => prev.map((x) => (x.id === d.id ? d : x)))

  return (
    <div className="max-w-[var(--container-shell)] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.01em] text-text">Content</h1>
      <p className="mt-1 text-[13px] text-text3">
        {drafts === null
          ? 'drafts unavailable'
          : `${pending.length} pending · ${approved.length} live · ${rejected.length} rejected`}{' '}
        · sweet-spot guide entries — facts are typed in, the AI only drafts the why line
      </p>

      {programs.length === 0 ? (
        <Empty>No programs to draft against yet.</Empty>
      ) : (
        <NewDraftForm programs={programs} onCreated={onCreated} />
      )}

      <QueueSection title="Pending review" items={pending} onChanged={onChanged} />
      <QueueSection title="Live" items={approved} onChanged={onChanged} />
      <QueueSection title="Rejected" items={rejected} onChanged={onChanged} />
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-border px-4 py-6 text-center text-[13px] text-text3">
      {children}
    </div>
  )
}

const GHOST_BTN =
  'rounded-full border border-border px-3 py-1 text-[12px] font-medium text-text2 transition-colors hover:border-brand hover:text-text disabled:cursor-not-allowed disabled:opacity-50'
const PRIMARY_BTN =
  'rounded-full bg-brand px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-50'

const CABINS = ['Economy', 'Business', 'First'] as const
const CONFIDENCES = ['med', 'high'] as const
const CONFIDENCE_LABEL: Record<(typeof CONFIDENCES)[number], string> = {
  med: 'Confidence: soft figure',
  high: 'Confidence: high',
}

const INPUT_CLS =
  'w-full rounded-[var(--radius-sm)] border border-border bg-paper px-3 py-2 text-[13.5px] text-text placeholder:text-text3 focus:border-brand focus:outline-none'

function NewDraftForm({
  programs,
  onCreated,
}: {
  programs: { slug: string; name: string }[]
  onCreated: (d: SweetSpotDraft) => void
}) {
  const [route, setRoute] = useState('')
  const [programSlug, setProgramSlug] = useState(programs[0]?.slug ?? '')
  const [metal, setMetal] = useState('')
  const [cabin, setCabin] = useState<(typeof CABINS)[number]>('Business')
  const [milesOw, setMilesOw] = useState('')
  const [milesLabel, setMilesLabel] = useState('')
  const [confidence, setConfidence] = useState<(typeof CONFIDENCES)[number]>('med')
  const [notes, setNotes] = useState('')
  const [why, setWhy] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const programName = useMemo(
    () => programs.find((p) => p.slug === programSlug)?.name ?? '',
    [programs, programSlug],
  )
  const factsReady = route.trim() && milesLabel.trim() && programSlug

  const reset = () => {
    setRoute('')
    setMetal('')
    setMilesOw('')
    setMilesLabel('')
    setNotes('')
    setWhy('')
    setErr('')
  }

  const draftCopy = async () => {
    if (!factsReady || drafting) return
    setDrafting(true)
    setErr('')
    const res = await draftSweetSpotWhyAction({
      route: route.trim(),
      program: programName,
      metal: metal.trim() || undefined,
      cabin,
      milesLabel: milesLabel.trim(),
      milesOw: milesOw.trim() ? Number(milesOw) : undefined,
      notes: notes.trim() || undefined,
    })
    setDrafting(false)
    if (!res.ok || !res.why) {
      setErr(res.error ?? "Couldn't draft copy")
      return
    }
    setWhy(res.why)
  }

  const save = async (publish: boolean) => {
    if (!factsReady || saving) return
    setSaving(true)
    setErr('')
    const res = await createSweetSpotDraftAction({
      route: route.trim(),
      programSlug,
      metal: metal.trim() || undefined,
      cabin,
      milesOw: milesOw.trim() ? Number(milesOw) : undefined,
      milesLabel: milesLabel.trim(),
      confidence,
      why: why.trim() || undefined,
    })
    if (!res.ok || !res.id) {
      setSaving(false)
      setErr(res.error ?? "Couldn't save")
      return
    }
    let status: DraftStatus = 'pending_review'
    if (publish) {
      const pub = await setSweetSpotDraftStatusAction(res.id, 'approved', programSlug)
      if (pub.ok) status = 'approved'
    }
    setSaving(false)
    onCreated({
      id: res.id,
      seq: 0,
      route: route.trim(),
      program: programName,
      programSlug,
      metal: metal.trim() || null,
      cabin,
      milesOw: milesOw.trim() ? Number(milesOw) : null,
      milesLabel: milesLabel.trim(),
      why: why.trim(),
      confidence,
      status,
      createdBy: '',
    })
    reset()
  }

  return (
    <section className="mt-6 rounded-[var(--radius-lg)] border border-border bg-paper p-5">
      <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
        New entry
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input
          className={INPUT_CLS}
          placeholder="Route, e.g. US ↔ Europe"
          value={route}
          onChange={(e) => setRoute(e.target.value)}
        />
        <select
          className={INPUT_CLS}
          value={programSlug}
          onChange={(e) => setProgramSlug(e.target.value)}
        >
          {programs.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          className={INPUT_CLS}
          placeholder="Operating metal (optional)"
          value={metal}
          onChange={(e) => setMetal(e.target.value)}
        />
        <select
          className={INPUT_CLS}
          value={cabin}
          onChange={(e) => setCabin(e.target.value as (typeof CABINS)[number])}
        >
          {CABINS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className={INPUT_CLS}
          placeholder="Miles one-way (number, optional)"
          inputMode="numeric"
          value={milesOw}
          onChange={(e) => setMilesOw(e.target.value.replace(/[^\d]/g, ''))}
        />
        <input
          className={INPUT_CLS}
          placeholder="Miles label, e.g. 45k or 4k–7.5k"
          value={milesLabel}
          onChange={(e) => setMilesLabel(e.target.value)}
        />
        <select
          className={`${INPUT_CLS} sm:col-span-2`}
          value={confidence}
          onChange={(e) => setConfidence(e.target.value as (typeof CONFIDENCES)[number])}
        >
          {CONFIDENCES.map((c) => (
            <option key={c} value={c}>
              {CONFIDENCE_LABEL[c]}
            </option>
          ))}
        </select>
      </div>

      <textarea
        className={`${INPUT_CLS} mt-3 min-h-[52px] resize-y`}
        placeholder="Context notes for the AI draft — cash price, fees, availability, etc. Only numbers written here can appear in the drafted copy; the AI never estimates one itself."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      <textarea
        className={`${INPUT_CLS} mt-3 min-h-[72px] resize-y`}
        placeholder="Why it's a deal (draft with AI, or write it yourself)"
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />

      {err && <p className="mt-2 text-[12.5px] text-weak">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={GHOST_BTN}
          disabled={!factsReady || drafting}
          onClick={draftCopy}
        >
          {drafting ? 'Drafting…' : 'Draft copy with AI'}
        </button>
        <button
          type="button"
          className={GHOST_BTN}
          disabled={!factsReady || !why.trim() || saving}
          onClick={() => save(false)}
        >
          Save as pending
        </button>
        <button
          type="button"
          className={PRIMARY_BTN}
          disabled={!factsReady || !why.trim() || saving}
          onClick={() => save(true)}
        >
          {saving ? 'Saving…' : 'Save + publish'}
        </button>
      </div>
    </section>
  )
}

function QueueSection({
  title,
  items,
  onChanged,
}: {
  title: string
  items: SweetSpotDraft[]
  onChanged: (d: SweetSpotDraft) => void
}) {
  if (items.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="text-[11px] font-bold uppercase tracking-[var(--track-eyebrow)] text-brand">
        {title}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {items.map((d) => (
          <DraftCard key={d.id} draft={d} onChanged={onChanged} />
        ))}
      </div>
    </section>
  )
}

function DraftCard({
  draft,
  onChanged,
}: {
  draft: SweetSpotDraft
  onChanged: (d: SweetSpotDraft) => void
}) {
  const [why, setWhy] = useState(draft.why)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const dirty = why.trim() !== draft.why.trim()

  const saveWhy = async () => {
    if (!why.trim() || busy) return
    setBusy(true)
    setErr('')
    const res = await updateSweetSpotDraftWhyAction(draft.id, why.trim())
    setBusy(false)
    if (!res.ok) {
      setErr(res.error ?? "Couldn't save")
      return
    }
    onChanged({ ...draft, why: why.trim() })
  }

  const setStatus = async (status: DraftStatus) => {
    if (busy) return
    setBusy(true)
    setErr('')
    const res = await setSweetSpotDraftStatusAction(draft.id, status, draft.programSlug)
    setBusy(false)
    if (!res.ok) {
      setErr(res.error ?? "Couldn't update")
      return
    }
    onChanged({ ...draft, status })
  }

  return (
    <article className="rounded-[var(--radius)] border border-border bg-paper p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-[15px] font-semibold text-text">{draft.route}</h3>
        <span className="text-[13px] text-text3">
          {draft.program}
          {draft.metal ? ` · ${draft.metal}` : ''} · {draft.cabin} · {draft.milesLabel}
        </span>
        {draft.confidence === 'med' && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[var(--track-label)] text-text3">
            Soft figure
          </span>
        )}
      </div>

      <textarea
        className={`${INPUT_CLS} mt-3 min-h-[60px] resize-y`}
        value={why}
        onChange={(e) => setWhy(e.target.value)}
      />

      {err && <p className="mt-2 text-[12.5px] text-weak">{err}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dirty && (
          <button type="button" className={GHOST_BTN} disabled={busy} onClick={saveWhy}>
            Save why
          </button>
        )}
        {draft.status !== 'approved' && (
          <button
            type="button"
            className={PRIMARY_BTN}
            disabled={busy || !why.trim()}
            onClick={() => setStatus('approved')}
          >
            Approve
          </button>
        )}
        {draft.status !== 'rejected' && (
          <button type="button" className={GHOST_BTN} disabled={busy} onClick={() => setStatus('rejected')}>
            Reject
          </button>
        )}
        {draft.status !== 'pending_review' && (
          <button
            type="button"
            className={GHOST_BTN}
            disabled={busy}
            onClick={() => setStatus('pending_review')}
          >
            {draft.status === 'approved' ? 'Unpublish' : 'Restore to pending'}
          </button>
        )}
      </div>
    </article>
  )
}
