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

  // --- Host routing (Sprint 7.3) ---
  // Kill switch: "false" fully disables host-based rewriting, so proxy.ts
  // behaves exactly as before this sprint (dashboard/auth unaffected either way).
  ENABLE_HOST_ROUTING: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Extra application/dashboard hostnames beyond the built-in defaults
  // (localhost, and the app domain + its "app." subdomain — see
  // `src/server/hosting/config.ts`). Comma-separated, e.g. "app.verix.app".
  APP_HOST: z.string().optional(),
  // Only honor `x-forwarded-host`/`forwarded` when explicitly trusted (e.g. a
  // self-hosted deployment behind an operator-controlled reverse proxy). Off
  // by default: on Vercel the `Host` header is already the real per-domain
  // hostname, and trusting a forwarded header by default would let a client
  // spoof routing by sending it directly.
  TRUST_X_FORWARDED_HOST: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  // --- Public lead forms (Sprint 9) ---
  // Salts the one-way hash stored in `leads.ip_hash` — never the raw IP.
  // Not a secret that gates access (only spam-bucketing quality), so a
  // built-in default keeps CI/dev friction-free; set a real value in
  // production so hashes aren't guessable across deployments.
  LEAD_IP_HASH_SALT: z.string().min(1).default("dev-insecure-ip-salt"),
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
