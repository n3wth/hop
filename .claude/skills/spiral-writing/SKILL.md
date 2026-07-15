---
name: spiral-writing
description: Draft or polish prose with Spiral (writewithspiral.com) — long-form generation, personalization to a voice, and humanizing AI-sounding text. Use for growth/SEO articles, newsletter and digest copy, board or CFO memo prose, and any writing task where the first draft sounds like a model wrote it. Not for UI copy (that's docs/design/copy-spec.md territory) or for anything numeric (numbers come from the engine, never from a writing tool).
---

# Spiral — writing tool for hop's prose surfaces

[Spiral](https://writewithspiral.com) is a writing assistant exposed as a remote MCP server.
It does three things hop's writing desks (growth content, newsletter digests, memos) actually
need: generate long-form drafts, personalize text to a specific voice, and rewrite
AI-sounding prose so it reads like a person wrote it.

## Connect

The server is remote (Streamable HTTP) with OAuth browser sign-in — no API key to manage:

```bash
claude mcp add --transport http --scope user spiral https://api.writewithspiral.com/mcp/
```

First call triggers a browser sign-in. Agent-facing docs live at
[writewithspiral.com/agents.md](https://writewithspiral.com/agents.md) (also `/auth.md`,
`/pricing.md`, `/llms.txt`) — fetch those if the tool surface has changed since this skill
was written.

## Tools

| Tool | Use for |
|---|---|
| `spiral_generate_writing` | First drafts of long-form pieces: SEO articles, guides, digest issues. |
| `spiral_personalize_text` | Re-voicing a draft to match an established voice/sample. |
| `spiral_humanize_text` | De-botifying a finished draft — the pass before anything ships publicly. |

## House rules when using Spiral in this repo

1. **Numbers stay engine-computed.** Never let Spiral produce, alter, or "round" a cpp value,
   valuation, price, or ranking. Write prose with placeholders, then splice in
   engine-sourced numbers verbatim (same rule the `/ask` concierge lives by).
2. **UI copy is out of scope.** Buttons, labels, empty states, and verdict strings follow
   `docs/design/copy-spec.md` and go through the copy-voice reviewer — don't route them
   through Spiral.
3. **Voice check still applies.** Spiral output destined for hop surfaces still gets read
   against `docs/design/copy-spec.md` tone (plain, confident, no hype) before it ships.
4. **Fact-check generated claims.** Spiral drafts prose, not truth — verify any factual claim
   (transfer partners, program rules, fees) against `lib/` data or a primary source before
   publishing, exactly as the growth desk's existing SEO rules require.

## Typical flow (growth desk example)

1. Outline the piece yourself (angle, keyword, structure — that's editorial judgment).
2. `spiral_generate_writing` for the draft body.
3. Splice in engine-computed numbers and verified program facts.
4. `spiral_humanize_text` on the final prose.
5. Normal review path: copy voice + fact check, then ship per the desk's usual rules.
