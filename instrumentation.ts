// Keep the framework entrypoint runtime-neutral. The OTel Node SDK and PostHog
// exporter only load in the Node runtime, and only after the explicit tracing
// flag + project-key double lock passes in instrumentation.node.ts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  try {
    const { registerLlmTracing } = await import('./instrumentation.node')
    await registerLlmTracing()
  } catch {
    // Optional observability must never prevent the server from starting.
  }
}
