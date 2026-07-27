import { OpenTelemetry } from '@ai-sdk/otel'
import {
  context as otelContext,
  isSpanContextValid,
  trace,
  type Context,
  type Span,
  type SpanContext,
  type Tracer,
} from '@opentelemetry/api'
import type { TelemetryOptions } from 'ai'

import { env, hasEnv, isLlmTracingEnabled } from '@/lib/env'

const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com'

export type LlmTracingConfig = {
  projectToken: string
  host: string
}

let openTelemetry: OpenTelemetry | undefined

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

function llmOpenTelemetry(): OpenTelemetry {
  // Construct after Node instrumentation has started so this integration uses
  // the already-registered global provider. It is attached per call below and
  // is deliberately never registered through AI SDK's global registry.
  return (openTelemetry ??= new OpenTelemetry({ tracer: trace.getTracer('hop.ai') }))
}

/**
* AI SDK telemetry settings shared by every approved traced LLM call.
*
* The SDK records inputs and outputs by default, so both privacy controls stay
* explicit here. Operational metadata such as function, model, token usage,
* and latency remains available when tracing is enabled. The integration is
* per call: hop never uses AI SDK's global telemetry registry.
*/
export function llmTelemetry(functionId: string): TelemetryOptions {
  const isEnabled = resolveLlmTracingConfig() !== null
  return {
    isEnabled,
    functionId,
    recordInputs: false,
    recordOutputs: false,
    ...(isEnabled ? { integrations: [llmOpenTelemetry()] } : {}),
  }
}

export type LlmTraceAnchor = {
  span: Span
  traceId: string
}

type RunWithContext = <T>(context: Context, run: () => T) => T

/** Run an approved AI call with its validated anchor as the active parent. */
export function withLlmTraceAnchor<T>(
  anchor: LlmTraceAnchor | null,
  run: () => T,
  runWithContext: RunWithContext = (context, callback) =>
    otelContext.with(context, callback),
): T {
  if (!anchor) return run()
  return runWithContext(trace.setSpan(otelContext.active(), anchor.span), run)
}

/** Start a content-free parent span only when the provider is truly active. */
export function startLlmTraceAnchor(
  name: string,
  tracer: Tracer = trace.getTracer('hop.llm'),
): LlmTraceAnchor | null {
  if (!resolveLlmTracingConfig()) return null

  const span = tracer.startSpan(name)
  const traceId = traceIdForHeader(span)
  if (!traceId) {
    span.end()
    return null
  }
  return { span, traceId }
}

/** Only recording, valid, non-zero OTel trace ids may leave the server. */
export function traceIdForHeader(span: Pick<Span, 'isRecording' | 'spanContext'>): string | null {
  const spanContext: SpanContext = span.spanContext()
  return span.isRecording() && isSpanContextValid(spanContext) ? spanContext.traceId : null
}
