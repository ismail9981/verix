import { defineConfig } from "vitest/config";

/**
 * Live, security-sensitive tests for the repository-local Supabase stack.
 * This project is intentionally separate from the fast default unit suite.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/database/rls/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
