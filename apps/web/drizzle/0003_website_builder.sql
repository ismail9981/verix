-- Website Builder (Sprint 1): sites, pages, page_sections + RLS.
-- Applied idempotently.

DO $$ BEGIN
  CREATE TYPE "site_status" AS ENUM ('draft', 'published', 'unpublished');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "page_status" AS ENUM ('draft', 'ready');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sites" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "default_locale" text NOT NULL DEFAULT 'en-us',
  "status" "site_status" NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sites_workspace_idx" ON "sites" ("workspace_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "path" text NOT NULL DEFAULT '',
  "title" text NOT NULL,
  "locale" text NOT NULL DEFAULT 'en-us',
  "status" "page_status" NOT NULL DEFAULT 'draft',
  "position" integer NOT NULL DEFAULT 0,
  "seo_title" text,
  "seo_description" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pages_site_path_locale_uq" ON "pages" ("site_id", "path", "locale") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_site_idx" ON "pages" ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_workspace_idx" ON "pages" ("workspace_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "page_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL REFERENCES "pages"("id") ON DELETE cascade,
  "site_id" uuid NOT NULL REFERENCES "sites"("id") ON DELETE cascade,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "type_key" text NOT NULL,
  "type_version" integer NOT NULL DEFAULT 1,
  "position" integer NOT NULL DEFAULT 0,
  "props" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "is_visible" boolean NOT NULL DEFAULT true,
  "locale" text NOT NULL DEFAULT 'en-us',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_sections_page_idx" ON "page_sections" ("page_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_sections_site_idx" ON "page_sections" ("site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_sections_workspace_idx" ON "page_sections" ("workspace_id");--> statement-breakpoint

-- RLS: workspace-membership policies (reuse the shared helper from 0002/RLS).
ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "page_sections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "sites", "pages", "page_sections" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "sites";--> statement-breakpoint
CREATE POLICY workspace_access ON "sites" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "pages";--> statement-breakpoint
CREATE POLICY workspace_access ON "pages" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "page_sections";--> statement-breakpoint
CREATE POLICY workspace_access ON "page_sections" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
