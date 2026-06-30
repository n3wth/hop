'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { AirlineStatus } from '@/lib/travel-profile-model'
import { saveAirlineStatuses } from '@/app/actions/prefs'
import ProgramPicker from './ProgramPicker'
import Icon from './Icon'

// "Elite status" — view + edit the airline/hotel statuses hop's concierge knows
// about (United: Gold, Delta: Silver). Rows of {program, tier}: add one with the
// canonical program picker + a free-text tier, remove with a two-step inline
// confirm. The whole list is the source of truth — every save REPLACES the
// stored airlineStatuses via the saveAirlineStatuses server action, which clamps
// + persists into the travel_profile jsonb. Flat, on-brand, no emoji.
//
// AwardWallet sync already carries elite tiers under Balance.status; we surface
// those as one-tap suggestions, but the user edits freely.

// Two-step inline confirm for destructive actions — no modal (flat design). The
// first click arms ("Confirm?"); a second within the window runs it. Mirrors
// ProgramsManager's useConfirm so the account page reads consistently.
function useConfirm(timeoutMs = 4000) {
  const [armed, setArmed] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  function arm() {
    setArmed(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setArmed(false), timeoutMs)
  }
  function disarm() {
    if (timer.current) clearTimeout(timer.current)
    setArmed(false)
  }
  return { armed, arm, disarm }
}

export default function AirlineStatusManager({
  statuses,
  suggestions = [],
}: {
  // The statuses already stored on the profile (server-validated).
  statuses: AirlineStatus[]
  // Optional AwardWallet-derived {program, tier} the user can one-tap add. Any
  // already present in `statuses` are filtered out by the caller or here.
  suggestions?: AirlineStatus[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Persist a new full list. The server clamps + dedupes and echoes the cleaned
  // result; we refresh so the server-rendered list re-reads from the profile.
  function persist(next: AirlineStatus[]) {
    setError(null)
    start(async () => {
      const res = await saveAirlineStatuses(next)
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        router.refresh()
      } else {
        setError(res.error ?? 'Could not save')
      }
    })
  }

  function addRow(row: AirlineStatus) {
    // Replace any existing tier for the same program (one tier at a time).
    const key = row.program.trim().toLowerCase()
    const rest = statuses.filter((s) => s.program.trim().toLowerCase() !== key)
    persist([...rest, row])
  }

  function removeRow(index: number) {
    persist(statuses.filter((_, i) => i !== index))
  }

  // Hide a suggestion once the user already holds that program.
  const held = new Set(statuses.map((s) => s.program.trim().toLowerCase()))
  const openSuggestions = suggestions.filter(
    (s) => s.program && s.tier && !held.has(s.program.trim().toLowerCase()),
  )

  return (
    <div className="mt-4 flex flex-col gap-4">
      <section className="overflow-hidden rounded-[16px] border border-border bg-surface">
        {statuses.length > 0 ? (
          <ul>
            {statuses.map((s, i) => (
              <StatusRow
                key={`${s.program}-${i}`}
                status={s}
                first={i === 0}
                busy={pending}
                onRemove={() => removeRow(i)}
              />
            ))}
          </ul>
        ) : (
          <div className="flex items-start gap-4 px-6 py-6">
            <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
              <Icon name="workspace_premium" size={22} />
            </span>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-text">Add your elite status</div>
              <p className="mt-1 max-w-[52ch] text-[13.5px] leading-[1.55] text-text2">
                Tell hop where you have status — lounge access, upgrades, free bags
                — so the concierge factors it into its picks.
              </p>
            </div>
          </div>
        )}
        <AddStatusForm hasRows={statuses.length > 0} busy={pending} onAdd={addRow} />
      </section>

      {openSuggestions.length > 0 ? (
        <div className="rounded-[16px] border border-border bg-surface px-5 py-4 sm:px-6">
          <div className="text-[13px] font-semibold text-text2">From your synced accounts</div>
          <p className="mt-0.5 text-[12.5px] text-text3">
            hop spotted these in AwardWallet — tap to add, then edit if needed.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {openSuggestions.map((s, i) => (
              <button
                key={`${s.program}-${i}`}
                type="button"
                onClick={() => addRow(s)}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-paper px-3 py-1.5 text-[12.5px] font-semibold text-text2 transition-colors hover:border-brand hover:text-brand disabled:opacity-60"
              >
                <Icon name="add" size={14} />
                {s.program}: {s.tier}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : saved ? (
        <p role="status" className="text-[12.5px] font-medium text-brand">
          Saved
        </p>
      ) : null}
    </div>
  )
}

function StatusRow({
  status,
  first,
  busy,
  onRemove,
}: {
  status: AirlineStatus
  first: boolean
  busy: boolean
  onRemove: () => void
}) {
  const confirm = useConfirm()
  return (
    <li
      className={`grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 sm:px-6 ${
        first ? '' : 'border-t border-border'
      }`}
    >
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-text">{status.program}</div>
        <div className="mt-[2px] truncate text-[12.5px] text-text3">{status.tier}</div>
      </div>
      <span className="flex items-center gap-0.5">
        {confirm.armed ? (
          <>
            <button
              type="button"
              onClick={() => {
                confirm.disarm()
                onRemove()
              }}
              disabled={busy}
              aria-label={`Confirm remove ${status.program}`}
              className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-weak transition-colors disabled:opacity-60"
            >
              Confirm?
            </button>
            <button
              type="button"
              onClick={confirm.disarm}
              disabled={busy}
              className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={confirm.arm}
            disabled={busy}
            aria-label={`Remove ${status.program}`}
            className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-weak disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </span>
    </li>
  )
}

function AddStatusForm({
  hasRows,
  busy,
  onAdd,
}: {
  hasRows: boolean
  busy: boolean
  onAdd: (row: AirlineStatus) => void
}) {
  const [program, setProgram] = useState('')
  const [tier, setTier] = useState('')
  const [error, setError] = useState<string | null>(null)

  function add() {
    const p = program.trim()
    const t = tier.trim()
    if (!p) {
      setError('Pick a program')
      return
    }
    if (!t) {
      setError('Enter a tier')
      return
    }
    setError(null)
    onAdd({ program: p, tier: t })
    setProgram('')
    setTier('')
  }

  return (
    <div className={`px-5 py-4 sm:px-6 ${hasRows ? 'border-t border-border bg-sunk' : ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ProgramPicker
          value={program}
          onChange={(next) => {
            setProgram(next)
            if (error) setError(null)
          }}
          onEnterEmpty={add}
          error={!!error && !program.trim()}
          disabled={busy}
        />
        <input
          value={tier}
          onChange={(e) => {
            setTier(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Tier (e.g. Gold)"
          aria-label="Tier"
          autoComplete="off"
          className="w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand sm:w-[150px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
        >
          {busy ? 'Saving…' : 'Add'}
          {!busy ? <Icon name="check_circle" size={16} /> : null}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : null}
    </div>
  )
}
