'use client'

import { useState } from 'react'
import Icon from './Icon'

interface NsFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  first?: boolean
}

function NsField({ label, value, onChange, first }: NsFieldProps) {
  return (
    <label
      className={[
        'flex min-w-0 cursor-text flex-col justify-center border-r border-hair transition-colors hover:bg-sunk',
        first ? 'pl-[26px] pr-[22px]' : 'px-[22px]',
      ].join(' ')}
    >
      <span className="text-[10px] font-bold uppercase leading-tight tracking-[0.06em] text-text3">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full whitespace-nowrap bg-transparent text-sm font-semibold leading-tight text-text outline-none"
      />
    </label>
  )
}

// Built-in full-height topbar search per v9: square edges flush into the topbar,
// hairline-divided fields, full-height teal search button, plus topbar-right.
export default function SearchBar() {
  const [from, setFrom] = useState('San Francisco')
  const [to, setTo] = useState('Los Angeles')
  const [dates, setDates] = useState('Jul 9 – 12')
  const [who, setWho] = useState('1 adult')

  return (
    <>
      <div className="flex max-w-[760px] flex-1 items-stretch border-r border-border">
        <NsField label="From" value={from} onChange={setFrom} first />
        <NsField label="To" value={to} onChange={setTo} />
        <NsField label="Dates" value={dates} onChange={setDates} />
        <NsField label="Who" value={who} onChange={setWho} />
        <button
          type="submit"
          aria-label="Search"
          className="flex w-sq flex-shrink-0 items-center justify-center bg-brand text-white transition-colors hover:bg-brand-deep"
        >
          <Icon name="search" size={22} />
        </button>
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-2 px-[22px]">
        <button
          type="button"
          aria-label="Notifications"
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-text2 transition-colors hover:bg-sunk"
        >
          <Icon name="notifications" size={22} />
        </button>
        <div className="ml-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-brand text-[13px] font-semibold text-white">
          O
        </div>
      </div>
    </>
  )
}
