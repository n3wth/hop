'use client'

import { useId, useMemo, useRef, useState } from 'react'
import { listPrograms, type ProgramDef, type ProgramKind } from '@/lib/programs'
import BrandIcon from './BrandIcon'

// Smart program picker — a free-text combobox over the canonical registry
// (lib/programs.ts). Typing filters by name AND aliases, so "amex", "membership
// rewards", or "mr" all surface Amex Membership Rewards. Each suggestion shows
// its brand chip + kind so the user recognizes the real program. Selecting fills
// the CANONICAL name; the server still canonicalizes on submit, so even an
// unmatched free-text entry is safe — this just makes the right pick obvious.
//
// Flat, on-brand, no emoji. Keyboard-accessible: ArrowUp/Down move the active
// option, Enter selects it, Escape closes. ARIA combobox roles throughout.

const ALL = listPrograms()

const KIND_LABEL: Record<ProgramKind, string> = {
  bank: 'Card',
  airline: 'Airline',
  hotel: 'Hotel',
}

// Tolerant local filter: match the query against the canonical name + every
// alias. Substring is enough here (the server does the heavy canonicalization);
// we just want fast, forgiving suggestions as the user types.
function filterPrograms(query: string): ProgramDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return ALL
  return ALL.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true
    return p.aliases.some((a) => a.includes(q))
  })
}

export default function ProgramPicker({
  value,
  onChange,
  onEnterEmpty,
  error,
  disabled,
}: {
  value: string
  // Fires on every keystroke AND on selection (selection passes the canonical name).
  onChange: (next: string) => void
  // Enter pressed while the listbox is closed — let the parent submit the form.
  onEnterEmpty?: () => void
  error?: boolean
  disabled?: boolean
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const matches = useMemo(() => filterPrograms(value), [value])
  const showList = open && matches.length > 0

  function select(p: ProgramDef) {
    onChange(p.name)
    setOpen(false)
    setActive(0)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!showList) {
        setOpen(true)
        return
      }
      setActive((a) => Math.min(a + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      if (showList && matches[active]) {
        e.preventDefault()
        select(matches[active])
      } else {
        onEnterEmpty?.()
      }
    } else if (e.key === 'Escape') {
      if (showList) {
        e.preventDefault()
        setOpen(false)
      }
    }
  }

  return (
    <div className="relative flex-1">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so a click on an option (which blurs the input) still registers.
          blurTimer.current = setTimeout(() => setOpen(false), 120)
        }}
        onKeyDown={onKeyDown}
        placeholder="Program (e.g. United MileagePlus)"
        aria-label="Program"
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        disabled={disabled}
        className={`w-full rounded-[10px] border bg-paper px-3.5 py-2.5 text-[14px] font-semibold text-text outline-none transition-colors focus:border-brand disabled:opacity-60 ${
          error ? 'border-weak' : 'border-border'
        }`}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Programs"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-[280px] overflow-auto rounded-[12px] border border-border bg-paper py-1"
        >
          {matches.map((p, i) => (
            <li
              key={p.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                // Prevent the input blur from firing before the click selects.
                e.preventDefault()
                if (blurTimer.current) clearTimeout(blurTimer.current)
                select(p)
              }}
              className={`flex cursor-pointer items-center gap-3 px-2.5 py-2 transition-colors ${
                i === active ? 'bg-brand-light' : ''
              }`}
            >
              <BrandIcon code={p.code} name={p.name} size={30} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text">
                {p.name}
              </span>
              <span className="flex-shrink-0 text-[11.5px] font-medium uppercase tracking-wide text-text3">
                {KIND_LABEL[p.kind]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
