// Serializer: ENGINE LedgerDream -> the plain, client-safe DreamCardData the card
// renders. One source of truth so the signed-in home module and the /api/dream/card
// GET (for "Dream me another") build the exact same shape. Pure; no I/O here —
// callers pass the already-resolved photo + initial (templated) blurb.

import type { LedgerDream } from '@/lib/ledger-dream'
import type { DestImage } from '@/lib/images'

// Mirror of components/LedgerDreamCard.DreamCardData. Kept here so server code can
// produce it without importing the client component.
export interface DreamCardData {
  city: string
  country: string
  countryCode: string
  vibe: string
  code: string
  milesNeeded: number
  /** Cabin the miles/cash figures price — shown when premium. */
  cabin?: 'business' | 'first'
  cpp?: number
  cashValue: number
  program: string
  effectiveBalance?: number
  transferFrom?: { source: string; ratio: string }
  pathLabel: string
  viaKind?: 'direct' | 'transfer'
  saveToward: boolean
  affordableNow: boolean
  photo?: { url: string; alt: string; credit: { name: string; link: string; source?: string; sourceLink?: string } } | null
  searchHref: string
  initialBlurb: string
}

// Build the "make it real" search href — a seeded search into hop's verdict for
// this exact destination. origin defaults to SFO when no home airport is known.
export function dreamSearchHref(code: string, origin = 'SFO'): string {
  return `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(code)}&adults=1`
}

export function toDreamCardData(
  dream: LedgerDream,
  photo: DestImage | null,
  initialBlurb: string,
  origin = 'SFO',
): DreamCardData {
  const d = dream.destination
  return {
    city: d.city,
    country: d.country,
    countryCode: d.countryCode,
    vibe: d.vibe,
    code: d.code,
    milesNeeded: dream.milesNeeded,
    cabin: dream.destination.cabin,
    cpp: dream.cpp,
    cashValue: dream.cashValue,
    program: dream.proof.program,
    effectiveBalance: dream.proof.effectiveBalance,
    transferFrom: dream.proof.transferFrom,
    pathLabel: dream.proof.path,
    viaKind: dream.via?.kind,
    saveToward: dream.saveToward,
    affordableNow: dream.affordableNow,
    photo: photo
      ? { url: photo.url, alt: photo.alt, credit: photo.credit }
      : null,
    searchHref: dreamSearchHref(d.code, origin),
    initialBlurb,
  }
}
