---
title: Tailwind v4 auto-detection compiles class-shaped placeholders from agent docs and config comments, 500ing every dev page
date: 2026-07-03
tags: [tailwind-v4, source-detection, turbopack, css-parse-error, agent-docs, dev-500, at-source-not]
files: [app/globals.css, .claude/agents/copy-voice-reviewer.md, eslint.config.mjs]
status: solved
---

## Problem

Every page on localhost returned 500 with a Turbopack CSS parse error:
`Unexpected token Delim('|')` in generated utilities like
`.rounded-\[var\(--radius-sm\|--radius\|--radius-lg\|--radius-hero\)\]`.

## Root cause

Tailwind v4's automatic source detection scans **every non-gitignored text
file** — including `.claude/agents/*.md` reviewer docs and comments in
`eslint.config.mjs`. Two docs used a pipe-syntax "one of these" placeholder
(`rounded-[var(--radius-sm|--radius|…)]`) that is class-SHAPED, so the scanner
emitted it as a real arbitrary-value utility; `|` inside `var()` is invalid CSS
and the dev compiler hard-fails. The production webpack build tolerated it,
so prod looked fine while localhost was completely broken.

## Fix

1. Reworded the placeholders into individually valid spellings
   (`rounded-[var(--radius-sm)]` / `rounded-[var(--radius)]` / …).
2. Durably excluded non-runtime trees from scanning in `app/globals.css`:
   `@source not "../.claude"; @source not "../.cursor"; @source not
   "../.agents"; @source not "../docs"; @source not "../eslint.config.mjs";`
   Runtime templates live only in `app/`, `components/`, `lib/`.

## Rule of thumb

In an agent-native repo, docs are executable surface area for the CSS scanner.
Never write pipe/alternation syntax inside a bracketed utility in ANY text
file; when adding a new doc tree, add it to the `@source not` list.
