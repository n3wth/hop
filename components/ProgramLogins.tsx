'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { CredentialRow } from '@/lib/credential-vault'
import { addProgramLogin, removeProgramLogin } from '@/app/actions/credentials'
import { canonicalizeProgram, programById } from '@/lib/programs'
import BrandIcon from './BrandIcon'
import ProgramPicker from './ProgramPicker'
import Icon from './Icon'

// "Auto-sync with your login" — the credential-based rail (flag-gated; the
// account page only renders this when isCredentialSyncEnabled()). Add a
// program login; hop signs in on a schedule and reads the balance, showing an
// honest per-login status. The password is sent once to the server, encrypted
// at rest (AES-256-GCM), and never returned — the row only ever shows a masked
// username. Flat, on-brand, no emojis.

const STATUS_COPY: Record<CredentialRow['status'], { label: string; tone: 'ok' | 'warn' | 'muted' }> = {
  ok: { label: 'Synced', tone: 'ok' },
  pending: { label: 'Waiting for first sync', tone: 'muted' },
  failed: { label: "Couldn't sign in", tone: 'warn' },
  unsupported: { label: 'Not supported yet', tone: 'warn' },
}

function displayProgram(key: string): { name: string; code?: string } {
  // The vault stores a canonical id when known, else free text — try both.
  const def = programById(key) ?? canonicalizeProgram(key)
  return def ? { name: def.name, code: def.code } : { name: key }
}

export default function ProgramLogins({
  logins,
  autosyncLive,
}: {
  logins: CredentialRow[]
  // False when the vault is on but the fetch worker isn't deployed — copy stays
  // honest ("added, sync goes live soon") instead of promising an update.
  autosyncLive: boolean
}) {
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-border bg-surface">
      <div className="px-5 py-4 sm:px-6">
        <div className="text-[14px] font-semibold text-text">Auto-sync with your login</div>
        <p className="mt-0.5 text-[14px] leading-[1.5] text-text2">
          hop signs in and reads your balance automatically. Your password is
          encrypted and only ever used to sign in — never shown again.
        </p>
        {!autosyncLive ? (
          <p className="mt-1.5 text-[12.5px] text-text3">
            Scheduled sync goes live soon — logins you add now are saved and start syncing then.
          </p>
        ) : null}
      </div>

      {logins.length > 0 ? (
        <ul className="border-t border-border">
          {logins.map((row) => (
            <LoginRow key={row.id} row={row} />
          ))}
        </ul>
      ) : null}

      <AddLoginForm hasRows={logins.length > 0} />
    </section>
  )
}

function LoginRow({ row }: { row: CredentialRow }) {
  const router = useRouter()
  const [removing, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { name, code } = displayProgram(row.program)
  const status = STATUS_COPY[row.status]

  function remove() {
    setError(null)
    start(async () => {
      const res = await removeProgramLogin(row.id)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not remove')
    })
  }

  return (
    <li className="grid grid-cols-[40px_1fr_auto] items-center gap-4 border-t border-border px-5 py-4 first:border-t-0 sm:px-6">
      <BrandIcon code={code} name={name} size={40} />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-text">{name}</div>
        <div className="mt-[2px] flex items-center gap-1.5 text-[12.5px]">
          <span
            className={
              status.tone === 'ok'
                ? 'font-medium text-brand'
                : status.tone === 'warn'
                  ? 'font-medium text-weak'
                  : 'text-text3'
            }
          >
            {status.label}
          </span>
          <span className="text-text3">· {row.usernameMask}</span>
        </div>
        {row.status === 'failed' && row.lastError ? (
          <div className="mt-[2px] truncate text-[12px] text-text3">{row.lastError}</div>
        ) : null}
        {error ? (
          <p role="alert" className="mt-1 text-[12px] font-medium text-weak">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={remove}
        disabled={removing}
        aria-label={`Remove ${name} login`}
        className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-weak disabled:opacity-60"
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </li>
  )
}

function AddLoginForm({ hasRows }: { hasRows: boolean }) {
  const router = useRouter()
  const [program, setProgram] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function add() {
    if (!program.trim()) return setError('Pick a program')
    if (!username.trim()) return setError('Enter your username')
    if (!password) return setError('Enter your password')
    setError(null)
    start(async () => {
      const res = await addProgramLogin(program, username, password)
      if (res.ok) {
        setProgram('')
        setUsername('')
        setPassword('')
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        router.refresh()
      } else {
        setError(res.error ?? 'Could not save')
      }
    })
  }

  return (
    <div className={`px-5 py-4 sm:px-6 ${hasRows ? 'border-t border-border bg-sunk' : 'border-t border-border'}`}>
      <div className="flex flex-col gap-2">
        <ProgramPicker
          value={program}
          onChange={(next) => {
            setProgram(next)
            if (error) setError(null)
          }}
          error={!!error}
          disabled={pending}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Username or email"
            aria-label="Program username"
            autoComplete="off"
            disabled={pending}
            className="no-inner-ring w-full rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand disabled:opacity-60"
          />
          <input
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                add()
              }
            }}
            type="password"
            placeholder="Password"
            aria-label="Program password"
            autoComplete="off"
            disabled={pending}
            className="no-inner-ring w-full rounded-[var(--radius-sm)] border border-border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand disabled:opacity-60"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={add}
            disabled={pending}
            className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
          >
            {pending ? 'Saving…' : 'Save login'}
            {!pending ? <Icon name="lock" size={16} weight="fill" /> : null}
          </button>
          <span className="text-[12px] text-text3">Encrypted at rest. Never shown again.</span>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p role="status" className="hop-text-appear mt-1.5 text-[12.5px] font-medium text-brand">
          Saved
        </p>
      ) : null}
    </div>
  )
}
