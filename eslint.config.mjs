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
  ]),
]);

export default eslintConfig;
