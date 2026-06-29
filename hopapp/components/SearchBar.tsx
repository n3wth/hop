'use client'

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import Icon from './Icon'
import { searchAirports, airportByCode, cityForCode } from '@/lib/airports'

// ── shared helpers ───────────────────────────────────────────────────────────

// ISO "YYYY-MM-DD" for a Date, in local terms (no tz drift — we only use y/m/d).
function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Parse "YYYY-MM-DD" to a local Date at midnight. Falsy/invalid → null.
function fromISO(iso: string): Date | null {
  const [y, m, d] = (iso ?? '').split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function fmtDay(iso: string): string {
  const d = fromISO(iso)
  if (!d) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtRange(depart: string, ret: string): string {
  if (!ret) return fmtDay(depart)
  const a = fromISO(depart)
  const b = fromISO(ret)
  if (!a || !b) return fmtDay(depart)
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${fmtDay(depart)} – ${b.getDate()}`
  }
  return `${fmtDay(depart)} – ${fmtDay(ret)}`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

// Close-on-outside-click + Escape for any popover.
function usePopover(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return ref
}

// ── Airport typeahead field ──────────────────────────────────────────────────

interface AirportFieldProps {
  label: string
  code: string
  onSelect: (code: string) => void
  inputClassName?: string
  labelClassName?: string
  /** The other field's code — excluded from this list so origin ≠ destination. */
  excludeCode?: string
}

function AirportField({
  label,
  code,
  onSelect,
  inputClassName,
  labelClassName,
  excludeCode,
}: AirportFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = usePopover(open, () => setOpen(false))
  const listId = useId()

  // When closed, show the selected city; when open, show what's being typed.
  const display = open ? query : cityForCode(code)
  // Pull one extra then drop the other field's airport — same one can't be both.
  const results = useMemo(
    () =>
      searchAirports(open ? query : '', 7)
        .filter((a) => a.code !== excludeCode)
        .slice(0, 6),
    [open, query, excludeCode],
  )

  function choose(c: string) {
    onSelect(c)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={ref} className="relative flex min-w-0 flex-col justify-center leading-[1.05]">
      <span
        className={
          labelClassName ??
          'text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2'
        }
      >
        {label}
      </span>
      <input
        value={display}
        placeholder="City or airport"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        onFocus={() => {
          setOpen(true)
          setQuery('')
          setActive(0)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          if (!open) setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((a) => Math.min(results.length - 1, a + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((a) => Math.max(0, a - 1))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const hit = results[active]
            if (hit) choose(hit.code)
          }
        }}
        className={
          inputClassName ?? 'w-full bg-transparent font-semibold text-text outline-none'
        }
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-[calc(100%+10px)] z-[60] max-h-[280px] w-[260px] overflow-auto rounded-xl border border-border bg-surface py-1"
        >
          {results.map((a, i) => (
            <li key={a.code} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  choose(a.code)
                }}
                className={`flex w-full items-baseline gap-2.5 px-3.5 py-2 text-left ${
                  i === active ? 'bg-sunk' : 'bg-surface'
                }`}
              >
                <span className="w-9 flex-shrink-0 font-display text-[13px] font-bold tracking-tight text-brand">
                  {a.code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-text">
                    {a.city}
                  </span>
                  <span className="block truncate text-[11.5px] text-text3">
                    {a.name}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Calendar (depart → return) ───────────────────────────────────────────────

interface CalendarPopProps {
  depart: string
  ret: string
  oneWay: boolean
  onOneWayChange: (oneWay: boolean) => void
  onChange: (depart: string, ret: string) => void
  children: (open: boolean, toggle: () => void) => ReactNode
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function MonthGrid({
  year,
  month,
  depart,
  ret,
  today,
  onPick,
}: {
  year: number
  month: number
  depart: Date | null
  ret: Date | null
  today: Date
  onPick: (d: Date) => void
}) {
  const first = new Date(year, month, 1)
  const lead = first.getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d))

  const sameDay = (a: Date | null, b: Date | null) =>
    !!a && !!b && a.getTime() === b.getTime()

  return (
    <div className="w-[224px]">
      <div className="mb-2 text-center text-[13px] font-semibold text-text">
        {MONTHS[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={i}
            className="grid h-6 place-items-center text-[10px] font-semibold uppercase text-text3"
          >
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const disabled = d.getTime() < today.getTime()
          const isStart = sameDay(d, depart)
          const isEnd = sameDay(d, ret)
          const inRange =
            depart && ret && d.getTime() > depart.getTime() && d.getTime() < ret.getTime()
          const selected = isStart || isEnd
          return (
            <div key={i} className="grid place-items-center">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(d)}
                className={`grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[12.5px] font-medium transition-colors ${
                  disabled
                    ? 'cursor-not-allowed text-text3/50 hover:bg-transparent'
                    : selected
                      ? 'bg-brand font-semibold text-white'
                      : inRange
                        ? 'bg-brand-light text-brand-deep hover:bg-brand-mint-deep'
                        : 'text-text hover:bg-brand-light hover:text-brand-deep'
                }`}
              >
                {d.getDate()}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalendarPop({ depart, ret, oneWay, onOneWayChange, onChange, children }: CalendarPopProps) {
  const [open, setOpen] = useState(false)
  const ref = usePopover(open, () => setOpen(false))
  const today = useMemo(() => startOfDay(new Date()), [])
  const departD = fromISO(depart)
  const retD = oneWay ? null : fromISO(ret)
  // Which month the left pane shows; anchored on the depart month.
  const [view, setView] = useState(() => {
    const base = departD ?? today
    return { year: base.getFullYear(), month: base.getMonth() }
  })

  function shift(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  function pick(d: Date) {
    // One way → a single date pick is the whole trip; never set a return.
    if (oneWay) {
      onChange(toISO(d), '')
      setOpen(false)
      return
    }
    // No depart yet, or both set, or picking before depart → start fresh.
    if (!departD || (departD && retD) || d.getTime() < departD.getTime()) {
      onChange(toISO(d), '')
    } else {
      onChange(toISO(departD), toISO(d))
      setOpen(false)
    }
  }

  const next = new Date(view.year, view.month + 1, 1)

  return (
    <div ref={ref} className="relative">
      {children(open, () => setOpen((o) => !o))}
      {open && (
        <div className="absolute left-0 top-[calc(100%+10px)] z-[60] rounded-xl border border-border bg-surface p-4">
          {/* trip-type lives here (Google-Flights style), not in the search row */}
          <div className="mb-3 flex justify-center border-b border-hair pb-3">
            <TripTypeToggle oneWay={oneWay} onChange={onOneWayChange} />
          </div>
          <div className="mb-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
              className="grid h-7 w-7 place-items-center rounded-full text-text2 hover:bg-sunk"
            >
              <span className="-scale-x-100">
                <Icon name="expand_more" size={18} className="-rotate-90" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shift(1)}
              className="grid h-7 w-7 place-items-center rounded-full text-text2 hover:bg-sunk"
            >
              <Icon name="expand_more" size={18} className="-rotate-90" />
            </button>
          </div>
          <div className="flex gap-5">
            <MonthGrid
              year={view.year}
              month={view.month}
              depart={departD}
              ret={retD}
              today={today}
              onPick={pick}
            />
            <MonthGrid
              year={next.getFullYear()}
              month={next.getMonth()}
              depart={departD}
              ret={retD}
              today={today}
              onPick={pick}
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-hair pt-3 text-[12px] text-text3">
            <span>
              {departD
                ? oneWay
                  ? fmtDay(depart)
                  : fmtRange(depart, ret)
                : oneWay
                  ? 'Pick a date'
                  : 'Pick depart date'}
            </span>
            {departD && (
              <button
                type="button"
                onClick={() => onChange('', '')}
                className="font-semibold text-brand hover:text-brand-deep"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Who stepper ──────────────────────────────────────────────────────────────

function WhoPop({
  adults,
  onChange,
  children,
}: {
  adults: number
  onChange: (n: number) => void
  children: (open: boolean, toggle: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = usePopover(open, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      {children(open, () => setOpen((o) => !o))}
      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-[60] w-[220px] rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13.5px] font-semibold text-text">Adults</div>
              <div className="text-[11.5px] text-text3">Age 13+</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Fewer adults"
                disabled={adults <= 1}
                onClick={() => onChange(Math.max(1, adults - 1))}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-text disabled:cursor-not-allowed disabled:text-text3 enabled:hover:bg-sunk"
              >
                <span className="text-[18px] leading-none">−</span>
              </button>
              <span className="w-4 text-center text-[14px] font-semibold tabular-nums text-text">
                {adults}
              </span>
              <button
                type="button"
                aria-label="More adults"
                disabled={adults >= 9}
                onClick={() => onChange(Math.min(9, adults + 1))}
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-text disabled:cursor-not-allowed disabled:text-text3 enabled:hover:bg-sunk"
              >
                <span className="text-[18px] leading-none">+</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Full search form ─────────────────────────────────────────────────────────

export interface SearchState {
  from: string
  to: string
  depart: string
  ret: string
  adults: number
  oneWay: boolean
}

function whoLabel(n: number) {
  return n === 1 ? '1 adult' : `${n} adults`
}

// Today at local midnight, as ISO — the floor for any valid depart/return.
function todayISO(): string {
  return toISO(startOfDay(new Date()))
}

// Validate a search; returns a user-facing message or null when it's good to go.
function validateSearch(s: SearchState): string | null {
  if (!s.from || !s.to) return 'Pick an origin and destination.'
  if (s.from === s.to) return 'Origin and destination can’t match.'
  if (!s.depart) return 'Pick a departure date.'
  const floor = todayISO()
  if (s.depart < floor) return 'Departure can’t be in the past.'
  if (!s.oneWay) {
    if (!s.ret) return 'Pick a return date, or switch to one way.'
    if (s.ret < s.depart) return 'Return can’t be before departure.'
  }
  return null
}

// Round-trip / one-way segmented toggle. Flat, brand-tinted active pill.
function TripTypeToggle({
  oneWay,
  onChange,
}: {
  oneWay: boolean
  onChange: (oneWay: boolean) => void
}) {
  return (
    <div className="inline-flex rounded-full border border-border bg-surface p-[3px] text-[12.5px] font-semibold">
      <button
        type="button"
        aria-pressed={!oneWay}
        onClick={() => onChange(false)}
        className={`rounded-full px-3.5 py-1.5 ${
          !oneWay ? 'bg-brand text-white' : 'text-text2'
        }`}
      >
        Round trip
      </button>
      <button
        type="button"
        aria-pressed={oneWay}
        onClick={() => onChange(true)}
        className={`rounded-full px-3.5 py-1.5 ${
          oneWay ? 'bg-brand text-white' : 'text-text2'
        }`}
      >
        One way
      </button>
    </div>
  )
}

// The full editable From/To/Dates/Who form. `variant` switches between the
// desktop inline pill and the stacked mobile panel; both share all logic.
export function SearchForm({
  initial,
  variant,
  onSubmitted,
  scrolled = false,
}: {
  initial: SearchState
  variant: 'desktop' | 'mobile'
  onSubmitted?: () => void
  /** Header collapsed (scrolled) — desktop pill goes transparent/borderless. */
  scrolled?: boolean
}) {
  const router = useRouter()
  const [s, setS] = useState<SearchState>(initial)
  const [error, setError] = useState<string | null>(null)

  // Re-sync local edits when the server sends new params (e.g. after a search
  // navigation). React's "adjust state during render" pattern — keyed on the
  // committed param tuple — avoids the cascading-render cost of an effect.
  const initialKey = `${initial.from}|${initial.to}|${initial.depart}|${initial.ret}|${initial.adults}|${initial.oneWay}`
  const [syncedKey, setSyncedKey] = useState(initialKey)
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey)
    setS(initial)
    setError(null)
  }

  // Pick an airport for one field, keeping origin ≠ destination by swapping when
  // the chosen code already occupies the other field (the nicest collision UX).
  function pickFrom(c: string) {
    setError(null)
    setS((p) => (c === p.to ? { ...p, from: c, to: p.from } : { ...p, from: c }))
  }
  function pickTo(c: string) {
    setError(null)
    setS((p) => (c === p.from ? { ...p, to: c, from: p.to } : { ...p, to: c }))
  }

  // Switching to one way drops the return; switching back leaves it for re-pick.
  function setOneWay(oneWay: boolean) {
    setError(null)
    setS((p) => ({ ...p, oneWay, ret: oneWay ? '' : p.ret }))
  }

  // Reverse the route — swap From/To (and their displayed cities follow state).
  function swapFromTo() {
    setError(null)
    setS((p) => ({ ...p, from: p.to, to: p.from }))
  }

  function submit() {
    const from = airportByCode(s.from)?.code ?? s.from
    const to = airportByCode(s.to)?.code ?? s.to
    const msg = validateSearch({ ...s, from, to })
    if (msg) {
      setError(msg)
      return
    }
    const qs = new URLSearchParams({
      from,
      to,
      depart: s.depart,
      adults: String(s.adults),
    })
    if (!s.oneWay && s.ret) qs.set('return', s.ret)
    onSubmitted?.()
    router.push(`/search?${qs.toString()}`)
  }

  if (variant === 'mobile') {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex flex-col gap-3"
      >
        <div className="relative flex flex-col gap-2 rounded-xl border border-border bg-paper p-3">
          <AirportField
            label="From"
            code={s.from}
            onSelect={pickFrom}
            excludeCode={s.to}
            inputClassName="w-full bg-transparent text-[15px] font-semibold text-text outline-none"
          />
          <div className="h-px w-full bg-hair" />
          <AirportField
            label="To"
            code={s.to}
            onSelect={pickTo}
            excludeCode={s.from}
            inputClassName="w-full bg-transparent text-[15px] font-semibold text-text outline-none"
          />
          <button
            type="button"
            aria-label="Swap origin and destination"
            onClick={swapFromTo}
            className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface text-brand transition-colors hover:bg-sunk"
          >
            <Icon name="swap_horiz" size={18} className="rotate-90" />
          </button>
        </div>

        <CalendarPop
          depart={s.depart}
          ret={s.ret}
          oneWay={s.oneWay}
          onOneWayChange={setOneWay}
          onChange={(depart, ret) => {
            setError(null)
            setS((p) => ({ ...p, depart, ret }))
          }}
        >
          {(open, toggle) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex w-full flex-col items-start rounded-xl border border-border bg-paper p-3 text-left"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
                {s.oneWay ? 'Date' : 'Dates'}
              </span>
              <span className="text-[15px] font-semibold text-text">
                {s.oneWay ? fmtDay(s.depart) : fmtRange(s.depart, s.ret)}
              </span>
            </button>
          )}
        </CalendarPop>

        <WhoPop
          adults={s.adults}
          onChange={(n) => setS((p) => ({ ...p, adults: n }))}
        >
          {(open, toggle) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex w-full flex-col items-start rounded-xl border border-border bg-paper p-3 text-left"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
                Who
              </span>
              <span className="text-[15px] font-semibold text-text">
                {whoLabel(s.adults)}
              </span>
            </button>
          )}
        </WhoPop>

        {error && (
          <p role="alert" className="text-[12.5px] font-medium text-weak">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          <Icon name="search" size={18} />
          Search
        </button>
      </form>
    )
  }

  // desktop — form is the relative container so validation + popovers anchor to
  // it. Chrome (border/bg) dissolves on scroll so the fields blend into the
  // frosted header; layout/size stays stable horizontally either way.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="relative flex items-center rounded-full border"
      style={{
        gap: 16,
        paddingLeft: 22,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        background: scrolled ? 'transparent' : 'var(--color-surface)',
        borderColor: scrolled ? 'transparent' : 'var(--color-border)',
        transition: 'background 280ms cubic-bezier(.2,0,0,1), border-color 280ms cubic-bezier(.2,0,0,1)',
      }}
    >
      <AirportField
        label="From"
        code={s.from}
        onSelect={pickFrom}
        excludeCode={s.to}
        inputClassName="w-[112px] bg-transparent text-[15px] font-semibold text-text outline-none"
      />
      <button
        type="button"
        aria-label="Swap origin and destination"
        onClick={swapFromTo}
        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-brand transition-colors hover:bg-sunk"
      >
        <Icon name="swap_horiz" size={20} />
      </button>
      <AirportField
        label="To"
        code={s.to}
        onSelect={pickTo}
        excludeCode={s.from}
        inputClassName="w-[112px] bg-transparent text-[15px] font-semibold text-text outline-none"
      />

      <span className="h-[26px] w-px flex-shrink-0 bg-border" />

      <CalendarPop
        depart={s.depart}
        ret={s.ret}
        oneWay={s.oneWay}
        onOneWayChange={setOneWay}
        onChange={(depart, ret) => {
          setError(null)
          setS((p) => ({ ...p, depart, ret }))
        }}
      >
          {(open, toggle) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex flex-col justify-center text-left leading-[1.05]"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
                {s.oneWay ? 'Date' : 'Dates'}
              </span>
              <span className="w-[120px] text-[15px] font-semibold text-text">
                {s.oneWay ? fmtDay(s.depart) : fmtRange(s.depart, s.ret)}
              </span>
            </button>
          )}
        </CalendarPop>

        <span className="h-[26px] w-px flex-shrink-0 bg-border" />

        <WhoPop adults={s.adults} onChange={(n) => setS((p) => ({ ...p, adults: n }))}>
          {(open, toggle) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex flex-col justify-center text-left leading-[1.05]"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
                Who
              </span>
              <span className="w-[64px] text-[15px] font-semibold text-text">
                {whoLabel(s.adults)}
              </span>
            </button>
          )}
        </WhoPop>

      <button
        type="submit"
        aria-label="Search"
        className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-deep"
      >
        <Icon name="search" size={19} />
      </button>

      {error && (
        <p
          role="alert"
          className="absolute left-0 top-[calc(100%+6px)] z-[55] whitespace-nowrap rounded-lg border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-weak"
        >
          {error}
        </p>
      )}
    </form>
  )
}
