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
3. Route every AI SDK call through a typed helper that always sets `recordInputs: false` and
   `recordOutputs: false`, while retaining function identifiers and non-content SDK metadata.
4. Test the config double lock, alias compatibility, startup no-op behavior, and telemetry privacy
   settings; document the privacy-by-default pattern in `docs/solutions/` and `.env.example`.

## Verification

- Focused Vitest coverage for LLM tracing.
- `npm run check`
- `npm run build`
- Diff audit for secrets, conflict markers, and unrelated files.
