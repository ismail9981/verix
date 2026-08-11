import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

/*
 * Unit tests for the pure core of the platform — publishing pipeline (snapshot
 * schema, version-aware section resolution, page selection, data freezing,
 * metadata) plus the security primitives (RBAC, redirect safety). These modules
 * are dependency-free (no db/env), so the suite runs in CI without secrets.
 *
 * The React plugin transforms the section registry's `.tsx` modules on import
 * (the app's tsconfig uses `jsx: "preserve"`, which esbuild alone won't handle).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: [
      ...configDefaults.exclude,
      "src/test/database/**/*.integration.test.ts",
    ],
  },
});
