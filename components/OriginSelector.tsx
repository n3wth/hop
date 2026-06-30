'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { searchAirports, airportByCode } from '@/lib/airports'
import { useOrigin } from '@/lib/origin-context'
import Icon from './Icon'

// Compact "where from" control for the TopNav — a flat pill that states the
// current origin ("From SFO") and opens a small popover to set or change it.
// Reuses the bundled airport list + the shared origin context so the choice
// sticks across every surface (home, ask, search, deals). Keyboard accessible,
// WCAG AA, no shadows/gradients — same flat vocabulary as the search popovers.
export default function OriginSelector() {
  const { origin, setOrigin } = useOrigin()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const baseId = useId()
  const listId = `${baseId}-list`
  const optionId = (i: number) => `${baseId}-opt-${i}`

  // Empty query shows the popular hubs; otherwise rank by the shared matcher.
  const results = useMemo(() => searchAirports(query, 6), [query])

  // Close on outside click + Escape (same lightweight pattern as SearchBar's
  // usePopover). Lives inline so this component stays self-contained.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Focus the input when the popover opens so typing starts immediately.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  // Keep the active option in view as the user arrows through the list.
  useEffect(() => {
    if (!open) return
    const node = listRef.current?.querySelector<HTMLElement>(`#${CSS.escape(optionId(active))}`)
    node?.scrollIntoView({ block: 'nearest' })
    // optionId derives from the stable baseId; active/open drive this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  function choose(code: string) {
    setOrigin(code)
    setOpen(false)
    setQuery('')
    setActive(0)
  }

  // Accept a typed value too: a known airport by city/code wins; otherwise a
  // bare 3-letter code is taken as-is (context normalizes + guards the shape).
  function commitTyped() {
    const hit = results[active] ?? (query.trim() ? searchAirports(query, 1)[0] : undefined)
    if (hit) {
      choose(hit.code)
      return
    }
    const code = query.trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(code)) choose(code)
  }

  const label = origin ? `From ${origin}` : 'Set origin'

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={origin ? `Departure airport: ${origin}. Change` : 'Set your departure airport'}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-[13px] font-semibold text-text transition-colors hover:bg-sunk"
      >
        <Icon name="flight" size={15} className="flex-shrink-0 text-brand" />
        <span className="tabular-nums">{label}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Set departure airport"
          className="absolute right-0 top-[calc(100%+10px)] z-[80] w-[280px] rounded-xl border border-border bg-surface p-3"
        >
          <span className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text2">
            Where from
          </span>
          <input
            ref={inputRef}
            value={query}
            placeholder="City or airport"
            role="combobox"
            aria-label="Departure airport"
            aria-controls={listId}
            aria-expanded={results.length > 0}
            aria-autocomplete="list"
            aria-activedescendant={results.length > 0 ? optionId(active) : undefined}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(i + 1, results.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                commitTyped()
              }
            }}
            className="w-full rounded-[12px] border border-border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand"
          />

          {results.length > 0 && (
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              aria-label="Airport suggestions"
              className="mt-2 max-h-[240px] overflow-auto rounded-[12px] border border-border bg-surface py-1"
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
                    className={`flex w-full cursor-pointer items-baseline gap-2.5 px-3.5 py-2 text-left transition-colors ${
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
                      <span className="block truncate text-[11.5px] text-text3">{a.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Clear — only when an origin is set, so the user can unset it. */}
          {origin ? (
            <div className="mt-2 flex items-center justify-between border-t border-hair pt-2 text-[12px] text-text3">
              <span className="truncate">{airportByCode(origin)?.city ?? origin}</span>
              <button
                type="button"
                onClick={() => {
                  setOrigin(null)
                  setOpen(false)
                  setQuery('')
                }}
                className="font-semibold text-brand transition-colors hover:text-brand-deep"
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
