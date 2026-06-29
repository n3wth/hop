'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/Icon'
import { disconnectGmailHistory, resyncGmailHistory } from '@/app/actions/accounts'
import type { PastTrip } from '@/lib/travel-history'

// The "Trips" affordance on /account. Connect Gmail (explicit consent) so hop can
// learn from past trips, or disconnect + delete. When the seam is gated off
// (unconfigured), it stays in a calm "coming soon" state. Mirrors the AwardWallet
// connect/disconnect idiom. No raw email is ever read client-side — the OAuth
// flow + parsing happen server-side; this only shows state + drives the flow.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthLabel(m: string): string {
  const [y, mo] = m.split('-')
  const idx = Number(mo) - 1
  return `${MONTHS[idx] ?? mo} ${y}`
}

export default function GmailHistory({
  enabled,
  connected,
  email,
  trips,
}: {
  enabled: boolean
  connected: boolean
  email: string | null
  trips: PastTrip[]
}) {
  const router = useRouter()
  const [disconnecting, startDisconnect] = useTransition()
  const [syncing, startSync] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  function disconnect() {
    setError(null)
    setNote(null)
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
        router.refresh()
      } else setError(res.error ?? 'Could not sync')
    })
  }

  // Connected: show the linked inbox + parsed trips + disconnect/resync.
  if (connected) {
    return (
      <section className="mt-4 overflow-hidden rounded-[16px] border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
          <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-text2">
            <Icon name="check_circle" size={16} />
            <span className="truncate">
              Connected{email ? ` · ${email}` : ''}
              <span className="ml-2 font-normal text-text3">
                {trips.length} {trips.length === 1 ? 'trip' : 'trips'} learned
              </span>
            </span>
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={resync}
              disabled={syncing || disconnecting}
              className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-light disabled:opacity-60"
            >
              <Icon name="schedule" size={16} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={syncing || disconnecting}
              className="rounded-[10px] px-3 py-2 text-[13px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>

        {note ? (
          <p className="border-t border-border px-5 py-2.5 text-[13px] text-brand-deep sm:px-6">
            {note}
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-border px-5 py-2.5 text-[13px] text-text2 sm:px-6">
            {error}
          </p>
        ) : null}

        {trips.length === 0 ? (
          <p className="border-t border-border px-5 py-3 text-[13px] text-text2 sm:px-6">
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
      </section>
    )
  }

  // Not connected. If the seam is gated off, keep the calm "coming soon" state.
  return (
    <div className="mt-4 flex flex-col gap-4 rounded-[16px] border border-border bg-surface px-6 py-7 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name="receipt_long" size={22} />
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
          <Icon name="shield" size={18} />
          Connect Gmail
        </a>
      ) : (
        <span className="inline-flex flex-shrink-0 items-center gap-2 self-start rounded-[12px] border border-border bg-sunk px-5 py-2.5 text-[13.5px] font-semibold text-text3 sm:self-center">
          Connect Gmail (soon)
        </span>
      )}
    </div>
  )
}
