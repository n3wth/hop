'use client'

import { SearchForm, type SearchState } from '@/components/SearchBar'

// Hero search — the front door's primary action. Renders the editable
// From/To/Dates/Who form (submitting runs a real search). The desktop variant
// is a self-contained white pill; the mobile variant is a stacked panel that
// fills the column. Flat surface, no shadow — the locked system.
export default function HeroSearch({ initial }: { initial: SearchState }) {
  return (
    <>
      {/* desktop / tablet — the inline pill (brings its own white chrome) */}
      <div className="hidden justify-start md:flex">
        <SearchForm initial={initial} variant="desktop" />
      </div>
      {/* mobile — the stacked panel fills the column */}
      <div className="md:hidden">
        <SearchForm initial={initial} variant="mobile" />
      </div>
    </>
  )
}
