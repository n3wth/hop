import { topValue, imageQuery, computeCpp } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import { POINTS_THRESHOLD_CPP } from '@/lib/search'
import ShowcaseRotator, { type ShowcaseEntry } from './ShowcaseRotator'
import HeroAmbience from './HeroAmbience'

// The hero's single composed centerpiece: one large destination photo with the
// PRODUCT layered on it — a small paper card carrying the engine's numbers for
// that exact place (¢/pt, typical miles, the program that books it, and a
// "points win" chip only when the engine's own threshold says so). One
// deliberate object, not scattered ornaments (docs/design/experience-
// heuristics.md). Renders nothing when photography is unavailable — the hero
// stays typographic.
export default async function HeroShowcase({ origin }: { origin: string }) {
  const picks = topValue(5)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))
  // Map all picks first, then filter — ensures stable ordering regardless of
  // photo availability (prevents hydration flash when server/client differ).
  const entriesAll: (ShowcaseEntry | null)[] = picks.map((d) => {
    const photo = photos[imageQuery(d)]
    const cppVal = computeCpp(d)
    if (cppVal === undefined) return null
    return {
      code: d.code,
      city: d.city,
      country: d.country,
      cpp: cppVal,
      miles: d.typicalAwardMiles,
      program: d.bestProgram,
      cabin: d.cabin,
      // Engine threshold, not vibes: the chip only appears when the same
      // line the verdict engine uses says points beat cash.
      pointsWin: cppVal >= POINTS_THRESHOLD_CPP,
      image: photo?.url ?? '',
      thumb: photo?.thumb ?? '',
      color: photo?.color,
      href: `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(d.code)}&adults=1`,
    }
  })
  const entries = entriesAll.filter((e): e is ShowcaseEntry => e !== null)
  if (entries.length < 2) return null
  return (
    <>
      {/* anchors to the hero SECTION (its nearest positioned ancestor) */}
      <HeroAmbience entries={entries} />
      <ShowcaseRotator entries={entries} />
    </>
  )
}
