---
title: How "live artifacts" and AI-generated live-running sites work under the hood
date: 2026-07-22
status: complete
method: deep-research workflow — 6 search angles, 27 sources fetched, 25 claims adversarially verified (3-vote), 18 confirmed / 7 refuted / 0 unverified
---

# How "live artifacts" and AI-generated live-running sites work under the hood

## Summary

Three distinct architectures underlie "live AI-generated artifacts" today, and they optimize for
different things:

1. **Claude Artifacts** (claude.ai and Artifacts-in-Claude-Code) render generated HTML/React/
   Markdown as a strictly-sandboxed page built from full session context (codebase, connectors,
   conversation) and republished **in place at a stable URL with version history** — durability
   and shareability come from "publish = new version, same link," not from minting a fresh link
   each time.
2. **WebContainers** (StackBlitz) and tools built on them (bolt.new) instead run a **real, full
   Node.js dev environment client-side, inside the browser tab itself** — via WebAssembly-compiled
   Node.js, a virtual filesystem, and a virtualized TCP stack mapped onto the ServiceWorker API —
   so `npm install`, a live dev server, and terminal/fs/console access all happen with no remote
   VM. This gives the AI agent control of an entire environment, not just a code-generation
   target.
3. **v0** (Vercel) represents a third pattern, "**Generative UI**": it outputs real React/Tailwind/
   shadcn component code plus an in-platform iterative editing loop (select an iteration, keep
   refining, then export/copy into your own app) — prioritizing production-realistic, reusable
   code over either a sandboxed preview or a full in-browser OS.

Execution-security models diverge accordingly, and are worth naming precisely since they're easy
to conflate:

- **Claude Code's coding-agent sandbox** (distinct from the Artifacts *rendering* sandbox) uses
  OS-level primitives — Linux bubblewrap, macOS Seatbelt — covering not just the agent's direct
  actions but every spawned subprocess/script. Anthropic reports combined filesystem+network
  isolation cut permission prompts by **84%**, framing it as containing a compromised or
  prompt-injected agent's blast radius (it "can't steal your SSH keys, or phone home to an
  attacker's server").
- **Vercel Sandbox** isolates each execution in its own **Firecracker microVM** with dedicated
  filesystem and network — stronger isolation than a shared container or plain iframe sandbox —
  and is explicitly positioned for AI-agent and AI-generated-code workloads specifically, not
  generic CI.
- The generic **web-platform CSP/iframe `sandbox` directive** underlies most "render this
  generated code in an iframe" implementations: with no tokens applied it disables scripts,
  plugins, popups, forms, and modal dialogs, and forces the content into an opaque/null origin;
  specific capabilities (`allow-scripts`, `allow-forms`, `allow-same-origin`, `allow-popups`,
  `allow-modals`, `allow-pointer-lock`, `allow-downloads`, several `allow-top-navigation`
  variants) are re-enabled individually via tokens. This is stable, foundational, vendor-neutral
  web-platform behavior, not something specific to any one company.

**Open question, honestly flagged rather than guessed at**: no primary source in this research
pass confirmed *exactly* which sandbox mechanism Claude Artifacts' own rendering uses (CSP-iframe,
a dedicated origin, a Vercel-Sandbox-style microVM, or something else) — Claude's own docs
describe "iframe sandboxing combined with full-site process isolation" plus "strict Content
Security Policies," which is consistent with, but not confirmed identical to, the general
CSP-sandbox mechanism described above.

## Confirmed findings (high confidence, primary-sourced)

