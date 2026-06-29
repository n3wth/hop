'use client'

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { searchAirports, airportByCode } from '@/lib/airports'
import { saveHomeAirport } from '@/app/actions/prefs'
import Icon from './Icon'

// Airport autocomplete + save. Used in the "set your home airport" prompt and in
// /account settings. On save, calls the server action; reports success/error.
export default function HomeAirportPicker({
  initial,
  onSaved,
  cta = 'Save',
}: {
  initial?: string
  onSaved?: (code: string) => void
  cta?: string
}) {
  const [code, setCode] = useState(initial ?? '')
  const [query, setQuery] = useState(
    initial ? `${initial} · ${airportByCode(initial)?.city ?? ''}` : '',
  )
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Flip the dropdown above the input when there isn't room below it (e.g. near
  // the bottom of the viewport or under the sticky header on short screens).
  const [flipUp, setFlipUp] = useState(false)
  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (i: number) => `${baseId}-opt-${i}`
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => (open ? searchAirports(query, 6) : []), [open, query])
  const hasResults = open && results.length > 0

  // Decide flip direction from available space when the list opens. Read layout
  // in a layout effect (never during render — React 19 rule on refs).
  useLayoutEffect(() => {
    if (!hasResults) return
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const below = window.innerHeight - rect.bottom
    setFlipUp(below < 280 && rect.top > below)
  }, [hasResults, results.length])

  // Keep the active option scrolled into view as the user arrows through.
  useEffect(() => {
    if (!hasResults) return
    const node = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`)
    node?.scrollIntoView({ block: 'nearest' })
    // optionId is derived from baseId (stable); active/hasResults drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasResults])

  function choose(c: string) {
    setCode(c)
    const a = airportByCode(c)
    setQuery(a ? `${c} · ${a.city}` : c)
    setOpen(false)
    setError(null)
  }

  function save() {
    if (!code) {
      setError('Pick an airport')
      return
    }
    start(async () => {
      const res = await saveHomeAirport(code)
      if (res.ok) onSaved?.(code)
      else setError(res.error ?? 'Could not save')
    })
  }

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start">
      <div ref={ref} className="relative flex-1">
        <input
          ref={inputRef}
          value={query}
          placeholder="City or airport"
          aria-label="Home airport"
          role="combobox"
          aria-controls={listId}
          aria-expanded={hasResults}
          aria-autocomplete="list"
          aria-activedescendant={hasResults ? optionId(active) : undefined}
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
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && results[active]) {
              e.preventDefault()
              choose(results[active].code)
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
          className="w-full rounded-[12px] border border-border bg-surface px-4 py-3 text-[15px] font-semibold text-text outline-none transition-colors focus:border-brand"
        />
        {hasResults && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Airport suggestions"
            className={`absolute left-0 z-[60] max-h-[260px] w-full overflow-auto rounded-[12px] border border-border bg-surface py-1 ${
              flipUp ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
            }`}
          >
            {results.map((a, i) => (
              <li key={a.code} id={optionId(i)} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    choose(a.code)
                  }}
                  className={`flex w-full cursor-pointer items-baseline gap-2.5 px-4 py-2 text-left transition-colors ${
                    i === active ? 'bg-sunk' : 'bg-surface'
                  }`}
                >
                  <span className="w-9 flex-shrink-0 font-display text-[13px] font-bold text-brand">
                    {a.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-text">
                      {a.city}
                    </span>
                    <span className="block truncate text-[11.5px] text-text3">{a.name}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error ? <p className="mt-1.5 text-[12.5px] font-medium text-weak">{error}</p> : null}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-[12px] bg-brand px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-70"
      >
        {pending ? 'Saving…' : cta}
        {!pending ? <Icon name="check_circle" size={17} /> : null}
      </button>
    </div>
  )
}
