# /ask: web-search citations + grouped tool-step display

**Context**: A review of `/ask`'s AI stack (custom `useChat` + `ConciergeTransport` +
hand-themed `ai-elements/*` + Streamdown) found the component surface already covers
most of what the AI Elements registry offers (message, response, tool, prompt-input,
conversation, loader, suggestion, plus a custom `AssistantActions` copy/retry row and
the `a2ui` generative-block system). Two concrete gaps survived that audit. Both are
additive, protocol-compatible, and don't touch the verdict engine.

## 1. Source citations for `web_search`

**What**: `web_search` (`lib/concierge-tools.ts:296`, `gateway.tools.parallelSearch({})`)
is a provider-executed AI Gateway tool. Its result — `ParallelSearchResponse` —
already contains `{ searchId, results: [{ url, title, excerpt, publishDate?,
relevanceScore? }] }` (see `node_modules/@ai-sdk/gateway/dist/index.d.ts:420-437`).
Today the server only forwards a human `detail` string (the search objective) to the
client; the actual URLs the model read are discarded after the tool call resolves.

**Why**: hop's whole trust model is "never invent a fact, cite the engine" — that
discipline currently stops at cpp/miles/verdict numbers and doesn't extend to the
live-web claims (`web_search` backs "why fares move", seasonality, events —
`app/api/concierge/route.ts:372`). Surfacing the actual sources the model read is a
direct, cheap extension of an invariant hop already believes in, and it's standard AI
SDK v7 vocabulary (`SourceUrlUIPart`, `type: 'source-url'` — `node_modules/ai/dist/index.d.ts:1877`),
so `ai-elements`'s `Sources`/`Source` primitives apply with no protocol invention.

**Design**: extend the existing RS-framed tool-activity channel rather than add a new
one.

- `app/api/concierge/route.ts`: `ToolActivityFrame` gains an optional
  `sources?: { url: string; title: string }[]`. In the `tool-result` branch, when
  `part.toolName === 'web_search'` and `part.output` has a `results` array (i.e. not
  the `ParallelSearchError` shape), map the top ~5 results into `sources` before
  calling `emitFrame`. Everything else about the frame (id-keyed, replaces the
  running card) is unchanged. Confirmed the field name: the `tool-result` stream
  part is `{ type: 'tool-result', toolCallId, toolName, input, output,
  providerExecuted? }` in AI SDK v7 (`node_modules/ai/dist/index.d.ts:1239-1250`) —
  `part.output` is right, and `providerExecuted` is available if we want to gate on
  it explicitly rather than just toolName.
- `lib/concierge-transport.ts`: in `pump()`, when a `frame` event carries `sources`,
  enqueue one native `{ type: 'source-url', sourceId, url, title }` chunk per source
  (in addition to the existing `data-tool` chunk) — `sourceId` = `` `${frame.id}-${i}` ``.
  This rides the stock AI SDK `UIMessageChunk` union, so no `HopDataParts` change is
  needed for this part.
- `components/Concierge.tsx` (`Turn()`): add a branch for `part.type === 'source-url'`
  alongside the existing `text` / `data-tool` / `data-a2ui` branches. Sources
  associate with the *preceding* tool frame in stream order (they arrive
  immediately after it), so render them inside that tool's existing
  `ToolContent` disclosure (`components/ai-elements/tool.tsx`) — a short "Sources"
  link list under the query detail — rather than as a separate top-level section.
  This keeps the "tools render where they fired" invariant intact
  (`components/Concierge.tsx:486` comment block).
- `components/ai-elements/tool.tsx`: add a small `ToolSources` list (favicon-less
  text link chips: title + hostname, flat, no card/shadow) matching hop's existing
  `ToolContent` typography (`text-[12px] text-text3`).

**Out of scope**: `InlineCitation` (hover-card citations inline in the prose,
footnote-style) — the model doesn't currently emit inline citation markers, and
teaching it to would touch the system prompt / a2ui contract. Start with the
tool-level source list; revisit inline citations only if the list style proves
insufficient.

**Risk**: low. Purely additive fields/parts; a client on an old cached bundle simply
ignores the unknown `sources` frame field, and the new `source-url` chunk type is
already understood by `useChat` (AI SDK v7 ships it natively) even before the render
branch is added — worst case it's silently dropped. Gate nothing behind a flag; this
is display-only and fails closed (no sources → no list, same as today).

