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
    env: {
      // A deliberately dead address, and the deadness is the point.
      //
      // `src/lib/db.ts` constructs its Prisma client at module load and throws when
      // DATABASE_URL is unset, so importing anything that reaches `lib/deps.ts` — which is
      // every seamed module — needs *some* value here. No connection is ever opened: `pg.Pool`
      // connects lazily on the first query, and the tests inject `makeFakeDb()` instead.
      //
      // Port 1 rather than the real 5432 so that a test which forgets to pass its fake deps
      // fails immediately with ECONNREFUSED instead of quietly reading and writing the
      // developer's local database. Do not "fix" this by pointing it at the docker-compose
      // instance; a suite that can reach real data is a suite that can destroy it.
      DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/bayana_tests_never_connect",
      // The demo-cookie tests sign and verify real HMACs, so they need a key. A fixed,
      // obviously-fake value keeps them deterministic and keeps the developer's actual
      // AUTH_SECRET out of the picture. `current-user.test.ts` overrides it per-case to
      // exercise the fail-closed path.
      AUTH_SECRET: "test-auth-secret-not-a-real-key",
    },
  },
});
