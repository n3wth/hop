import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Eve agent scaffold is a separate runtime (its own deps, served by the
    // `eve` framework — see eve/README.md). It is intentionally NOT part of the
    // Next.js app's typecheck/lint/build (also excluded in tsconfig.json).
    "eve/**",
    // The Cloudflare valuations Worker (cloudflare/valuations-worker/) is a
    // separate runtime (workerd) with its own package.json/tsconfig, deployed
    // independently — same reasoning as the eve/** ignore above.
    "cloudflare/**",
    // Workflow scripts (.claude/workflows/*.js) run in the Workflow tool's
    // sandbox with injected globals (agent, pipeline, phase, …) — linting them
    // as app code yields wall-to-wall no-undef. See ADR 0006 and
    // docs/solutions/2026-07-01-workflow-scripts-are-a-third-runtime.md.
    ".claude/**",
    // Starter kits under docs/meta/starters/ are template code for *other*
    // repos (copied out verbatim), not part of this app — same reasoning as
    // the .claude/** and eve/** ignores above.
    "docs/meta/starters/**",
  ]),
  // ── Design-system enforcement ladder (docs/plans/2026-07-02-design-component-system.md) ──
  // One `no-restricted-syntax` entry per canonized recipe. Each lands at 'warn'
  // (visible, non-blocking — the /audit burn-down signal) and flips to 'error'
  // per-recipe only once its census grep hits zero. Never a big-bang switch.
  // components/ui/** is exempt: primitives are where the recipes legitimately live.
  // Known gap (accepted): string literals only — template-literal interpolations
  // escape the AST match; the copy-voice-reviewer grep over raw diff text is the
  // backstop.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // PR 1 (tokens): hand-rolled numeric letter-spacing, e.g. tracking-[0.12em].
          // Use the role tokens instead: tracking-[var(--track-eyebrow)], -label, or -tag
          // (app/globals.css @theme; index in docs/design/DESIGN-SYSTEM.md).
          selector: String.raw`Literal[value=/tracking-\[0\./]`,
          message:
            "Hand-rolled tracking value — use the letter-spacing tokens: tracking-[var(--track-eyebrow)] (0.12em), tracking-[var(--track-label)] (0.06em), or tracking-[var(--track-tag)] (0.1em). See docs/design/DESIGN-SYSTEM.md.",
        },
        {
          // PR 2/7 (Button): hand-rolled ink button recipe (border-[1.5px] border-text).
          // Use <Button variant="ink"> primitive instead.
          selector: String.raw`Literal[value=/border-\[1\.5px\] border-text/]`,
          message:
            "Hand-rolled ink button style — use the <Button variant=\"ink\"> primitive instead. See docs/design/DESIGN-SYSTEM.md.",
        },
      ],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // PR 4 (Card): hand-rolled card recipe, e.g. border-border bg-surface, rounded-[12px], etc.
          selector: String.raw`Literal[value=/border border-border bg-(paper|surface|sunk)/]`,
          message:
            "Hand-rolled card recipe — use the <Card> primitive instead to keep styling consistent and responsive. See docs/design/DESIGN-SYSTEM.md.",
        },
        {
          // PR 4 (Eyebrow): hand-rolled uppercase labels with tracking
          selector: String.raw`Literal[value=/tracking-\[var\(--track-eyebrow\)\].*uppercase/], Literal[value=/uppercase.*tracking-\[var\(--track-eyebrow\)\]/]`,
          message:
            "Hand-rolled eyebrow style — use the <Eyebrow> primitive instead of hand-rolling the uppercase and tracking styles. See docs/design/DESIGN-SYSTEM.md.",
        },
      ],
    },
  },
]);

export default eslintConfig;
