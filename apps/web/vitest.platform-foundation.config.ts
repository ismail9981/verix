import { defineConfig } from "vitest/config";

/** Local-only integration coverage for the Sprint 2 database foundation. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/database/platform-foundation/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
