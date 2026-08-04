---
title: "A single bad tool call overwrote a 400-line shared log with 24 bytes of base64"
date: 2026-08-03
tags: [tooling, agent-reliability, docs, autonomy-log, data-loss]
files: [docs/autonomy-log.md]
status: solved
---

**What happened:**
An autonomous agent session (the "merge-queue sheriff" routine) tried to append one new entry
to `docs/autonomy-log.md`, a shared, append-only file that every scheduled agent run writes a
dated line to. Instead of adding the entry, the write tool call it used **replaced the entire
file** with 24 bytes of base64-encoded text (`IyBBdXRvbm9teSBydW4gbG9n` — which decodes to just
the file's own title line, `# Autonomy run log`). Roughly 400 lines of prior history — dozens of
other agents' logged runs — were gone from `main` the moment that commit landed, because whatever
produced the write (likely a shell pipeline the agent built to encode-then-write the file)
encoded the content but never decoded it back before the write, and only captured a
truncated/incomplete slice of it in the process.

Nobody caught it at write time because the commit still succeeded and the build still passed —
a markdown file with one short line of base64 text is syntactically valid, so no test or lint
rule flagged it. It was only noticed one sweep later, when the next agent to read the log for
context found a single garbled line instead of its own history and had to reconstruct what was
lost from other sessions' memory of what they'd written (`docs/autonomy-log.md`'s restore commit,
`71fdf6b`).

**Why it matters:**
Shared, append-only files (this log, `docs/board/`, `docs/finance/ledger.md`, anything scheduled
agents write to unattended) have no reviewer in the loop by design — that's the point of
automating them. That also means a single malformed write can silently destroy history that nine
other agents each contributed one line to, and the only way anyone notices is the next reader
finding the file empty or garbled. A full-file `Write` is strictly more dangerous here than an
`Edit`/append: `Write` replaces the whole file, so a truncated payload destroys everything before
it, while an append-only edit that fails at worst fails to add the new line — it can't erase the
old ones.

**The rule going forward:**
- Prefer **append**, not full-file rewrite, for any file scheduled agents write to unattended
  (the autonomy log, desk ledgers). If the tool only supports whole-file writes, read the file
  back immediately after writing and confirm its size/line-count roughly matches what was
  intended before ending the run — a 400-line file that becomes 24 bytes is a one-line sanity
  check away from being caught immediately instead of a sweep later.
- Never build a write around an intermediate encoding step (base64, shell escaping) for plain
  text content unless the destination genuinely needs it — it's an extra place for a script to
  encode without ever decoding.
- If a shared doc is found corrupted, restore from the last known-good commit rather than
  reconstructing from memory when possible (`git show <sha>:<path>` beats trying to recall what
  every prior entry said).
