-- Leads (Sprint 9): public-form submissions captured as workspace-scoped leads + RLS.
-- Applied idempotently.
--
-- NOTE ON TOOLING: this file was hand-written (not `drizzle-kit generate`
-- output). `drizzle/meta/_journal.json` only records migrations 0000-0001,
-- while 0002-0008 already exist as unjournaled SQL files predating this
-- sprint — `drizzle-kit generate` refuses to run non-interactively against
-- that drift, and `drizzle-kit push` crashes introspecting an unrelated
-- existing CHECK constraint. Both are pre-existing tooling gaps, out of
-- scope here; this migration follows the same idempotent-DDL convention as
-- 0003/0006 and was applied directly against DATABASE_URL.

DO $$ BEGIN
  CREATE TYPE "lead_status" AS ENUM ('new', 'contacted', 'qualified', 'converted', 'archived', 'spam');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "page_path" text NOT NULL DEFAULT '',
  "source_domain" text,
  "form_key" text NOT NULL,
  "name" text,
  "email" text,
  "phone" text,
  "subject" text,
  "message" text,
  "status" "lead_status" NOT NULL DEFAULT 'new',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "ip_hash" text,
  "user_agent" text,
  "submitted_at" timestamptz NOT NULL DEFAULT now(),
  "converted_customer_id" uuid REFERENCES "customers"("id") ON DELETE set null,
  "converted_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_workspace_created_idx" ON "leads" ("workspace_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_workspace_status_idx" ON "leads" ("workspace_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_site_created_idx" ON "leads" ("site_id", "created_at");--> statement-breakpoint

-- RLS: workspace-membership policy, consistent with the other builder tables.
-- Grant is `authenticated`-only, never `anon` — the public submission path
-- writes through the app's direct DATABASE_URL connection (service role),
-- not the anon Postgres role, and must not gain a parallel unvalidated
-- PostgREST insert path that bypasses the route handler's checks.
ALTER TABLE "leads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "leads" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "leads";--> statement-breakpoint
CREATE POLICY workspace_access ON "leads" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
