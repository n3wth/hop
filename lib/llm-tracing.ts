import type { TelemetryOptions } from 'ai'

import { env, hasEnv, isLlmTracingEnabled } from '@/lib/env'

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

export type LlmTracingConfig = {
  projectToken: string
  host: string
}

/** Resolve exporter config lazily. Flag off or key absent is a clean no-op. */
export function resolveLlmTracingConfig(): LlmTracingConfig | null {
  if (!isLlmTracingEnabled()) return null

  const host =
    hasEnv('POSTHOG_HOST') ||
    hasEnv('NEXT_PUBLIC_POSTHOG_HOST') ||
    hasEnv('NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST')
      ? env.llmTracingPosthogHost()
      : DEFAULT_POSTHOG_HOST

  return {
    projectToken: env.llmTracingPosthogKey(),
    host: host.replace(/\/+$/, ''),
  }
}

/**
* AI SDK telemetry settings shared by every LLM call.
*
* The SDK records inputs and outputs by default, so both privacy controls stay
* explicit here. Operational metadata such as function, model, token usage,
* and latency remains available when tracing is enabled.
*/
export function llmTelemetry(functionId: string): TelemetryOptions {
  return {
    isEnabled: isLlmTracingEnabled(),
    functionId,
    recordInputs: false,
    recordOutputs: false,
  }
}
