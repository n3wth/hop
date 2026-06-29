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
}

function AirportField({
  label,
  code,
  onSelect,
  inputClassName,
  labelClassName,
}: AirportFieldProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = usePopover(open, () => setOpen(false))
  const listId = useId()

  // When closed, show the selected city; when open, show what's being typed.
  const display = open ? query : cityForCode(code)
  const results = useMemo(
    () => searchAirports(open ? query : '', 6),
    [open, query],
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
                className={`grid h-8 w-8 place-items-center rounded-full text-[12.5px] font-medium ${
                  disabled
                    ? 'cursor-not-allowed text-text3'
                    : selected
                      ? 'bg-brand font-semibold text-white'
                      : inRange
                        ? 'bg-brand-light text-brand-deep'
                        : 'text-text hover:bg-sunk'
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

function CalendarPop({ depart, ret, onChange, children }: CalendarPopProps) {
  const [open, setOpen] = useState(false)
  const ref = usePopover(open, () => setOpen(false))
  const today = useMemo(() => startOfDay(new Date()), [])
  const departD = fromISO(depart)
  const retD = fromISO(ret)
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
              {departD ? fmtRange(depart, ret) : 'Pick depart date'}
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
}

function whoLabel(n: number) {
  return n === 1 ? '1 adult' : `${n} adults`
}

// The full editable From/To/Dates/Who form. `variant` switches between the
// desktop inline pill and the stacked mobile panel; both share all logic.
export function SearchForm({
  initial,
  variant,
  onSubmitted,
}: {
  initial: SearchState
  variant: 'desktop' | 'mobile'
  onSubmitted?: () => void
}) {
  const router = useRouter()
  const [s, setS] = useState<SearchState>(initial)

  // Re-sync local edits when the server sends new params (e.g. after a search
  // navigation). React's "adjust state during render" pattern — keyed on the
  // committed param tuple — avoids the cascading-render cost of an effect.
  const initialKey = `${initial.from}|${initial.to}|${initial.depart}|${initial.ret}|${initial.adults}`
  const [syncedKey, setSyncedKey] = useState(initialKey)
  if (syncedKey !== initialKey) {
    setSyncedKey(initialKey)
    setS(initial)
  }

  function submit() {
    const from = airportByCode(s.from)?.code ?? s.from
    const to = airportByCode(s.to)?.code ?? s.to
    const qs = new URLSearchParams({
      from,
      to,
      depart: s.depart,
      adults: String(s.adults),
    })
    if (s.ret) qs.set('return', s.ret)
    onSubmitted?.()
    router.push(`/?${qs.toString()}`)
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
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-paper p-3">
          <AirportField
            label="From"
            code={s.from}
            onSelect={(c) => setS((p) => ({ ...p, from: c }))}
            inputClassName="w-full bg-transparent text-[15px] font-semibold text-text outline-none"
          />
          <div className="h-px w-full bg-hair" />
          <AirportField
            label="To"
            code={s.to}
            onSelect={(c) => setS((p) => ({ ...p, to: c }))}
            inputClassName="w-full bg-transparent text-[15px] font-semibold text-text outline-none"
          />
        </div>

        <CalendarPop
          depart={s.depart}
          ret={s.ret}
          onChange={(depart, ret) => setS((p) => ({ ...p, depart, ret }))}
        >
          {(open, toggle) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex w-full flex-col items-start rounded-xl border border-border bg-paper p-3 text-left"
            >
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
                Dates
              </span>
              <span className="text-[15px] font-semibold text-text">
                {fmtRange(s.depart, s.ret)}
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

  // desktop
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex items-center rounded-full border border-border bg-surface"
      style={{ gap: 16, paddingLeft: 22, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }}
    >
      <AirportField
        label="From"
        code={s.from}
        onSelect={(c) => setS((p) => ({ ...p, from: c }))}
        inputClassName="w-[112px] bg-transparent text-[15px] font-semibold text-text outline-none"
      />
      <span className="flex-shrink-0 text-brand">
        <Icon name="swap_horiz" size={20} />
      </span>
      <AirportField
        label="To"
        code={s.to}
        onSelect={(c) => setS((p) => ({ ...p, to: c }))}
        inputClassName="w-[112px] bg-transparent text-[15px] font-semibold text-text outline-none"
      />

      <span className="h-[26px] w-px flex-shrink-0 bg-border" />

      <CalendarPop
        depart={s.depart}
        ret={s.ret}
        onChange={(depart, ret) => setS((p) => ({ ...p, depart, ret }))}
      >
        {(open, toggle) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="flex flex-col justify-center text-left leading-[1.05]"
          >
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
              Dates
            </span>
            <span className="w-[120px] text-[15px] font-semibold text-text">
              {fmtRange(s.depart, s.ret)}
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
    </form>
  )
}
