'use client'

import { SearchForm, type SearchState } from '@/components/SearchBar'

// Hero search — the front door's primary action. Renders the editable
// From/To/Dates/Who form (submitting runs a real search). Picks the desktop
// pill on wide screens and the stacked panel on mobile, so the same form is
// comfortable at every width. Flat surface, no shadow — the locked system.
export default function HeroSearch({ initial }: { initial: SearchState }) {
  return (
    <div className="w-full">
      {/* desktop / tablet — the inline pill, on a solid white surface */}
      <div className="hidden rounded-full border border-border bg-surface md:block">
        <SearchForm initial={initial} variant="desktop" />
      </div>
      {/* mobile — the stacked panel */}
      <div className="md:hidden">
        <SearchForm initial={initial} variant="mobile" />
      </div>
    </div>
  )
}
