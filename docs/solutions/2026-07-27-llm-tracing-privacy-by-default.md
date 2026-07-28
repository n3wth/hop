---
title: "LLM tracing must opt in twice and explicitly exclude model content"
date: 2026-07-27
tags: [privacy, telemetry, llm, opentelemetry, posthog, ai-sdk, feature-flags]
files: [instrumentation.ts, instrumentation.node.ts, lib/llm-tracing.ts, lib/env.ts, lib/conversation-memory.ts, lib/concierge-feedback.ts]
status: solved
---

**Summary:** LLM observability is useful for model name, token usage, latency, and function-level
costs, but the same telemetry path can copy private conversation content into a third-party
system. The AI SDK's `recordInputs` and `recordOutputs` options default to enabled. Omitting those
fields is therefore a privacy decision, not a neutral default.

The safe pattern has two independent controls:

1. **Configuration double lock.** Tracing starts only when `HOP_ENABLE_LLM_TRACING` is explicitly
   true *and* a PostHog project key is configured. A key already present for browser analytics
   cannot silently turn LLM tracing on. There is no committed fallback key.
2. **Per-call integration, never global registration.** AI SDK 7 moved OpenTelemetry span creation
   into `@ai-sdk/otel`; starting a provider/exporter alone does not instrument AI calls. The
   version-compatible `OpenTelemetry` integration is attached in `llmTelemetry()` through each
   approved call's non-deprecated `telemetry.integrations` field. Do not call `registerTelemetry()`:
   global AI SDK 7 integrations enable telemetry by default for every current and future call.
3. **Content exclusion at every approved call.** `lib/llm-tracing.ts#llmTelemetry` always returns
   `recordInputs: false` and `recordOutputs: false`. This excludes prompts, messages, system
   instructions, tool definitions/arguments/results, and completions while retaining operational
   metadata such as model, latency, and token usage.
4. **Explicit opt-out for private secondary calls.** Conversation-memory summarization handles an
   accumulated transcript plus its generated durable summary. Its `generateText()` call explicitly
   sets `telemetry: { isEnabled: false }` as defense in depth, even though hop does not register a
   global integration.

Next.js instrumentation stays thin and runtime-safe: the root `instrumentation.ts` checks for the
Node runtime before loading `instrumentation.node.ts`. The Node initializer resolves env lazily,
returns immediately when disabled or unconfigured, and swallows optional exporter startup
failures so observability can never prevent the app from serving requests.

The concierge's manual `concierge.turn` span is only created when tracing config is enabled. The
AI call runs with that validated span as the active OTel parent, so the per-call GenAI spans inherit
its trace id. `x-hop-trace-id` is emitted only when the parent span is recording and its OTel span
context is valid (including a non-zero trace id). A disabled, unconfigured, failed, or unsampled
provider therefore exposes no synthetic trace link.

Trace feedback follows the same privacy boundary. The UI records only a bounded `up`/`down` rating
and a validated trace id. It does not solicit or export free text: heuristic redaction cannot make
arbitrary user content reliably PII-free, so the property is removed by construction.

**Review rule:** whenever adding or upgrading AI SDK telemetry, inspect the installed SDK's
telemetry option defaults and integration model. Tests should assert the shared helper's full
privacy settings, per-call integration, explicit private-call opt-outs, valid parent trace linkage,
and flag-plus-key startup gate. Do not rely on the exporter or deployment configuration to redact
prompts, messages, tool arguments/results, system instructions, generated output, or memory.
