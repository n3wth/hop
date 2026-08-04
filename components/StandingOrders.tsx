'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { StandingOrder } from '@/lib/standing-orders-model'
import type { StandingOrderAlert } from '@/lib/standing-order-alerts'
import {
  createWatch,
  pauseWatch,
  removeWatch,
  clearAlertBadge,
} from '@/app/actions/standing-orders'
import Card from './ui/Card'
import BrandIcon from './BrandIcon'
import Icon from './Icon'
import { useToast } from './Toast'

// Standing Orders — "the verdict that watches". A plain-English watch box, the
// list of active/paused watches, and the alerts the cron has recorded. Flat,
// on-brand, no emojis. The server actions (app/actions/standing-orders.ts) do all
// the work; this just renders + calls them, then router.refresh() to re-read.

export default function StandingOrders({
  orders,
  alerts,
  unseen,
  cronLive,
}: {
  orders: StandingOrder[]
  alerts: StandingOrderAlert[]
  // Count of unseen alerts (drives the badge); cleared on mount.
  unseen: number
  // Whether the scheduled runner is enabled (STANDING_ORDERS_CRON_ENABLED). When
  // off, watches are saved but won't re-run yet — we tell the user honestly.
  cronLive: boolean
}) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <WatchComposer />
      {!cronLive ? (
        <p className="rounded-[12px] border border-border bg-sunk px-4 py-2.5 text-[12.5px] font-medium text-text2">
          Watches are saved, but automatic re-checks aren&apos;t live yet. hop will
          start running them on a schedule once the watcher is switched on.
        </p>
      ) : null}
      <WatchList orders={orders} />
      <AlertsList alerts={alerts} unseen={unseen} />
    </div>
  )
}

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

// --- NL composer ------------------------------------------------------------

