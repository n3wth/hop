# The hop agent playbook — how to work here so it compounds

> For every model that works on hop, especially smaller ones. This encodes the operating
> principles behind the 2026-07 elevation run (native /ask, the icon system, the memory spine,
> monetization Phase 1) so the same quality is reproducible without the same horsepower.
> Follow it mechanically; the judgment is already baked in.

## 1. The loop — never skip a lane

**Plan → Work → Review → Compound.** In practice:

1. **Read before you reason.** Open the actual files you'll change, the relevant
   `docs/plans/*` blueprint, `CLAUDE.md`, and — for anything framework-level — the guide in
   `node_modules/next/dist/docs/`. Never work from memory of "how Next works"; this repo is
   Next 16 + React 19 and your training data is wrong somewhere.
2. **Work in the smallest shippable slice.** One cohesive PR per concern. If your diff wants
   to do two things, it's two PRs. XS/S/M only — split anything larger.
3. **Verify with all four, every time:** `npx tsc --noEmit` · `npm run lint` · `npm test` ·
   `npm run build`. Green on all four is the *floor*, not the finish.
4. **Review before merge.** Run the specialist reviewers over the diff (`/review-parallel`, or
   the review workflow if available). Fix confirmed P1/P2s; log P3s. Never merge on
   "looks right to me."
5. **Compound.** If you learned something durable — a rule, a fix pattern, a gotcha — it goes
   into `docs/solutions/`, `DESIGN-SYSTEM.md`, or `CLAUDE.md` in the *same* PR. Work that
   doesn't teach the system is half-done.

## 2. The invariants — violating any of these is an automatic P1

- **Numbers are computed, never generated.** cpp / miles / prices / verdicts / $ saved come
  from `lib/*` deterministic code. An LLM may narrate a number the engine produced; it may
  never produce one. No number is stored where it can go stale (calendars, summaries, memory).
- **Degrade, never throw.** `lib/*` clients and DB helpers return `{ok:false}` / `[]` / `''`
  via `withDb`; surfaces degrade per-section (`DegradedNote`). A dead upstream dims a card —
  it never crashes a page.
- **Flag-gated seams.** Unfinished or costly capability ships **dark** behind `HOP_ENABLE_*`
  (checked lazily via `lib/env.ts` — never `process.env` directly) and no-ops byte-for-byte
  when off. Migrations are authored `IF NOT EXISTS`, typed in `utils/supabase/admin.ts` AND
  `lib/db/schema.ts`, and never executed by app code.
- **Your data, your token.** Every DB query filters by the Auth0 `sub` in code. Service-role
  bypasses RLS, so the `user_id` scoping in code IS the security boundary. Confirm/dismiss/
  delete re-scope to the caller's own row.
- **Money is human-gated.** Nothing books, charges, or spends without an explicit user
  action; payments never touch the live Duffel key.

## 3. Design — the canon decides, not your taste

The design system is *law you look up*, not vibes you generate:

- **Tokens only.** Radii `--radius-sm/10 · --radius/14 · --radius-lg/20 · --radius-hero/28`;
  colors from `@theme` in `app/globals.css`; containers `--container-sm` (prose) and
  `--container-shell` (app surfaces); tracking `--track-eyebrow/label/tag`. A hardcoded hex or
  off-scale radius in your diff is a defect.
- **Flat is the law:** no shadows, no gradients (photo-legibility scrims excepted), no glows.
  Depth = paper grain + type + color + composition. Hover = color only (plus the two
  sanctioned micro-moves: image zoom-in-frame, arrow nudge). Everything transform-only and
  gated behind `prefers-reduced-motion`.
- **Icons:** sizes 12/16/20/24 only (the type enforces it), `regular` weight unless it's a
  status mark or brand tile, and one concept = one glyph (the table in DESIGN-SYSTEM.md).
  When you need an icon, look it up; when it's not in the table, ask whether you need an
  icon at all (usually: no).
- **Copy:** terse, confident, state the answer and the number (`docs/design/copy-spec.md`).
  No marketing slop, no emoji spam. The bunny is a logo plus at most one warm moment per
  region — never a narrator.
- **WCAG AA always:** contrast, focus-visible, labels on icon-only controls, `aria-live` for
  streamed content, focus trap + restore in overlays. And never combine `items-center` with
  `overflow-y-auto` on the same element (top overflow becomes unreachable — we shipped and
  fixed that bug; don't re-ship it).

## 4. Taste calls — decide, write it down, move

When two options are defensible: pick the one that (a) follows an existing pattern in this
repo over inventing one, (b) follows platform convention over novelty (chat surfaces behave
like chat apps), (c) is honest over impressive (a `warning` glyph on a degraded note, a true
"Best value" label). Then **write the decision and rationale into the relevant doc** so it's
settled once. A taste call made silently will be re-litigated forever.

## 5. Process mechanics that keep the fleet fast

- **Main moves every ~20–30 minutes.** Fetch and rebase before you open a PR; resolve
  conflicts by *keeping both intents* (read what the other change wanted).
- **One branch per work stream.** Never stack unrelated commits on a shared PR.
- **PRs are ready (not draft), body = what/why/test plan,** and merge only after CI is green
  and review is clean. Squash-merge with the PR number in the title.
- **Commits:** `git config user.email noreply@anthropic.com`, `git config user.name Claude`,
  and end the message with the Co-Authored-By + Claude-Session trailer used across this repo.
- **Report honestly.** Failing test → say so with output. Skipped item → say what you saw.
  "Done" means verified, not written.

## 6. Token & time economy — the codebase is a cost surface

Agent work is priced in tokens and wall-clock; the code's shape sets that price.

- **Read economically.** Grep for the symbol, read the 40 relevant lines — not the whole
  file. Delegate broad sweeps to a search subagent and keep only the conclusion.
- **Keep files splittable-small.** The hot files (`components/SearchBar.tsx` ~1100 lines,
  `app/api/concierge/route.ts` ~830, `components/CheckoutForm.tsx` ~820) cost every agent on
  every read and collide in every parallel session. When you touch one, extract the piece you
  touched into its own module if the diff stays reviewable — shrink-as-you-go. Dedicated
  split-refactors happen only as their own scoped issue, never alongside feature work.
- **One source of truth per fact.** Duplicated tables/copy (chip tables, valuation notes,
  glyph lists) rot and double the read cost — consolidate when you see a twin.
- **Plans are cheaper than exploration.** If a blueprint exists in `docs/plans/`, trust it and
  read the code it names, in that order.

## 7. What NOT to attempt without a stronger driver or the owner

- Running migrations or touching production data/env.
- Anything under `eve/` scheduling real deliveries, Stripe/webhook code, auth flows.
- Multi-surface refactors (container systems, scroll models) — take the Linear issue's exact
  scope instead; if the issue is under-specified, comment on it rather than improvising.
