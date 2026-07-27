---
title: "LLM tracing must opt in twice and explicitly exclude model content"
date: 2026-07-27
tags: [privacy, telemetry, llm, opentelemetry, posthog, ai-sdk, feature-flags]
files: [instrumentation.ts, instrumentation.node.ts, lib/llm-tracing.ts, lib/env.ts]
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
2. **Content exclusion at every model call.** `lib/llm-tracing.ts#llmTelemetry` always returns
   `recordInputs: false` and `recordOutputs: false`. The helper is shared so a new call site cannot
   accidentally inherit the SDK's content-recording defaults by copying a partial object.

Next.js instrumentation stays thin and runtime-safe: the root `instrumentation.ts` checks for the
Node runtime before loading `instrumentation.node.ts`. The Node initializer resolves env lazily,
returns immediately when disabled or unconfigured, and swallows optional exporter startup
failures so observability can never prevent the app from serving requests.

**Review rule:** whenever adding or upgrading AI SDK telemetry, inspect the installed SDK's
telemetry option defaults. Tests should assert the shared helper's full privacy settings and the
flag-plus-key startup gate; do not rely on the exporter or deployment configuration to redact
prompts, messages, tool arguments/results, system instructions, or generated output.
