'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { Balance } from '@/lib/types'
import type { ManualBalance } from '@/lib/accounts'
import {
  addProgram,
  editProgram,
  removeProgram,
  connectAwardWallet,
  disconnectAwardWallet,
} from '@/app/actions/accounts'
import BrandIcon from './BrandIcon'
import ProgramPicker from './ProgramPicker'
import Icon from './Icon'

// "Your programs" — manual-first balance management on /account.
//
// PRIMARY: a fast add form (a smart program picker over the canonical registry +
// balance) and an editable list of saved programs. 20-seconds-to-value, no
// external signup. SECONDARY: an honest "Auto-sync with AwardWallet" option.
// Flat, on-brand, no emojis. The picker (components/ProgramPicker.tsx) filters
// lib/programs.ts by name+aliases and fills the canonical name; the server
// canonicalizes + dedupes on save. router.refresh() re-runs the page so merged
// balances land everywhere.

export default function ProgramsManager({
  manual,
  awConnected,
  awBalances,
  awReason,
  awUnconfigured,
}: {
  // The user's hand-entered programs (editable).
  manual: ManualBalance[]
  // Whether an AwardWallet link exists, and the live balances it returned.
  awConnected: boolean
  awBalances: Balance[]
  awReason?: string
  // True when AWARDWALLET_CONNECT_URL isn't set yet — auto-sync can't go live.
  awUnconfigured?: boolean
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <ManualSection manual={manual} />
      <AwardWalletSection
        connected={awConnected}
        balances={awBalances}
        reason={awReason}
        unconfigured={awUnconfigured}
      />
    </div>
  )
}

// --- Manual (primary) -------------------------------------------------------

function ManualSection({ manual }: { manual: ManualBalance[] }) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-surface">
      {manual.length > 0 ? (
        <ul>
          {manual.map((b, i) => (
            <ProgramRow key={b.id} program={b} first={i === 0} />
          ))}
        </ul>
      ) : (
        <div className="flex items-start gap-4 px-6 py-6">
          <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
            <Icon name="loyalty" size={22} />
          </span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-text">Add your points</div>
            <p className="mt-1 max-w-[52ch] text-[13.5px] leading-[1.55] text-text2">
              Enter a program and your balance — hop reads it the same way it
              reads a live sync, and tells you when points beat cash.
            </p>
          </div>
        </div>
      )}
      <AddProgramForm hasRows={manual.length > 0} />
    </section>
  )
}

