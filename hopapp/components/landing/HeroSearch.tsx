'use client'

import { SearchForm, type SearchState } from '@/components/SearchBar'

// Hero search — the front door's primary action. Renders the editable
// From/To/Dates/Who form (submitting runs a real search). The desktop variant
// is a self-contained white pill; the mobile variant is a stacked panel that
// fills the column. Flat surface, no shadow — the locked system.
//
// align: 'center' for the centered marketing hero; 'start' when the search sits
// inside a left-aligned card (e.g. the signed-in "Got a trip in mind?" box) so
// the pill lines up with the heading instead of floating in the middle.
export default function HeroSearch({
  initial,
  align = 'center',
}: {
  initial: SearchState
  align?: 'center' | 'start'
}) {
  return (
    <>
      {/* desktop / tablet — the inline pill (brings its own white chrome) */}
      <div className={`hidden md:flex ${align === 'start' ? 'justify-start' : 'justify-center'}`}>
        <SearchForm initial={initial} variant="desktop" />
      </div>
      {/* mobile — the stacked panel fills the column */}
      <div className="md:hidden">
        <SearchForm initial={initial} variant="mobile" />
      </div>
    </>
  )
}
