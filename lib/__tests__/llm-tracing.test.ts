import { beforeEach, describe, expect, it, vi } from 'vitest'

import { registerLlmTracing } from '../../instrumentation.node'
import { isLlmTracingEnabled } from '@/lib/env'
import { llmTelemetry, resolveLlmTracingConfig } from '@/lib/llm-tracing'

const TRACING_ENV = [
  'HOP_ENABLE_LLM_TRACING',
  'POSTHOG_KEY',
  'POSTHOG_HOST',
  'NEXT_PUBLIC_POSTHOG_KEY',
  'NEXT_PUBLIC_POSTHOG_HOST',
  'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN',
  'NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST',
] as const

beforeEach(() => {
  for (const key of TRACING_ENV) delete process.env[key]
})

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
  it('always disables input and output recording while retaining the function id', () => {
    expect(llmTelemetry('concierge')).toEqual({
      isEnabled: false,
      functionId: 'concierge',
      recordInputs: false,
      recordOutputs: false,
    })

    process.env.HOP_ENABLE_LLM_TRACING = '1'
    process.env.POSTHOG_KEY = 'test-project-key'

    expect(llmTelemetry('dream')).toEqual({
      isEnabled: true,
      functionId: 'dream',
      recordInputs: false,
      recordOutputs: false,
    })
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
    process.env.HOP_ENABLE_LLM_TRACING = '1'
    process.env.POSTHOG_KEY = 'test-project-key'
    const start = vi.fn().mockResolvedValue(undefined)

    expect(await registerLlmTracing(start)).toBe(true)
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith({
      projectToken: 'test-project-key',
      host: 'https://us.i.posthog.com',
    })
  })

  it('swallows optional exporter startup failures', async () => {
    process.env.HOP_ENABLE_LLM_TRACING = '1'
    process.env.POSTHOG_KEY = 'test-project-key'

    expect(
      await registerLlmTracing(() => {
        throw new Error('exporter unavailable')
      }),
    ).toBe(false)
  })
})
