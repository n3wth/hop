import type { LlmTracingConfig } from '@/lib/llm-tracing'
import { resolveLlmTracingConfig } from '@/lib/llm-tracing'

export type StartLlmTracing = (config: LlmTracingConfig) => void | Promise<void>

async function startNodeLlmTracing(config: LlmTracingConfig): Promise<void> {
  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { resourceFromAttributes } = await import('@opentelemetry/resources')
  const { PostHogSpanProcessor } = await import('@posthog/ai/otel')

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'hop',
      app: 'hop',
      billing: 'metered',
      env: process.env.VERCEL_ENV ?? 'development',
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        projectToken: config.projectToken,
        host: config.host,
      }),
    ],
  })

  await sdk.start()
}

/** Start Node-only LLM tracing without ever delaying or breaking app startup. */
export async function registerLlmTracing(
  start: StartLlmTracing = startNodeLlmTracing,
): Promise<boolean> {
  try {
    const config = resolveLlmTracingConfig()
    if (!config) return false
    await start(config)
    return true
  } catch {
    return false
  }
}
