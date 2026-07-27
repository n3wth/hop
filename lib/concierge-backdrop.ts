import 'server-only'

import { topValue, imageQuery } from './destinations'
import { destinationImage, destinationImages } from './images'
import type { ConciergeHeroPhoto } from '@/components/ConciergeHero'

// A short rotation of top-value destination photos for the home teaser's
// live backdrop (ConciergeHero cross-fades through them). Same cached photo
// pipeline as everything else; [] on failure → the caller's flat fallback.
export async function conciergeGallery(n = 4): Promise<ConciergeHeroPhoto[]> {
  const picks = topValue(n)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))
  return picks.flatMap((d) => {
    const img = photos[imageQuery(d)]
    if (!img) return []
    return [
      { thumb: img.thumb, alt: img.alt, city: d.city, countryCode: d.countryCode, credit: img.credit },
    ]
  })
}

// The single canonical backdrop for the conversational hero teaser on the home.
// Picks the top-value destination's photo so the home hero wears the SAME
// photographic imagery as the /ask landing — one visual language across both
// front doors. Server-side (keeps the Unsplash key off the client); returns
// null on any failure so the hero falls back to the flat brand-ink panel.
export async function conciergeBackdrop(): Promise<ConciergeHeroPhoto | null> {
  const top = topValue(1)[0]
  if (!top) return null
  const img = await destinationImage(imageQuery(top))
  if (!img) return null
  return {
    thumb: img.thumb,
    alt: img.alt,
    city: top.city,
    countryCode: top.countryCode,
    credit: img.credit,
  }
}
