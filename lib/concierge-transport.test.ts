import { describe, it, expect, vi, afterEach } from 'vitest'
import { ConciergeTransport, type HopUIMessage } from './concierge-transport'
import { A2UI_SENTINEL, TOOL_FRAME_SEP } from '@/app/api/concierge/route'

// Build a fake /api/concierge byte stream from ordered chunks and assert the
// transport translates it into UIMessageChunks whose ORDER preserves where each
// tool fired — the regression guard for "tool calls render below later prose".

function frame(obj: Record<string, unknown>): string {
  return TOOL_FRAME_SEP + JSON.stringify(obj) + TOOL_FRAME_SEP
}

function responseFrom(chunks: string[]): Response {
  const enc = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch))
      c.close()
    },
  })
  return new Response(body)
}

async function run() {
  const transport = new ConciergeTransport(() => undefined)
  const messages: HopUIMessage[] = [
    { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hi' }] },
  ]
  const stream = await transport.sendMessages({
    messages,
    abortSignal: undefined,
    // unused by ConciergeTransport but required by the type
  } as unknown as Parameters<ConciergeTransport['sendMessages']>[0])
  const reader = stream.getReader()
  const out: Array<Record<string, unknown>> = []
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    out.push(value as unknown as Record<string, unknown>)
  }
  return out
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ConciergeTransport stream ordering', () => {
  it('renders a tool BETWEEN the prose before it and the prose after it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        responseFrom([
          'Let me check the weather. ',
          frame({ id: 'w1', tool: 'get_weather', state: 'input-available' }),
          frame({ id: 'w1', tool: 'get_weather', state: 'output-available' }),
          'Tokyo looks sunny.',
        ]),
      ),
    )

    const out = await run()
    const types = out.map((c) => c.type)

    // Sequence of structural events: a text segment closes, the tool appears,
    // then a NEW text segment opens — so prose-after never precedes the tool.
    const firstTextEnd = types.indexOf('text-end')
    const toolIdx = types.indexOf('data-tool')
    const secondTextStart = types.indexOf('text-start', firstTextEnd + 1)

    expect(firstTextEnd).toBeGreaterThan(-1)
    expect(toolIdx).toBeGreaterThan(firstTextEnd)
    expect(secondTextStart).toBeGreaterThan(toolIdx)

    // The text BEFORE the tool and AFTER the tool live in different segments.
    const beforeId = (out[firstTextEnd] as { id: string }).id
    const afterId = (out[secondTextStart] as { id: string }).id
    expect(beforeId).not.toBe(afterId)

    const beforeText = out
      .filter((c) => c.type === 'text-delta' && (c as { id: string }).id === beforeId)
      .map((c) => (c as { delta: string }).delta)
      .join('')
    const afterText = out
      .filter((c) => c.type === 'text-delta' && (c as { id: string }).id === afterId)
      .map((c) => (c as { delta: string }).delta)
      .join('')
    expect(beforeText).toContain('check the weather')
    expect(afterText).toContain('Tokyo looks sunny')
  })

  it('emits the trailing a2ui envelope as a data part, never as visible prose', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        responseFrom([
          'Here you go.',
          A2UI_SENTINEL + JSON.stringify({ blocks: [{ type: 'prompt_chips', chips: ['Build a 5-day plan'] }] }),
        ]),
      ),
    )

    const out = await run()
    const allText = out
      .filter((c) => c.type === 'text-delta')
      .map((c) => (c as { delta: string }).delta)
      .join('')
    expect(allText).toBe('Here you go.')
    expect(allText).not.toContain('prompt_chips')

    const a2ui = out.find((c) => c.type === 'data-a2ui') as
      | { data: { blocks: Array<{ type: string; chips?: string[] }> } }
      | undefined
    expect(a2ui).toBeTruthy()
    expect(a2ui!.data.blocks[0]).toMatchObject({ type: 'prompt_chips', chips: ['Build a 5-day plan'] })
  })
})
