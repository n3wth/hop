// PostHog LLM analytics. The AI SDK emits gen_ai.* OpenTelemetry spans when a
// call passes experimental_telemetry; PostHogSpanProcessor turns those into
// $ai_generation events. Node runtime only — the concierge/dream routes are
// runtime='nodejs' and the OTel Node SDK can't load on edge.
//
// Every model call in hop goes through the Vercel AI Gateway (metered, real
// spend), so the whole service is tagged billing='metered'. That property is
// what separates real out-of-pocket usage from the imputed-list-price usage the
// Claude Code / Codex tracker ships as billing='subscription'.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { resourceFromAttributes } = await import('@opentelemetry/resources')
  const { PostHogSpanProcessor } = await import('@posthog/ai/otel')

  // Write-only project token, safe in public apps (per PostHog). Override with a
  // POSTHOG_KEY / POSTHOG_HOST env var to point at a different project.
  const apiKey =
    process.env.POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_POSTHOG_KEY ??
    process.env.NEXT_PUBLIC_VERCEL_HOP_POSTHOG_PROJECT_TOKEN ??
    'phc_q39ZGuvXLQuwCgCkHZYAeaUlWm5bIhx2XKMCtTdhJ7o'

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'hop',
      app: 'hop',
      billing: 'metered',
      env: process.env.VERCEL_ENV ?? 'development',
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        projectToken: apiKey,
        host:
          process.env.POSTHOG_HOST ??
          process.env.NEXT_PUBLIC_VERCEL_HOP_POSTHOG_HOST ??
          'https://us.i.posthog.com',
      }),
    ],
  })
  sdk.start()
}
