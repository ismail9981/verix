import { configDefaults, defineConfig } from "vitest/config";

/**
 * Isolated database-test project. B1 safety tests are pure; B2/B3 can add
 * guarded integration tests under src/test/database without changing the
 * application's existing Vitest project.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/test/database/**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      "src/test/database/**/*.integration.test.ts",
    ],
  },
});
