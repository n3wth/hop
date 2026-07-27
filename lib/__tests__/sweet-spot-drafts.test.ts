import { describe, it, expect, afterEach } from 'vitest'
import {
  createSweetSpotDraft,
  listSweetSpotDrafts,
  updateSweetSpotDraftWhy,
  setSweetSpotDraftStatus,
  getApprovedDraftSpots,
  draftableProgramOptions,
  draftSweetSpotWhy,
  SWEET_SPOT_WHY_SYSTEM_PROMPT,
} from '@/lib/sweet-spot-drafts'
import { allPrograms } from '@/lib/sweet-spots'

// Like every owner lib, persistence degrades via withDb — with no db
// configured in the test env, every function must resolve to its safe
// fallback rather than throw. The AI draft call is separately gated on the
// gateway key (mirrors lib/support-reply.ts) and must not require the network.

const ORIGINAL_GATEWAY_KEY = process.env.AI_GATEWAY_API_KEY
afterEach(() => {
  if (ORIGINAL_GATEWAY_KEY === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = ORIGINAL_GATEWAY_KEY
})

describe('draftableProgramOptions() — pure', () => {
  it('matches the static program list, one entry per program', () => {
    const options = draftableProgramOptions()
    expect(options.map((o) => o.slug).sort()).toEqual([...allPrograms()].sort())
    for (const o of options) expect(o.name.length).toBeGreaterThan(0)
  })
})

// Regression for a P1 caught in review: the prompt used to ask the model to
// "state ... the rough cents-per-point or cash comparison" while the facts it
// was given never included a cash price — the only way to honor that
// instruction was to fabricate a number, violating hop's "never LLM-generate
// an economic figure" invariant. Assert directly on the prompt text so this
// can't silently regress.
describe('SWEET_SPOT_WHY_SYSTEM_PROMPT — never asks the model to invent a figure', () => {
  it('does not instruct the model to state a cpp/cash figure unconditionally', () => {
    expect(SWEET_SPOT_WHY_SYSTEM_PROMPT).not.toMatch(/state.{0,40}(cents-per-point|cash comparison)/i)
  })

  it('explicitly forbids computing or estimating a number', () => {
    expect(SWEET_SPOT_WHY_SYSTEM_PROMPT).toMatch(/never.{0,20}(invent|change|compute|estimate)/i)
  })

  it('only permits restating a figure that is already given, never calculating one', () => {
    expect(SWEET_SPOT_WHY_SYSTEM_PROMPT.toLowerCase()).toContain('restate')
  })
})

describe('createSweetSpotDraft() — validates before ever touching the db', () => {
  const valid = {
    route: 'US ↔ Testland',
    programSlug: allPrograms()[0],
    cabin: 'Business',
    milesLabel: '50k',
    createdBy: 'owner@hop.flights',
  }

  it('rejects an unknown programSlug', async () => {
    await expect(createSweetSpotDraft({ ...valid, programSlug: 'not-a-real-program' })).resolves.toBeNull()
  })

  it('rejects an invalid cabin', async () => {
    await expect(createSweetSpotDraft({ ...valid, cabin: 'Cargo' })).resolves.toBeNull()
  })

  it('rejects missing route/milesLabel/createdBy', async () => {
    await expect(createSweetSpotDraft({ ...valid, route: '' })).resolves.toBeNull()
    await expect(createSweetSpotDraft({ ...valid, milesLabel: '' })).resolves.toBeNull()
    await expect(createSweetSpotDraft({ ...valid, createdBy: '' })).resolves.toBeNull()
  })

  it('returns null (degrades) for valid input when the db is unconfigured', async () => {
    await expect(createSweetSpotDraft(valid)).resolves.toBeNull()
  })

  it('never throws on junk input', async () => {
    // @ts-expect-error — exercising a non-object argument at runtime
    await expect(createSweetSpotDraft(null)).resolves.toBeNull()
  })
})

describe('listSweetSpotDrafts() / getApprovedDraftSpots() — degrade', () => {
  it('returns null when the db is unconfigured', async () => {
    await expect(listSweetSpotDrafts()).resolves.toBeNull()
  })

  it('getApprovedDraftSpots falls back to [] when the db is unconfigured', async () => {
    await expect(getApprovedDraftSpots()).resolves.toEqual([])
  })
})

describe('updateSweetSpotDraftWhy() — validates + degrades', () => {
  it('returns false for empty why without touching the db', async () => {
    await expect(updateSweetSpotDraftWhy('some-id', '   ')).resolves.toBe(false)
  })

  it('returns false for a missing id', async () => {
    await expect(updateSweetSpotDraftWhy('', 'a good reason')).resolves.toBe(false)
  })

  it('returns false (degrades) when the db is unconfigured', async () => {
    await expect(updateSweetSpotDraftWhy('some-id', 'a good reason')).resolves.toBe(false)
  })
})

describe('setSweetSpotDraftStatus() — validates + degrades', () => {
  it('rejects an unknown status', async () => {
    // @ts-expect-error — exercising a bad status value at runtime
    await expect(setSweetSpotDraftStatus('some-id', 'live')).resolves.toBe(false)
  })

  it('returns false (degrades) for a valid status when the db is unconfigured', async () => {
    await expect(setSweetSpotDraftStatus('some-id', 'approved')).resolves.toBe(false)
  })
})

describe('draftSweetSpotWhy() — gated + graceful', () => {
  const facts = { route: 'US ↔ Testland', program: 'Test Program', cabin: 'Business', milesLabel: '50k' }

  it('returns null (no network) when the AI gateway is unconfigured', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    await expect(draftSweetSpotWhy(facts)).resolves.toBeNull()
  })

  it('returns null for incomplete facts without calling out', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    await expect(draftSweetSpotWhy({ ...facts, route: '' })).resolves.toBeNull()
  })

  it('never throws on odd input', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    // @ts-expect-error — exercising a null argument at runtime
    await expect(draftSweetSpotWhy(null)).resolves.toBeNull()
  })
})
