import { defineConfig } from "vitest/config";

/** Local-only direct PostgREST denial regression for B6.3. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/database/postgrest/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
