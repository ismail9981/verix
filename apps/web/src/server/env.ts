import { config } from "dotenv";
import { z } from "zod";

/*
 * Centralized, validated environment access for all server code.
 *
 * `dotenv` loads variables from a local `.env` file into `process.env` (a
 * no-op in hosted environments like Vercel that inject them directly). The
 * Zod schema then parses `process.env` once at import time, so the rest of
 * the server can consume a fully-typed `env` object and the app fails fast
 * with a readable error if anything is missing or malformed.
 */

config();

const EnvSchema = z.object({
  // Postgres connection string (the Supabase pooler URL in production).
  DATABASE_URL: z.string().min(1),

  // Supabase project credentials.
  SUPABASE_URL: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env: Env = parsed.data;
