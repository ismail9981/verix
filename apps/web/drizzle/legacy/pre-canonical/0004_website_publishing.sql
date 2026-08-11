-- Website Builder (Sprint 4): immutable published site versions + snapshots.
-- Adds site_versions, the sites.theme_key / sites.published_version_id columns,
-- the sites↔site_versions FK (added after both tables exist to break the cycle),
-- and RLS. Applied idempotently.

DO $$ BEGIN
  CREATE TYPE "site_version_status" AS ENUM ('published', 'superseded', 'archived');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- New columns on sites (nullable → non-breaking for existing rows).
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "theme_key" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "published_version_id" uuid;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "site_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "version_number" integer NOT NULL,
  "status" "site_version_status" NOT NULL DEFAULT 'published',
  "label" text,
  "snapshot" jsonb NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "published_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "site_versions"
    ADD CONSTRAINT "site_versions_site_number_uq" UNIQUE ("site_id", "version_number");
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_versions_site_idx" ON "site_versions" ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_versions_workspace_idx" ON "site_versions" ("workspace_id");--> statement-breakpoint

-- The live-version pointer FK, now that site_versions exists.
DO $$ BEGIN
  ALTER TABLE "sites"
    ADD CONSTRAINT "sites_published_version_id_fk"
    FOREIGN KEY ("published_version_id") REFERENCES "site_versions"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- RLS: workspace-membership policy, consistent with sites/pages/page_sections.
-- Defense-in-depth for direct Supabase access; the server layer always scopes
-- by workspace_id, and the public renderer reads snapshots via the server role.
ALTER TABLE "site_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_versions" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "site_versions";--> statement-breakpoint
CREATE POLICY workspace_access ON "site_versions" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
