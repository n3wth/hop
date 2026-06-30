import { describe, it, expect, afterEach } from 'vitest'
import { draftSupportReply } from '@/lib/support-reply'

// The AI draft is GATED on the gateway key and NEVER throws — no key (the test
// env) or empty input just means no draft (a human writes the reply). It must not
// require the network to resolve.

const ORIGINAL = process.env.AI_GATEWAY_API_KEY
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = ORIGINAL
})

describe('draftSupportReply() — gated + graceful', () => {
  it('returns null (no network) when the AI gateway is unconfigured', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    await expect(
      draftSupportReply({ from: 'a@b.com', subject: 'help', body: 'how do points work?' }),
    ).resolves.toBeNull()
  })

  it('returns null for empty input without calling out', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    await expect(draftSupportReply({ from: 'a@b.com', subject: '', body: '' })).resolves.toBeNull()
  })

  it('never throws on odd input', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    await expect(
      draftSupportReply({ from: 'a@b.com', subject: null, body: null }),
    ).resolves.toBeNull()
  })
})
