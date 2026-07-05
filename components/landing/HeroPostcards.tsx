import { topValue, imageQuery, computeCpp } from '@/lib/destinations'
import { destinationImages } from '@/lib/images'
import PostcardDrift, { type Postcard } from './PostcardDrift'

// Server half of the hero's floating postcards: picks the best-value
// destinations, resolves their (cached) photography, and computes each card's
// ¢/pt — every number on a postcard comes from lib/*, never a model. Renders
// nothing when photos are unavailable (no key, upstream down): the hero simply
// stays typographic. Degrade the ornament, never the page.
export default async function HeroPostcards({ origin }: { origin: string }) {
  const picks = topValue(8)
  const photos = await destinationImages(picks.map((d) => imageQuery(d)))
  const cards: Postcard[] = picks.flatMap((d) => {
    const photo = photos[imageQuery(d)]
    if (!photo) return []
    return [
      {
        code: d.code,
        city: d.city,
        country: d.country,
        cpp: computeCpp(d),
        thumb: photo.thumb,
        color: photo.color,
        href: `/search?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(d.code)}&adults=1`,
      },
    ]
  })
  if (cards.length < 4) return null
  return <PostcardDrift cards={cards} />
}
