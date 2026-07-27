import { OpenTelemetry } from '@ai-sdk/otel'
import { trace, TraceFlags, type Span, type Tracer } from '@opentelemetry/api'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { registerLlmTracing } from '../../instrumentation.node'
import { isLlmTracingEnabled } from '@/lib/env'
import {
  llmTelemetry,
  resolveLlmTracingConfig,
  startLlmTraceAnchor,
  traceIdForHeader,
  withLlmTraceAnchor,
} from '@/lib/llm-tracing'

const TRACING_ENV = [
  'HOP_ENABLE_LLM_TRACING',
  'POSTHOG_KEY',
  'POSTHOG_HOST',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN',
  'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST',
] as const

let originalEnv: Partial<Record<(typeof TRACING_ENV)[number], string>>

beforeEach(() => {
  originalEnv = {}
  for (const key of TRACING_ENV) {
    if (process.env[key] !== undefined) originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of TRACING_ENV) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
})

function enableConfig(): void {
  process.env.HOP_ENABLE_LLM_TRACING = '1'
  process.env.POSTHOG_KEY = 'test-project-key'
}

describe('LLM tracing configuration', () => {
  it('is disabled by default and does not resolve exporter config', () => {
    expect(isLlmTracingEnabled()).toBe(false)
    expect(resolveLlmTracingConfig()).toBeNull()
  })

  it('stays disabled when only the flag or only a project key is configured', () => {
    process.env.HOP_ENABLE_LLM_TRACING = '1'
    expect(isLlmTracingEnabled()).toBe(false)
    expect(resolveLlmTracingConfig()).toBeNull()

    delete process.env.HOP_ENABLE_LLM_TRACING
    process.env.POSTHOG_KEY = 'test-project-key'
    expect(isLlmTracingEnabled()).toBe(false)
    expect(resolveLlmTracingConfig()).toBeNull()
  })

  it('resolves configured tracing with the default normalized host', () => {
    process.env.HOP_ENABLE_LLM_TRACING = 'yes'
    process.env.POSTHOG_KEY = 'test-project-key'

    expect(isLlmTracingEnabled()).toBe(true)
    expect(resolveLlmTracingConfig()).toEqual({
      projectToken: 'test-project-key',
      host: 'https://us.i.posthog.com',
    })
  })

  it('preserves the Vercel integration aliases without bypassing the flag', () => {
    process.env.HOP_ENABLE_LLM_TRACING = 'true'
    process.env.NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN = 'integration-key'
    process.env.NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST = 'https://example.test///'

    expect(resolveLlmTracingConfig()).toEqual({
      projectToken: 'integration-key',
      host: 'https://example.test',
    })
  })
})

describe('AI SDK telemetry privacy settings', () => {
  it('keeps content recording off and has no integration while disabled', () => {
    expect(llmTelemetry('concierge')).toEqual({
      isEnabled: false,
      functionId: 'concierge',
      recordInputs: false,
      recordOutputs: false,
    })

    enableConfig()
    const telemetry = llmTelemetry('dream')
    expect(telemetry).toMatchObject({
      isEnabled: true,
      functionId: 'dream',
      recordInputs: false,
      recordOutputs: false,
    })
    expect(Array.isArray(telemetry.integrations)).toBe(true)
  })

  it('attaches OpenTelemetry per call without global registration', async () => {
    enableConfig()
    expect(await registerLlmTracing(vi.fn().mockResolvedValue(undefined))).toBe(true)

    const telemetry = llmTelemetry('concierge')
    expect(telemetry).toMatchObject({
      isEnabled: true,
      functionId: 'concierge',
      recordInputs: false,
      recordOutputs: false,
    })
    expect(Array.isArray(telemetry.integrations)).toBe(true)
    const integrations = telemetry.integrations as unknown[]
    expect(integrations).toHaveLength(1)
    expect(integrations[0]).toBeInstanceOf(OpenTelemetry)
    expect(globalThis.AI_SDK_TELEMETRY_INTEGRATIONS).toBeUndefined()
  })
})

describe('Node tracing startup', () => {
  it('does not initialize when tracing is disabled or missing a key', async () => {
    const start = vi.fn()

    expect(await registerLlmTracing(start)).toBe(false)
    process.env.HOP_ENABLE_LLM_TRACING = '1'
    expect(await registerLlmTracing(start)).toBe(false)
    expect(start).not.toHaveBeenCalled()
  })

  it('initializes once when enabled and configured', async () => {
    enableConfig()
    const start = vi.fn().mockResolvedValue(undefined)

    expect(await registerLlmTracing(start)).toBe(true)
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith({
      projectToken: 'test-project-key',
      host: 'https://us.i.posthog.com',
    })
  })

  it('swallows optional exporter startup failures', async () => {
    enableConfig()

    expect(
      await registerLlmTracing(() => {
        throw new Error('exporter unavailable')
      }),
    ).toBe(false)
  })
})

describe('trace feedback linkage', () => {
  const validTraceId = '1234567890abcdef1234567890abcdef'
  const validSpanId = '1234567890abcdef'

  function span(recording: boolean, traceId = validTraceId): Pick<Span, 'isRecording' | 'spanContext'> {
    return {
      isRecording: () => recording,
      spanContext: () => ({ traceId, spanId: validSpanId, traceFlags: TraceFlags.SAMPLED }),
    }
  }

  it('accepts only recording spans with valid non-zero ids', () => {
    expect(traceIdForHeader(span(true))).toBe(validTraceId)
    expect(traceIdForHeader(span(false))).toBeNull()
    expect(traceIdForHeader(span(true, '0'.repeat(32)))).toBeNull()
  })

  it('does not mint an anchor while tracing is disabled', () => {
    const startSpan = vi.fn()
    const tracer = { startSpan } as unknown as Tracer

    expect(startLlmTraceAnchor('concierge.turn', tracer)).toBeNull()
    expect(startSpan).not.toHaveBeenCalled()
  })

  it('returns a valid recording parent for the concierge context and header', () => {
    enableConfig()
    const end = vi.fn()
    const recordingSpan = { ...span(true), end } as unknown as Span
    const tracer = { startSpan: vi.fn(() => recordingSpan) } as unknown as Tracer

    const anchor = startLlmTraceAnchor('concierge.turn', tracer)
    expect(anchor).toEqual({ span: recordingSpan, traceId: validTraceId })
    expect(end).not.toHaveBeenCalled()
  })

  it('makes the validated anchor the active parent context for the AI call', () => {
    enableConfig()
    const recordingSpan = { ...span(true), end: vi.fn() } as unknown as Span
    const tracer = { startSpan: vi.fn(() => recordingSpan) } as unknown as Tracer
    const anchor = startLlmTraceAnchor('concierge.turn', tracer)
    const run = vi.fn(() => 'result')

    const result = withLlmTraceAnchor(anchor, run, (parentContext, callback) => {
      expect(trace.getSpan(parentContext)).toBe(recordingSpan)
      return callback()
    })

    expect(result).toBe('result')
    expect(run).toHaveBeenCalledOnce()
  })

  it('rejects a non-recording or invalid provider span and ends it', () => {
    enableConfig()
    const end = vi.fn()
    const invalidSpan = { ...span(false), end } as unknown as Span
    const tracer = { startSpan: vi.fn(() => invalidSpan) } as unknown as Tracer

    expect(startLlmTraceAnchor('concierge.turn', tracer)).toBeNull()
    expect(end).toHaveBeenCalledOnce()
  })
})
