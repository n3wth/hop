'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { resetSyncAddress } from '@/app/actions/sync-address'
import BrandIcon from './BrandIcon'
import Card from './ui/Card'
import Icon from './Icon'

// "Sync from a paste" — the paste rail of the balance-sync seam (flag-gated;
// the account page only renders this when isBalanceSyncEnabled()). Paste a
// statement email or an account-page copy → hop previews what it read → the
// user confirms → the rows land as ordinary manual balances. Every number in
// the preview came through the server clamp (only digits present in the pasted
// text survive) — nothing here invents a balance.

interface PreviewBalance {
  program: string
  code: string
  balance: number
  canonical: boolean
}

export default function BalanceSyncPaste({ syncAddress }: { syncAddress: string | null }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<PreviewBalance[] | null>(null)
  // 'parsed' = the regex fallback read this (no AI key / call failed) — the
  // preview says so, honestly, instead of looking identical to an AI read.
  const [source, setSource] = useState<'ai' | 'parsed'>('ai')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Live address so a reset updates the shown value without a full reload.
  const [address, setAddress] = useState(syncAddress)
  const [resetting, startReset] = useTransition()

  function resetAddress() {
    startReset(async () => {
      const res = await resetSyncAddress()
      if (res.ok && res.address) {
        setAddress(res.address)
        setCopied(false)
      }
    })
  }

  function readPaste() {
    if (text.trim().length < 8) {
      setError('Paste the text that shows your balance')
      return
    }
    setError(null)
    setDone(null)
    start(async () => {
      try {
        const res = await fetch('/api/balance-sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'preview', text }),
        })
        const json = await res.json()
        if (!json.ok) {
          setError(json.error ?? 'Could not read that')
          return
        }
        if (!json.balances || json.balances.length === 0) {
          setError('No balances found in that text')
          return
        }
        setPreview(json.balances)
        setSource(json.source === 'parsed' ? 'parsed' : 'ai')
      } catch {
        setError('Could not read that')
      }
    })
  }

  function apply() {
    if (!preview) return
    setError(null)
    start(async () => {
      try {
        const res = await fetch('/api/balance-sync', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'apply', text, balances: preview }),
        })
        const json = await res.json()
        if (!json.ok || !json.applied) {
          setError(json.error ?? 'Could not save')
          return
        }
        const { added, updated, unchanged, failed } = json.applied
        if (failed) {
          // Partial failure: keep the paste + preview so the user can retry —
          // a balance that silently didn't sync would poison every verdict.
          setError(`${failed} didn't save — try again`)
          if (added || updated) router.refresh()
          return
        }
        const parts: string[] = []
        if (added) parts.push(`${added} added`)
        if (updated) parts.push(`${updated} updated`)
        if (unchanged) parts.push(`${unchanged} already current`)
        setDone(parts.length > 0 ? parts.join(', ') : 'Nothing to change')
        setPreview(null)
        setText('')
        router.refresh()
      } catch {
        setError('Could not save')
      }
    })
  }

  async function copyAddress() {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard denied — the address is visible to select manually.
    }
  }

  return (
    <Card as="section" surface="surface" className="px-5 py-4 sm:px-6">
      <div className="text-[14px] font-semibold text-text">Sync from a paste</div>
      <p className="mt-0.5 text-[14px] leading-[1.5] text-text2">
        Paste a statement email or your account page — hop reads the balances and
        updates your programs. No passwords: hop only reads text you give it.
      </p>

      {preview ? (
        <div className="mt-3">
          <div className="text-[12.5px] font-semibold text-text3">hop read</div>
          <ul className="mt-2 overflow-hidden rounded-[var(--radius-sm)] border border-border">
            {preview.map((b, i) => (
              <li
                key={b.code + i}
                className={`flex items-center gap-3 bg-paper px-4 py-2.5 ${i > 0 ? 'border-t border-hair' : ''}`}
              >
                <BrandIcon code={b.code} name={b.program} size={28} />
                <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">
                  {b.program}
                </span>
                <span className="font-display text-[14px] font-semibold tabular-nums text-text">
                  {b.balance.toLocaleString('en-US')}
                </span>
              </li>
            ))}
          </ul>
          {source === 'parsed' ? (
            <p className="mt-1.5 text-[12.5px] text-text3">
              Read with the basic parser — check the numbers before saving.
            </p>
          ) : null}
          <div className="mt-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={apply}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
            >
              {pending ? 'Saving…' : 'Save these'}
              {!pending ? <Icon name="check_circle" size={16} weight="fill" /> : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setError(null)
              }}
              disabled={pending}
              className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              if (error) setError(null)
              if (done) setDone(null)
            }}
            rows={4}
            placeholder="Paste here — e.g. “Your MileagePlus balance: 45,230 miles”"
            aria-label="Statement text"
            className="no-inner-ring w-full resize-y rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[13.5px] leading-[1.5] text-text outline-none transition-colors focus:border-brand"
          />
          <button
            type="button"
            onClick={readPaste}
            disabled={pending}
            className="mt-2 inline-flex items-center justify-center rounded-[10px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
          >
            {pending ? 'Reading…' : 'Read balances'}
          </button>
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-weak">
          {error}
        </p>
      ) : null}
      {done ? (
        <p role="status" className="hop-text-appear mt-1.5 text-[12.5px] font-medium text-brand">
          {done}
        </p>
      ) : null}

      {address ? (
        <div className="mt-3 border-t border-hair pt-3">
          <p className="text-[12.5px] text-text3">
            Or forward balance emails to your sync address — hop reads those the same way.
          </p>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[var(--radius-sm)] bg-sunk px-2.5 py-1.5 text-[12px] text-text2">
              {address}
            </code>
            <button
              type="button"
              onClick={copyAddress}
              className="flex-shrink-0 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-[12px] font-semibold text-brand transition-colors hover:bg-brand-light"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button
            type="button"
            onClick={resetAddress}
            disabled={resetting}
            className="mt-1.5 text-[12px] font-semibold text-text3 transition-colors hover:text-text2 disabled:opacity-60"
          >
            {resetting ? 'Resetting…' : 'Reset address'}
          </button>
          <span className="ml-1.5 text-[12px] text-text3">if it&apos;s ever shared or leaked.</span>
        </div>
      ) : null}
    </Card>
  )
}
