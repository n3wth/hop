# 0013. The mobile client is a thin engine consumer, never its own engine

Status: Accepted
Date: 2026-07-27

## Context

hop is a web app (Next.js 16 + React 19, App Router, RSC). We want a mobile app, and there are
several viable targets — Expo/React Native (cross-platform), native SwiftUI (iOS), native
Kotlin/Compose (Android). The choice matters, but a subtler risk sits underneath it.

hop's moat is ADR 0002: **every economic number — cpp, miles, price, `$` saved, tier, ranking,
verdict — is computed by `lib/*` deterministic code (`lib/cpp.ts`, `lib/search.ts#assembleSearch`)
and never generated, estimated, or re-derived elsewhere.** A hallucinated or drifted "45k miles at
4.1cpp" reads identical to a real one, and a user books on it.

A second client multiplies the surfaces that display those numbers, and — depending on target —
tempts a second implementation of the economics:

- **Expo/React Native** can *import the pure-TS engine directly* (`lib/cpp.ts`, `lib/prefs-model.ts`,
  `lib/transfers.ts`, `lib/valuations.ts` have no DOM/server dependency), and reach everything else
  through the existing API. It also covers iOS and Android from one codebase and reuses our React
  and design-token knowledge.
- **Native Swift / Kotlin** cannot import `lib/*` at all. That leaves two paths: reimplement the
  cpp/tier/ranking math in a second language (which *directly violates ADR 0002* and creates a
  drift surface that must never diverge), or call the engine over the network for every number.

The existing API is already the right seam: the MCP server (`app/api/[transport]/route.ts`,
streamable-HTTP `/api/mcp`; tools `price_trip`, `verdict`, `sweet_spots`, `transfer_paths`,
`compare_programs`, `best_card_for_program`) calls the same `lib/*` engine, and auth is an optional
`hop_` Bearer token (`lib/api-tokens.ts`) that scopes to the owner's real balances (absent → a
stateless mode with caller-supplied balances).

## Decision

**Any mobile client is a thin consumer of hop's engine. It displays engine-produced numbers and
computes none of its own — no cpp formula, no tier thresholds, no ranking, no `$`-saved arithmetic
in client code. This holds regardless of target language.** This extends ADR 0002 across the
process boundary.

Numbers reach the client in exactly two sanctioned ways, in this order of preference:

1. **Import the pure-TS engine directly** where it has no DOM/server dependency (available only to
   an Expo/React Native client — reuse `lib/*`, never fork it).
2. **Call the existing API** (`/api/mcp` tools, authed with a `hop_` token). Available to any
   client; the *only* number source for a native Swift/Kotlin client.

We adopt **Expo/React Native as the default target**, because it is the only option that can reuse
`lib/*` directly, covers iOS + Android from one codebase, and inherits every engine improvement for
free. A native client (Swift/Kotlin) is a legitimate later choice **only as a strict API-only
consumer** — never by porting the economics.

Additional structural rules for any client:

- **Graceful degradation crosses the boundary too** (house style / ADR 0002): a failed engine call
  degrades that section (mirror `DegradedNote`) and never throws to a screen; model responses as an
  explicit success/failure result matching the engine's `{ok}` discriminated shape.
- **The client repo/dir is excluded from the Next.js build graph**, the same way `eve/` is
  (`eve/README.md`) — it must not enter the app's typecheck/lint/build.
- **Secrets live in platform-secure storage** (Keychain / Keystore), never plaintext; a user's data
  is reachable only via that user's own `hop_` token.
- **The design bar and copy voice are non-negotiable** (`docs/design/*`): flat editorial (no
  shadows/gradients/glows), WCAG AA, the type stack, restrained transform-only motion, terse
  number-first copy.

## Consequences

- **The economics live in exactly one place, forever.** No second cpp/tier/ranking implementation
  in Swift or Kotlin is ever sanctioned; if one appears, it is a P1 regression against ADR 0002.
  The API contract becomes the hard dependency for any non-JS client — the price of that language
  choice, accepted explicitly here.
- **Target choice is now a leverage decision, not a correctness one.** Because the client never owns
  numbers, Expo vs. Swift is decided on reach, feel, and reuse — not on whether the math will be
  right. Expo maximizes reuse; Swift maximizes iOS feel at the cost of zero `lib/*` reuse and
  Android needing its own app.
- **Any new client surface inherits the guarantee for free** as long as it routes numbers through an
  imported engine function or an engine-wrapping API call — the same property ADR 0002 gives Eve and
  the concierge.
- **Enforcement:** the `engine-invariant-reviewer` already guards "no LLM/derived numbers"; its
  scope extends to client code — arithmetic on economic values in a mobile client, or a re-declared
  threshold/formula, is a P1. A green review does not exempt a client from this ADR.
- **Follow-ups:** stand up the Expo scaffold in a build-excluded dir; document the exact
  request/response shapes of the `/api/mcp` tools so a client models its types on real engine output
  rather than guessing; decide later, on its own merits, whether a native Swift client is worth the
  API-only constraint.