**Persistence note**: sources are live-turn-only. `toThread()`
(`lib/concierge-transport.ts:45`) and the server's `onFinish`
(`app/api/concierge/route.ts:728`) persist plain `{role, content}` text — same as
today's tool-activity cards — so a reloaded/resumed thread won't show sources on
past turns. That's consistent with existing behavior (tool cards already don't
survive a reload either), not a new gap, but worth stating so it doesn't get filed
as a bug later.

**Files**: `app/api/concierge/route.ts`, `lib/concierge-transport.ts`,
`components/Concierge.tsx`, `components/ai-elements/tool.tsx`, plus their existing
tests (`lib/concierge-transport.test.ts`, `lib/__tests__/concierge.test.ts`,
`lib/__tests__/mcp-tools.test.ts`).

---

## 2. Grouped tool-step display for multi-tool turns

**What**: `buildConciergeTools` (`lib/concierge-tools.ts:288-330`) gives the
concierge 5 tools — `web_search`, `get_weather`, `price_trip`, `search_flights`,
`save_profile_fact` — with `stopWhen: stepCountIs(5)`
(`app/api/concierge/route.ts:720`). (`verdict`, `sweet_spots`, `transfer_paths`,
`compare_programs`, `best_card_for_program` are a *different* surface — the MCP
server's tool schemas in `lib/mcp-tools.ts`, exposed via `app/api/[transport]/route.ts`
for external MCP clients, not `/ask`.) A single concierge turn can still legitimately
fire several calls back-to-back with no prose between them — e.g. "compare Lisbon
and Cusco" → `price_trip(LIS)` + `price_trip(CUZ)`, or a specific-date question →
`search_flights` + `web_search` + `get_weather`. Today each one renders as its own
full-width `ToolActivity` row (`components/Concierge.tsx:576`), so a multi-tool turn
reads as a stack of unrelated pills rather than a legible "here's what hop checked."

**Why**: this is pure legibility polish for the multi-tool case specifically — it
does not apply (and shouldn't change anything) for the common single-tool turn.

**Constraint to respect**: the current interleaving is deliberate — tools render
*where they fired* relative to the prose, specifically so a tool never appears
hoisted above the text it informed (`components/Concierge.tsx:486-491` comment). A
global "Plan" block pulled out of stream order (the literal AI Elements `Task`
pattern) would violate that invariant and is **not** the right shape here. The fix
is local grouping, not restructuring.

**Design**: in `Turn()`'s existing partition step (`components/Concierge.tsx:544-561`,
where `message.parts` is walked into the `inline` array), collapse **consecutive**
`{ kind: 'tool' }` entries (no `text` entry between them) into one
`{ kind: 'tool-group'; steps: ToolActivityStep[] }` entry instead of emitting them as
separate `InlinePart`s. Render a `ToolActivityGroup` (new export in
`components/ai-elements/tool.tsx`) that:
- Renders a single-line summary row when idle/collapsed ("Checked 3 things" +
  overall state — running if any step is running, error if any errored).
- Expands (reuses the existing `<details>`/`ToolHeader` disclosure mechanics) to the
  same per-step rows `ToolActivity` renders today, now with a "Step N of M" prefix
  instead of a bare icon+title.
- A lone tool call (the overwhelmingly common case) renders exactly as it does
  today — `ToolActivityGroup` with one step is just `ToolActivity`, so no visual
  change for single-tool turns.

No server/protocol change — this is purely a client-side grouping of the existing
`data-tool` id-keyed frames already being emitted; `ToolActivityFrame` and
`ConciergeTransport` are untouched.

**Files**: `components/Concierge.tsx` (the `inline` partition + render loop),
`components/ai-elements/tool.tsx` (new `ToolActivityGroup`).

---

## Sequencing

These are independent — either can ship alone. Recommended order: (1) source
citations first (server + transport touch, needs the most careful testing of the
`tool-result` branch and the `ParallelSearchError` type guard), then (2) the grouping
polish (client-only, easy to iterate on visually). Both should go through
`/review-parallel` given they touch `lib/concierge-transport.ts` and
`app/api/concierge/route.ts` (degradation-reviewer, copy-voice-reviewer for the new
UI strings).

## Explicitly not doing

- No `InlineCitation` footnote markers in prose (see above).
- No global `Task`/plan block that reorders tool calls out of stream position.
- No changes to `lib/mcp-tools.ts` tool schemas or the agentic loop itself — this is
  presentation of data that already exists in the stream, not new capability.
