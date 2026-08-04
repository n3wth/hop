// The self-hosted photo set must stay complete and honest: every curated
// destination has a local photo (both sizes on disk), every entry carries a
// real credit, and the query resolver actually hits for the strings the
// surfaces use — otherwise pages silently fall back to Unsplash and the
// rate-limit/attribution problems return.
import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { destinations, imageQuery } from '@/lib/destinations'
import {
  DESTINATION_PHOTOS,
  PHOTO_QUERY_ALIASES,
  PHOTO_CITY_INDEX,
} from '@/lib/destination-photos'

const PUB = join(process.cwd(), 'public')

describe('self-hosted destination photos', () => {
  it('covers every curated destination', () => {
    for (const d of destinations) {
      expect(DESTINATION_PHOTOS[d.code], `${d.code} ${d.city} has no photo`).toBeTruthy()
    }
  })

  it('both sizes exist on disk for every entry', () => {
    for (const [code, p] of Object.entries(DESTINATION_PHOTOS)) {
      expect(existsSync(join(PUB, p.src)), `${code} missing ${p.src}`).toBe(true)
      expect(existsSync(join(PUB, p.thumbSrc)), `${code} missing ${p.thumbSrc}`).toBe(true)
    }
  })

  it('every entry carries a linkable credit and license', () => {
    for (const [code, p] of Object.entries(DESTINATION_PHOTOS)) {
      expect(p.credit.name, code).toBeTruthy()
      expect(p.credit.link, code).toMatch(/^https:\/\//)
      expect(p.credit.license, code).toBeTruthy()
      expect(['Pexels', 'Wikimedia Commons']).toContain(p.credit.source)
    }
  })

  it('resolves every curated imageQuery via the exact-alias path', () => {
    for (const d of destinations) {
      expect(PHOTO_QUERY_ALIASES[imageQuery(d).toLowerCase()], d.code).toBe(d.code)
    }
  })

  it('resolves free-text city queries via containment (sample-verdict style)', () => {
    const q = 'los angeles skyline palm trees'.toLowerCase()
    const hit = Object.keys(PHOTO_CITY_INDEX).find((city) => q.includes(city))
    expect(hit && PHOTO_CITY_INDEX[hit]).toBe('LAX')
  })
})
