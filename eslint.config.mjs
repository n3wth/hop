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
  ]),
]);

export default eslintConfig;
