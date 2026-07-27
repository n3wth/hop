# LLM tracing privacy remediation

## Goal

Keep useful LLM operational spans while making tracing explicitly opt-in and preventing the AI
SDK from recording prompts, messages, tool payloads, or generated content.

## Plan

1. Add one lazy, double-locked tracing configuration seam: `HOP_ENABLE_LLM_TRACING` plus a
   configured PostHog project key. Preserve the existing supported PostHog env aliases, but remove
   the committed token fallback.
2. Keep root `instrumentation.ts` runtime-only and move Node OpenTelemetry startup into a guarded
   Node module that returns without throwing when disabled, unconfigured, or initialization fails.
3. Install the AI SDK 7-compatible `@ai-sdk/otel` package and attach its `OpenTelemetry`
   integration through the approved call's `telemetry` object only. Never call
   `registerTelemetry`: AI SDK 7's global registry would make unrelated and future calls traced by
   default.
4. Route the concierge and dream calls through `llmTelemetry()`, which always sets
   `recordInputs: false` and `recordOutputs: false`. Explicitly opt conversation-memory summaries
   out with `telemetry: { isEnabled: false }`; accumulated transcripts and summaries are outside
   the approved tracing surface.
5. Create concierge trace-link headers only from a valid, recording parent span. Run `streamText`
   with that span in active OTel context so the per-call AI spans inherit the same trace id. Emit no
   header when tracing is disabled, unconfigured, startup failed, unsampled, or otherwise invalid.
6. Keep trace feedback non-content: thumbs up/down plus a validated trace id only. Do not collect or
   export arbitrary user-entered reasons to PostHog.
7. Test the config double lock, env restoration, alias compatibility, startup no-op behavior,
   per-call integration, content exclusion, trace-parent linkage, memory opt-out, and bounded
   feedback; document the privacy-by-default pattern in `docs/solutions/` and `.env.example`.

## Verification

- Focused Vitest coverage for LLM tracing, conversation memory, and trace feedback.
- `npm run check`
- `npm run build`
- Diff audit for secrets, conflict markers, and unrelated files.
