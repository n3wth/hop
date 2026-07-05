// Location photography via Unsplash. Server-side only (uses the access key).
// Results are cached in-process per query so we don't hit the API on every
// render, and Next's fetch cache (revalidate) keeps it cheap across requests.

import { averageColorHex, blurhashToDataUri } from './blurhash'
import { cacheWrap } from './cache'

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

export interface DestImage {
  url: string // regular-size image URL
  thumb: string // small thumb URL
  alt: string
  credit: { name: string; link: string } // Unsplash attribution (per API terms)
  color?: string // avg color from the photo's blurhash (instant flat fallback)
  blur?: string // tiny blurred SVG placeholder data URI — fades the photo up
}

// Fetch one landscape photo for a query (e.g. "Tokyo Japan skyline").
// Returns null on any failure — callers fall back to a solid tile.
export async function destinationImage(query: string): Promise<DestImage | null> {
  if (!ACCESS_KEY) return null
  const key = query.toLowerCase().trim()

  return cacheWrap<DestImage | null>(`hop:img:${key}`, 86400, async () => {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
          query,
        )}&per_page=1&orientation=landscape&content_filter=high`,
        {
          headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
          // cache a day — destination photos don't need to be fresh
          next: { revalidate: 86400 },
          // Hard timeout — a slow (not down) Unsplash response must never stall
          // the page it's ornamenting. AbortError lands in the catch below,
          // same as any other failure → null → cached as a miss → callers'
          // solid fallback (degrade the ornament, never the page).
          signal: AbortSignal.timeout(1500),
        },
      )
      if (!res.ok) return null
      const data = await res.json()
      const p = data.results?.[0]
      if (!p) return null
      // Unsplash returns a blurhash for every photo — decode it once here into a
      // flat avg color + a blurred placeholder so the photo fades up instead of
      // popping in. Bad/absent hash → undefined (callers keep the solid fallback).
      const hash: string | undefined = p.blur_hash
      const img: DestImage = {
        url: p.urls.regular,
        thumb: p.urls.small,
        alt: p.alt_description ?? query,
        credit: {
          name: p.user?.name ?? 'Unsplash',
          link: p.user?.links?.html ?? 'https://unsplash.com',
        },
        color: hash ? averageColorHex(hash) ?? undefined : undefined,
        blur: hash ? blurhashToDataUri(hash) ?? undefined : undefined,
      }
      // Unsplash API terms require pinging download_location once per "use" of
      // a photo, separate from attribution. Fire-and-forget — a slow/failing
      // tracking call must never delay or break the page render. This sits
      // inside the cacheWrap callback, so it only fires on a genuine cache
      // miss (once per query per 24h TTL), not on every cached read.
      const downloadLocation: string | undefined = p.links?.download_location
      if (downloadLocation) {
        fetch(downloadLocation, { headers: { Authorization: `Client-ID ${ACCESS_KEY}` } }).catch(
          () => {},
        )
      }
      return img
    } catch {
      return null
    }
  })
}

// Batch helper — fetch images for many destinations in parallel (capped).
export async function destinationImages(
  queries: string[],
): Promise<Record<string, DestImage | null>> {
  const out: Record<string, DestImage | null> = {}
  await Promise.all(
    queries.map(async (q) => {
      out[q] = await destinationImage(q)
    }),
  )
  return out
}