function WatchComposer() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  function add() {
    if (!text.trim()) {
      setError('Describe what to watch')
      return
    }
    setError(null)
    setNote(null)
    start(async () => {
      const res = await createWatch(text)
      if (res.ok) {
        setText('')
        setNote(res.note ?? 'Watch created.')
        router.refresh()
      } else {
        setError(res.error ?? 'Could not create')
      }
    })
  }

  return (
    <Card as="section" surface="surface" className="overflow-hidden">
      <div className="flex items-start gap-4 px-5 py-5 sm:px-6">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name="notifications" size={24} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-text">Watch a route</div>
          <p className="mt-1 max-w-[56ch] text-[13.5px] leading-[1.55] text-text2">
            Describe it in plain English. hop re-runs the verdict on a schedule and
            pings you only when your own value bar is crossed.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                if (error) setError(null)
                if (note) setNote(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  add()
                }
              }}
              rows={2}
              maxLength={400}
              placeholder="watch SFO to Tokyo business 2026-03-25, ping me above 2.5 cpp using points I hold"
              aria-label="Describe a watch"
              className="no-inner-ring min-h-[64px] w-full resize-y rounded-[10px] border border-border bg-paper px-3.5 py-2.5 text-[14px] leading-[1.5] text-text outline-none transition-colors placeholder:text-text3 focus:border-brand"
            />
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="inline-flex flex-shrink-0 items-center justify-center gap-1.5 self-end rounded-[10px] bg-brand px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70 sm:self-stretch"
            >
              {pending ? 'Reading…' : 'Watch'}
              {!pending ? <Icon name="notifications" size={16} /> : null}
            </button>
          </div>
          {error ? (
            <p role="alert" className="mt-1.5 text-[12.5px] font-medium text-weak">
              {error}
            </p>
          ) : null}
          {note ? (
            <p role="status" className="mt-1.5 text-[12.5px] font-medium text-brand">
              {note}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

// --- Watch list -------------------------------------------------------------

function WatchList({ orders }: { orders: StandingOrder[] }) {
  if (orders.length === 0) {
    return (
      <Card surface="surface" className="flex items-start gap-4 px-6 py-6">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[12px] bg-brand-light text-brand">
          <Icon name="search" size={24} weight="fill" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-text">No watches yet</div>
          <p className="mt-1 max-w-[52ch] text-[13.5px] leading-[1.55] text-text2">
            Add one above and hop keeps re-running its verdict — you only hear from
            it when points beat cash on your terms.
          </p>
        </div>
      </Card>
    )
  }
  return (
    <Card as="section" surface="surface" className="overflow-hidden">
      <ul>
        {orders.map((o, i) => (
          <WatchRow key={o.id} order={o} first={i === 0} />
        ))}
      </ul>
    </Card>
  )
}

function WatchRow({ order, first }: { order: StandingOrder; first: boolean }) {
  const router = useRouter()
  // Per-row pending isolation: toggle and remove run on separate transitions, so
  // only the clicked button relabels.
  const [toggling, startToggle] = useTransition()
  const [removing, startRemove] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()

  function toggle() {
    setError(null)
    startToggle(async () => {
      const res = await pauseWatch(order.id, !order.active)
      if (res.ok) router.refresh()
      else setError(res.error ?? 'Could not update')
    })
  }
  function remove() {
    setError(null)
    confirm.disarm()
    startRemove(async () => {
      const res = await removeWatch(order.id)
      // A confirm-gated delete used to give no positive feedback beyond the
      // row silently vanishing on refresh — a toast confirms the action
      // actually landed, since router.refresh() alone is easy to miss.
      if (res.ok) {
        toast({ body: `Removed ${route}` })
        router.refresh()
      } else {
        setError(res.error ?? 'Could not remove')
      }
    })
  }

  const route = `${order.params.from} → ${order.params.to}`
  const dates = order.params.return
    ? `${order.params.depart} – ${order.params.return}`
    : order.params.depart
  const meta = [
    `≥ ${order.minCpp} cpp`,
    order.minCabin ? cap(order.minCabin) : null,
    order.seats > 1 ? `${order.seats} seats` : null,
    order.eligiblePrograms.length > 0 ? order.eligiblePrograms.join(', ') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <li
      className={`grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 sm:px-6 ${
        first ? '' : 'border-t border-border'
      } ${order.active ? '' : 'opacity-60'}`}
    >
      <BrandIcon code={order.params.to} name={order.params.to} size={40} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14.5px] font-semibold text-text">{route}</span>
          {!order.active ? (
            <span className="flex-shrink-0 rounded-[6px] bg-sunk px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-text3">
              Paused
            </span>
          ) : null}
        </div>
        <div className="mt-[2px] truncate text-[12.5px] text-text3">
          {dates} · {meta}
        </div>
        {error ? (
          <p role="alert" className="mt-1 text-[12px] font-medium text-weak">
            {error}
          </p>
        ) : null}
      </div>
      <span className="flex items-center gap-0.5 border-l border-hair pl-2 sm:pl-3">
        <button
          type="button"
          onClick={toggle}
          disabled={toggling || removing}
          aria-label={order.active ? `Pause ${route}` : `Resume ${route}`}
          className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-brand disabled:opacity-60"
        >
          {toggling ? '…' : order.active ? 'Pause' : 'Resume'}
        </button>
        {confirm.armed ? (
          <>
            <button
              type="button"
              onClick={remove}
              disabled={removing}
              aria-label={`Confirm remove ${route}`}
              className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-weak transition-colors disabled:opacity-60"
            >
              {removing ? '…' : 'Confirm?'}
            </button>
            <button
              type="button"
              onClick={confirm.disarm}
              disabled={removing}
              className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-text disabled:opacity-60"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={confirm.arm}
            disabled={toggling || removing}
            aria-label={`Remove ${route}`}
            className="rounded-[8px] px-2 py-1.5 text-[12.5px] font-semibold text-text3 transition-colors hover:text-weak disabled:opacity-60"
          >
            Remove
          </button>
        )}
      </span>
    </li>
  )
}

// --- Alerts -----------------------------------------------------------------

function AlertsList({ alerts, unseen }: { alerts: StandingOrderAlert[]; unseen: number }) {
  // Clear the unseen badge once the surface is on screen.
  useEffect(() => {
    if (unseen > 0) {
      void clearAlertBadge()
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (alerts.length === 0) return null

  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-brand-light bg-surface">
      <div className="flex items-center gap-2 border-b border-border bg-brand-light/60 px-5 py-3 sm:px-6">
        <Icon name="workspace_premium" size={16} className="text-brand" />
        <span className="text-[13px] font-semibold text-brand-deep">
          Your alerts
          {unseen > 0 ? (
            <span className="ml-2 rounded-full bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
              {unseen} new
            </span>
          ) : null}
        </span>
      </div>
      <ul>
        {alerts.map((a, i) => (
          <AlertRow key={a.id} alert={a} first={i === 0} />
        ))}
      </ul>
    </section>
  )
}

function AlertRow({ alert, first }: { alert: StandingOrderAlert; first: boolean }) {
  const cppText = Number.isFinite(alert.cpp) ? alert.cpp.toFixed(1) : '—'
  // Relative labels depend on Date.now(), which differs between the SSR render and
  // hydration — so we hold off until mounted (see useClientNow), keeping `when`
  // empty on the server and first client paint to avoid React #418, then fill it
  // in and refresh it on a timer.
  const now = useClientNow()
  const when = now != null && alert.createdAt ? relativeTime(alert.createdAt, now) : ''
  const program = alert.pick.program || alert.pick.airline || 'redemption'
  return (
    <li
      className={`grid grid-cols-[40px_1fr_auto] items-center gap-4 px-5 py-4 sm:px-6 ${
        first ? '' : 'border-t border-border'
      }`}
    >
      <BrandIcon
        code={alert.pick.airlineCode || alert.pick.destCode}
        name={program}
        size={40}
      />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold text-text">
          {alert.route} — points beat cash
        </div>
        <div className="mt-[2px] truncate text-[12.5px] text-text3">
          {program} at {cppText} cpp
          {when ? ` · ${when}` : ''}
        </div>
      </div>
      <span className="hop-num flex-shrink-0 text-[15px] font-semibold text-brand">
        {cppText}
        <span className="ml-0.5 text-[11px] font-medium text-text3">cpp</span>
      </span>
    </li>
  )
}

// --- small helpers ----------------------------------------------------------

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Client-only clock: null on the server and the first client render (so callers
// render nothing time-relative during SSR/hydration), then the real time once
// mounted, refreshed every minute so labels like "5m ago" stay current.
function useClientNow(intervalMs = 60_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = now - then
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}
