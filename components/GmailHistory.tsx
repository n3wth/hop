'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import Card from '@/components/ui/Card'
import { disconnectGmailHistory, resyncGmailHistory } from '@/app/actions/accounts'
import type { PastTrip } from '@/lib/travel-history'

// The "Trips" affordance on /account. Connect Gmail (explicit consent) so hop can
// learn from past trips, or disconnect + delete. When the seam is gated off
// (unconfigured), it stays in a calm "coming soon" state. Mirrors the AwardWallet
// connect/disconnect idiom. No raw email is ever read client-side — the OAuth
// flow + parsing happen server-side; this only shows state + drives the flow.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Two-step inline confirm for destructive actions — no modal (flat design). First
// click arms ("Confirm?"), second click within the window runs it; auto-disarms.
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

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const idx = Number(mo) - 1
  return `${MONTHS[idx] ?? mo} ${y}`
}

export default function GmailHistory({
  enabled,
  connected,
  email,
  syncFailed,
  trips,
}: {
  enabled: boolean
  connected: boolean
  email: string | null
  syncFailed: boolean
  trips: PastTrip[]
}) {
  const router = useRouter()
  const [disconnecting, startDisconnect] = useTransition()
  const [syncing, startSync] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const confirm = useConfirm()

  function disconnect() {
    setError(null)
    setNote(null)
    confirm.disarm()
    startDisconnect(async () => {
      const res = await disconnectGmailHistory()
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not disconnect')
    })
  }

  function resync() {
    setError(null)
    setNote(null)
    startSync(async () => {
      const res = await resyncGmailHistory()
      if (res.ok) {
        if (res.note) setNote(res.note)
      } else {
        setError(res.error ?? 'Could not sync')
      }
      // Refresh even on failure — an 'auth-failed' result already flipped the
      // persistent syncFailed flag server-side; without this the "Reconnect
      // needed" banner only appears after some UNRELATED navigation, while
      // this transient inline error is the only thing the user sees now.
      router.refresh()
    })
  }

  // Connected: show the linked inbox + parsed trips + disconnect/resync.
  if (connected) {
    return (
      <Card surface="surface" radius="md" className="mt-4 overflow-hidden" as="section">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <span
            className={`flex min-w-0 items-center gap-2 text-[13px] font-semibold ${
              syncFailed ? 'text-weak' : 'text-text2'
            }`}
          >
            <Icon name={syncFailed ? 'error' : 'check_circle'} size={16} weight="fill" />
            <span className="truncate">
              {syncFailed ? 'Reconnect needed' : 'Connected'}
              {email ? ` · ${email}` : ''}
              <span className="ml-2 font-normal text-text3">
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} learned
              </span>
            </span>
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            {syncFailed ? (
              <a
                href="/auth/gmail/start"
                className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-weak transition-colors hover:bg-weak-bg"
              >
                <Icon name="shield" size={16} />
                Reconnect
              </a>
            ) : (
              <button
                type="button"
                onClick={resync}
                disabled={syncing || disconnecting}
                className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-light disabled:opacity-60"
              >
                <Icon name="refresh" size={16} />
                {syncing ? 'Syncing…' : 'Sync'}
              </button>
            )}
            {confirm.armed ? (
              <>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={syncing || disconnecting}
                  className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-weak transition-colors disabled:opacity-60"
                >
                  {disconnecting ? 'Disconnecting…' : 'Confirm — delete trips?'}
                </button>
                <button
                  type="button"
                  onClick={confirm.disarm}
                  disabled={syncing || disconnecting}
                  className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={confirm.arm}
                disabled={syncing || disconnecting}
                className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
              >
                Disconnect
              </button>
            )}
          </div>
        </div>

        {syncFailed ? (
          <p className="border-t border-border bg-weak-bg px-5 py-2.5 text-[13px] text-weak sm:px-6">
            hop lost access to this inbox — trips below may be out of date.
            Reconnect to keep learning from new trips.
          </p>
        ) : null}
        {note ? (
          <p
            role="status"
            className="border-t border-border px-5 py-2.5 text-[13px] text-brand-deep sm:px-6"
          >
            {note}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="border-t border-border px-5 py-2.5 text-[13px] text-weak sm:px-6"
          >
            {error}
          </p>
        ) : null}

        {trips.length === 0 ? (
          <p className="border-t border-border px-5 py-3 text-[14px] leading-[1.5] text-text2 sm:px-6">
            No past trips found yet. Try Sync once you have flight or hotel
            confirmations in your inbox.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {trips
              .slice()
              .reverse()
              .map((t, i) => (
                <li
                  key={`${t.destinationCode ?? t.destinationCity}-${t.month}-${i}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"
                >
                  <span className="min-w-0 truncate text-[14px] font-medium text-text">
                    {t.destinationCity}
                    {t.destinationCode ? (
                      <span className="ml-1.5 text-text3">{t.destinationCode}</span>
                    ) : null}
                  </span>
                  <span className="flex flex-shrink-0 items-center gap-2 text-[12.5px] text-text2">
                    {t.cabin ? <span className="capitalize">{t.cabin}</span> : null}
                    {t.bookedWithPoints ? (
                      <span className="rounded-[6px] bg-brand-light px-1.5 py-0.5 text-[11px] font-semibold text-brand-deep">
                        points
                      </span>
                    ) : null}
                    <span>{monthLabel(t.month)}</span>
                  </span>
                </li>
              ))}
          </ul>
        )}
        <p className="border-t border-border px-5 py-2.5 text-[12px] text-text3 sm:px-6">
          hop reads only travel-confirmation emails and stores only these trip
          facts — never the email itself. Disconnect deletes them.
        </p>
      </Card>
    )
  }

  // Not connected. If the seam is gated off, keep the calm "coming soon" state.
  return (
    <Card surface="surface" radius="md" className="mt-4 flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name="receipt_long" size={24} weight="fill" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-text">
            Learn from your past trips
          </div>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-[1.55] text-text2">
            Connect Gmail and hop reads only your travel-confirmation emails to
            learn where and when you fly — so it suggests trips that fit you. It
            stores only the trip facts, never the emails, and you can disconnect
            anytime.
          </p>
        </div>
      </div>
      {enabled ? (
        <a
          href="/auth/gmail/start"
          className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-[12px] bg-brand px-5 py-2.5 text-[13.5px] font-semibold text-white transition-colors hover:bg-brand-deep sm:self-center"
        >
          <Icon name="shield" size={16} />
          Connect Gmail
        </a>
      ) : (
        <span className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-[12px] border border-border bg-sunk px-5 py-2.5 text-[13.5px] font-semibold text-text3 sm:self-center">
          Connect Gmail (soon)
        </span>
      )}
    </Card>
  )
}