1. **Claude Artifacts are durable, shareable, iteratively-editable units, not one-off dumps.**
   They're built from the full session context (codebase, connected tools/connectors, conversation
   history), and every subsequent publish updates the *same* live URL in place with version
   history, rather than minting a new link.
   > "Claude Code builds an artifact using the full context of your session, including your
   > codebase, your connectors, and the conversation itself." / "When Claude Code updates an
   > artifact, the open page refreshes in place and teammates see the updates the moment they're
   > published. Every publish is a new version at the same link, with version history so you can
   > restore at any time."
   — [claude.com/blog/artifacts-in-claude-code](https://claude.com/blog/artifacts-in-claude-code),
   [code.claude.com/docs/en/artifacts](https://code.claude.com/docs/en/artifacts)

2. **WebContainers implement a full Node.js runtime, package managers, a virtual filesystem, and
   a virtualized TCP network stack — all mapped onto browser-native APIs — so execution and
   dependency installation happen entirely client-side.**
   > WebContainer "runs entirely inside the browser tab"; the TCP stack is "mapped to your
   > browser's ServiceWorker API"; "All code execution happens inside the browser's security
   > sandbox, not on remote VMs or local binaries."
   — [blog.stackblitz.com/posts/introducing-webcontainers](https://blog.stackblitz.com/posts/introducing-webcontainers/),
   [developer.stackblitz.com/platform/api/webcontainer-api](https://developer.stackblitz.com/platform/api/webcontainer-api),
   [webcontainers.io](https://webcontainers.io/)

3. **bolt.new is built directly on WebContainers and gives the AI model complete control of the
   entire dev environment** — filesystem, Node server, package manager, terminal, browser
   console — not just a code-generation target rendered into a preview pane.
   > "Bolt.new allows you to prompt, run, edit, and deploy full-stack applications directly from
   > your browser — no local setup required. Powered by StackBlitz's WebContainers." / "AI models
   > have complete control over the entire environment including the filesystem, node server,
   > package manager, terminal, and browser console."
   — [github.com/stackblitz/bolt.new](https://github.com/stackblitz/bolt.new)
   (Note: a claim that bolt.new's own README *explicitly contrasts* this against Claude/v0's
   capabilities did **not** survive verification — that differentiation is an ecosystem inference,
   not something StackBlitz itself states as a direct comparison.)

4. **v0's "Generative UI" outputs real, reusable component code on a specific stack (React,
   Tailwind CSS, shadcn/ui) — not a rendered image or static mockup — with an in-platform
   iterative editing loop.**
   > "We call it Generative UI — combining the best practices of frontend development with the
   > potential of generative AI." / "v0 produces code using open-source tools like React, Tailwind
   > CSS, and shadcn UI." The documented flow: "Select an iteration and keep editing in v0" before
   > "copy and paste that code into your app."
   — [vercel.com/blog/announcing-v0-generative-ui](https://vercel.com/blog/announcing-v0-generative-ui)
   (More specific claims about v0's streaming mechanism — e.g. AI SDK 3.0's `render`/`streamUI`
   piping React Server Components token-by-token as *the* core mechanism — were investigated and
   did **not** survive verification; treat v0's exact real-time rendering internals as unconfirmed.)

5. **Claude Code's coding-agent sandbox uses OS-level primitives (bubblewrap/Seatbelt) covering
   all spawned subprocesses, cutting permission prompts 84%.**
   > "Linux bubblewrap for sandboxing ... seatbelt for enforcement," covering "not just Claude
   > Code's direct interactions, but also any scripts, programs, or subprocesses that are spawned
   > by the command." "Sandboxing safely reduces permission prompts by 84%." "A compromised Claude
   > Code can't steal your SSH keys, or phone home to an attacker's server" — when filesystem and
   > network isolation are combined.
   — [anthropic.com/engineering/claude-code-sandboxing](https://anthropic.com/engineering/claude-code-sandboxing)

6. **Vercel Sandbox runs each execution in its own isolated Firecracker microVM**, positioned
   explicitly for AI-agent and AI-generated-code workloads.
   > "Each sandbox runs in a secure Firecracker microVM with its own filesystem and network. Run
   > untrusted code without affecting production." / "Vercel Sandbox is a compute primitive
   > designed to safely run untrusted or user-generated code on Vercel. It supports dynamic,
   > real-time workloads for AI agents, code generation, and developer experimentation."
   — [vercel.com/docs/sandbox](https://vercel.com/docs/sandbox)

7. **The web-platform CSP/iframe `sandbox` directive is the generic, vendor-neutral mechanism**
   most "live preview in an iframe" renderers build on — disabling scripts/forms/popups/modals
   and forcing an opaque origin by default, with individual tokens re-enabling specific
   capabilities.
   — [MDN: Content-Security-Policy sandbox directive](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox)
   (backed by the WHATWG HTML spec's sandboxing flags)

## Refuted / did not survive verification (excluded from findings above, listed for transparency)

- WebContainers claimed to run "the actual Node.js runtime natively" via WebAssembly, phrased as
  a categorical fact independent of any specific source — killed 0-3; the *general* claim about
  WebAssembly-based execution is still supported (see finding 2), but this specific over-general
  phrasing did not hold up to scrutiny of its cited source.
- A claim that StackBlitz's own docs page specifies the *exact* isolation mechanism (iframe origin
  isolation vs. Web Worker vs. WASM syscall emulation) — killed 0-3; the mechanism is not
  specified on that page.
- The claim that bolt.new's README *explicitly contrasts itself* against Claude and v0's
  capabilities — killed 1-2.
- Several specific claims about Vercel AI SDK 3.0's `render`/`streamUI` functions streaming React
  Server Components as *the* mechanism behind v0's generative UI — killed (0-2, 1-2, 0-3 across
  different sub-claims). The existence of an RSC-streaming SDK feature is real, but its status as
  "the" mechanism behind v0's current live-preview generation is unconfirmed.

## Gaps and open questions (from the research itself, not filled in)

- What is the actual rendering/execution sandbox for Claude.ai web Artifacts and
  Artifacts-in-Claude-Code specifically? No primary source confirming the exact technical detail
  (CSP-sandboxed iframe vs. dedicated origin vs. microVM vs. something else) survived
  verification.
- How does Replit Agent's live-preview/execution architecture compare? No claims about Replit
  specifically appeared in the verified set, despite being named in the original question.
- Given the refuted RSC-streaming claims, what *is* v0's actual current streaming mechanism for
  progressive UI rendering?
- How do the three architectural families (rendered-artifact-in-sandbox vs. full-browser-OS-via-
  WebAssembly vs. exported-component-code) compare on cost, latency, and offline/portability —
  none of the verified claims addressed this directly.

## Method note

Deep-research workflow: question decomposed into 6 search angles (primary/official, practitioner/
implementation, industry/competitive landscape, security model, contrarian/technical-depth,
conceptual/differentiation) → 6 parallel web searches → 27 sources fetched, deduplicated → 112
claims extracted → top 25 claims put through 3-vote adversarial verification (majority-refute
kills a claim) → 18 confirmed, 7 refuted, 0 left unverified. Full per-claim evidence trail and
agent-level logs are available in this session's workflow transcript if deeper audit is ever
needed.
