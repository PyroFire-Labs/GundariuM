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
    // Foundry sub-project — not part of the Next.js app, has its own vendored JS tooling
    "contracts/**",
    // Nested worktree checkouts (each has its own node_modules and full source copy)
    ".claude/**",
  ]),
]);

export default eslintConfig;
