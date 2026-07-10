// Vitest configuration. Tests live next to the code they cover (src/**/*.test.ts) so
// a module and its tests move together; `npm test` runs them once, `npm run test:watch`
// re-runs on change.
//
// Vitest doesn't read tsconfig path aliases on its own, so the `@` → src mapping from
// tsconfig.json is repeated here (the alternative, the vite-tsconfig-paths plugin, adds
// a dependency to avoid two lines of config — not worth it).
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Pure-logic tests only for now — no DOM, so the default node environment is right.
    // If component tests are added later, switch those files to jsdom via a per-file
    // `// @vitest-environment jsdom` comment rather than globally.
    environment: "node",
  },
});
