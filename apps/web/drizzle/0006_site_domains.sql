-- Website Builder (Sprint 7.1): domain model foundation.
-- Adds site_domains + enums + RLS. Independent of the publishing pipeline.
-- Applied idempotently.

DO $$ BEGIN
  CREATE TYPE "domain_type" AS ENUM ('subdomain', 'custom');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "domain_status" AS ENUM ('pending', 'verified', 'active', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "site_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "hostname" text NOT NULL,
  "type" "domain_type" NOT NULL,
  "status" "domain_status" NOT NULL DEFAULT 'pending',
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
-- Globally unique hostname among live rows (soft-deleted rows don't collide).
CREATE UNIQUE INDEX IF NOT EXISTS "site_domains_hostname_uq" ON "site_domains" ("hostname") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_domains_site_idx" ON "site_domains" ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_domains_workspace_idx" ON "site_domains" ("workspace_id");--> statement-breakpoint

-- RLS: workspace-membership policy, consistent with the other builder tables.
ALTER TABLE "site_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_domains" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "site_domains";--> statement-breakpoint
CREATE POLICY workspace_access ON "site_domains" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
