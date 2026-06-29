// Location photography via Unsplash. Server-side only (uses the access key).
// Results are cached in-process per query so we don't hit the API on every
// render, and Next's fetch cache (revalidate) keeps it cheap across requests.

const ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY

export interface DestImage {
  url: string // regular-size image URL
  thumb: string // small thumb URL
  alt: string
  credit: { name: string; link: string } // Unsplash attribution (per API terms)
}

const memo = new Map<string, DestImage | null>()

// Fetch one landscape photo for a query (e.g. "Tokyo Japan skyline").
// Returns null on any failure — callers fall back to a solid tile.
export async function destinationImage(query: string): Promise<DestImage | null> {
  if (!ACCESS_KEY) return null
  const key = query.toLowerCase().trim()
  if (memo.has(key)) return memo.get(key)!

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(
        query,
      )}&per_page=1&orientation=landscape&content_filter=high`,
      {
        headers: { Authorization: `Client-ID ${ACCESS_KEY}` },
        // cache a day — destination photos don't need to be fresh
        next: { revalidate: 86400 },
      },
    )
    if (!res.ok) {
      memo.set(key, null)
      return null
    }
    const data = await res.json()
    const p = data.results?.[0]
    if (!p) {
      memo.set(key, null)
      return null
    }
    const img: DestImage = {
      url: p.urls.regular,
      thumb: p.urls.small,
      alt: p.alt_description ?? query,
      credit: {
        name: p.user?.name ?? 'Unsplash',
        link: p.user?.links?.html ?? 'https://unsplash.com',
      },
    }
    memo.set(key, img)
    return img
  } catch {
    memo.set(key, null)
    return null
  }
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
