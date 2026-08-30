import { describe, it, expect } from 'vitest'
import { sweetSpots, sweetSpotsByProgram, allPrograms } from '@/lib/sweet-spots'
import { getAllSweetSpots, getSweetSpotsByProgram, getProgramBySlug } from '@/lib/sweet-spots-live'

// No db is configured in the test env, so getApprovedDraftSpots() always
// resolves to [] — the merged (live) view must then be identical to the
// static table's own grouping. This is the safety net for the merge: a down
// db degrades to "static only", never to something worse.

describe('sweet-spots-live — merges with an empty (unconfigured) drafts queue', () => {
  it('getAllSweetSpots() equals the static table', async () => {
    await expect(getAllSweetSpots()).resolves.toEqual(sweetSpots)
  })

  it('getSweetSpotsByProgram() equals sweetSpotsByProgram()', async () => {
    await expect(getSweetSpotsByProgram()).resolves.toEqual(sweetSpotsByProgram())
  })

  it('getProgramBySlug() matches programBySlug() for every known program', async () => {
    for (const slug of allPrograms()) {
      const live = await getProgramBySlug(slug)
      const stat = sweetSpotsByProgram().find((p) => p.slug === slug)
      expect(live).toEqual(stat)
    }
  })

  it('getProgramBySlug() is undefined for an unknown slug', async () => {
    await expect(getProgramBySlug('not-a-real-program')).resolves.toBeUndefined()
  })
})