function ProgramRow({ program, first }: { program: ManualBalance; first: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(program.program)
  const [balance, setBalance] = useState(String(program.balance))
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    start(async () => {
      const res = await editProgram(program.id, name, balance)
      if (res.ok) {
        setEditing(false)
        router.refresh()
      } else {
        setError(res.error ?? 'Could not save')
      }
    })
  }

  function remove() {
    setError(null)
    start(async () => {
      const res = await removeProgram(program.id)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not remove')
    })
  }

  if (editing) {
    return (
      <li className={`px-5 py-4 sm:px-6 ${first ? '' : 'border-t border-border'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ProgramPicker value={name} onChange={setName} onEnterEmpty={save} disabled={pending} />
          <input
            value={balance}
            onChange={(e) => setBalance(e.target.value.replace(/[^0-9,]/g, ''))}
            inputMode="numeric"
            aria-label="Balance"
            className="w-full rounded-[10px] border border-border bg-paper px-3 py-2 text-[14px] font-semibold tabular-nums text-text outline-none transition-colors focus:border-brand sm:w-[140px]"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false)
                setName(program.program)
                setBalance(String(program.balance))
                setError(null)
              }}
              disabled={pending}
              className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
        {error ? <p className="mt-1.5 text-[12.5px] font-medium text-weak">{error}</p> : null}
      </li>
    )
  }

  return (
    <li
      className={`group grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 sm:px-6 ${
        first ? '' : 'border-t border-border'
      }`}
    >
      <BrandIcon code={program.code} name={program.program} size={40} />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-text">{program.program}</div>
        {program.status ? (
          <div className="mt-[2px] truncate text-[12.5px] text-text3">{program.status}</div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-display text-[15px] font-semibold tabular-nums text-text">
          {program.balance.toLocaleString()}
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={pending}
            aria-label={`Edit ${program.program}`}
            className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-brand disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            aria-label={`Remove ${program.program}`}
            className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-weak disabled:opacity-60"
          >
            {pending ? '…' : 'Remove'}
          </button>
        </span>
      </div>
    </li>
  )
}

function AddProgramForm({ hasRows }: { hasRows: boolean }) {
  const router = useRouter()
  const [program, setProgram] = useState('')
  const [balance, setBalance] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Confirmation when the server folded this into an existing program (dedupe).
  const [note, setNote] = useState<string | null>(null)

  function add() {
    if (!program.trim()) {
      setError('Pick a program')
      return
    }
    if (!balance.trim()) {
      setError('Enter a balance')
      return
    }
    setError(null)
    setNote(null)
    start(async () => {
      const res = await addProgram(program, balance)
      if (res.ok) {
        setProgram('')
        setBalance('')
        setNote(res.note ?? null)
        router.refresh()
      } else {
        setError(res.error ?? 'Could not add')
      }
    })
  }

  return (
    <div className={`px-5 py-4 sm:px-6 ${hasRows ? 'border-t border-border bg-sunk' : ''}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <ProgramPicker
          value={program}
          onChange={(next) => {
            setProgram(next)
            if (error) setError(null)
            if (note) setNote(null)
          }}
          onEnterEmpty={add}
          error={!!error}
          disabled={pending}
        />
        <input
          value={balance}
          onChange={(e) => {
            setBalance(e.target.value.replace(/[^0-9,]/g, ''))
            if (error) setError(null)
            if (note) setNote(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          inputMode="numeric"
          placeholder="Balance"
          aria-label="Balance"
          autoComplete="off"
          className="w-full rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[14px] font-semibold tabular-nums text-text outline-none transition-colors focus:border-brand sm:w-[140px]"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
        >
          {pending ? 'Adding…' : 'Add'}
          {!pending ? <Icon name="check_circle" size={16} /> : null}
        </button>
      </div>
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-weak">{error}</p> : null}
      {note ? <p className="mt-1.5 text-[12.5px] font-medium text-brand">{note}</p> : null}
    </div>
  )
}

// --- AwardWallet (secondary auto-sync) --------------------------------------

function AwardWalletSection({
  connected,
  balances,
  reason,
  unconfigured,
}: {
  connected: boolean
  balances: Balance[]
  reason?: string
  unconfigured?: boolean
}) {
  const router = useRouter()
  const [disconnecting, startDisconnect] = useTransition()
  const [refreshing, startRefresh] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function disconnect() {
    setError(null)
    startDisconnect(async () => {
      const res = await disconnectAwardWallet()
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not disconnect')
    })
  }

  function refresh() {
    setError(null)
    startRefresh(() => router.refresh())
  }

  if (connected) {
    return (
      <section className="overflow-hidden rounded-[16px] border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <span className="text-[13px] font-semibold text-text2">
            Auto-syncing with AwardWallet
            <span className="ml-2 font-normal text-text3">
              {balances.length} live {balances.length === 1 ? 'program' : 'programs'}
            </span>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing || disconnecting}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-light disabled:opacity-60"
            >
              <Icon name="schedule" size={16} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={refreshing || disconnecting}
              className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
        {balances.length === 0 ? (
          <p className="border-t border-border px-5 py-3 text-[13px] text-text2 sm:px-6">
            {reason
              ? `Connected, but balances didn't load (${reason}). Try Refresh.`
              : 'Connected, but no balances came back yet. Try Refresh.'}
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-border px-5 py-2.5 text-[12.5px] font-medium text-weak sm:px-6">
            {error}
          </p>
        ) : null}
      </section>
    )
  }

  // Not connected — secondary CTA, honest about the AwardWallet requirement.
  return (
    <section className="rounded-[16px] border border-border bg-surface px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-text">Auto-sync with AwardWallet</div>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-text2">
            Already use AwardWallet? Connect it to keep balances current automatically.
            Requires an AwardWallet account.
          </p>
        </div>
        <a
          href="/auth/awardwallet/start"
          className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-border bg-paper px-4 py-2.5 text-[13.5px] font-semibold text-text transition-colors hover:border-brand hover:text-brand"
        >
          Connect AwardWallet
        </a>
      </div>

      {unconfigured ? (
        <p className="mt-2 text-[12px] text-text3">
          Auto-sync isn&apos;t available yet — add programs manually above.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setShowAdvanced((s) => !s)}
        className="mt-3 text-[12px] font-semibold text-text3 transition-colors hover:text-text2"
      >
        {showAdvanced ? 'Hide' : 'Advanced: paste a connected-user ID'}
      </button>
      {showAdvanced ? <AdvancedIdEntry /> : null}
      {error ? <p className="mt-1.5 text-[12.5px] font-medium text-weak">{error}</p> : null}
    </section>
  )
}

// Dev escape hatch — manual AwardWallet connected-user ID. Secondary, behind a
// disclosure. Not the primary connect path.
function AdvancedIdEntry() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function connect() {
    if (!value.trim()) {
      setError('Enter an ID')
      return
    }
    setError(null)
    start(async () => {
      const res = await connectAwardWallet(value)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not connect')
    })
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(null)
        }}
        placeholder="AwardWallet connected-user ID"
        aria-label="AwardWallet connected-user ID"
        autoComplete="off"
        className="flex-1 rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] font-semibold text-text outline-none transition-colors focus:border-brand"
      />
      <button
        type="button"
        onClick={connect}
        disabled={pending}
        className="inline-flex flex-shrink-0 items-center justify-center rounded-[10px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
      >
        {pending ? 'Connecting…' : 'Connect'}
      </button>
      {error ? <p className="text-[12.5px] font-medium text-weak">{error}</p> : null}
    </div>
  )
}
