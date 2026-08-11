-- CRM Pipeline (Sprint 10): opportunities/pipeline/stages/activities on top of
-- Leads and Customers, with a default 7-stage pipeline auto-provisioned per
-- workspace by the app (not this migration). Applied idempotently.
--
-- NOTE ON TOOLING: hand-written, following the same idempotent-DDL convention
-- as 0009_leads.sql — `drizzle-kit generate`/`push` remain broken for this
-- repo's unjournaled migration history (see 0009's note); applied directly
-- against DATABASE_URL.

DO $$ BEGIN
  CREATE TYPE "crm_stage_tone" AS ENUM ('neutral', 'info', 'warning', 'success', 'danger', 'accent');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "crm_opportunity_status" AS ENUM ('open', 'won', 'lost');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "crm_activity_type" AS ENUM ('note', 'call', 'email', 'meeting', 'task', 'status_change');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_pipelines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_pipelines_workspace_idx" ON "crm_pipelines" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_pipelines_workspace_default_uq" ON "crm_pipelines" ("workspace_id") WHERE is_default = true and deleted_at is null;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_stages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "pipeline_id" uuid NOT NULL REFERENCES "crm_pipelines"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  "probability_percent" integer NOT NULL DEFAULT 0,
  "tone" "crm_stage_tone" NOT NULL DEFAULT 'neutral',
  "is_won" boolean NOT NULL DEFAULT false,
  "is_lost" boolean NOT NULL DEFAULT false,
  "is_protected" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_stages_pipeline_position_idx" ON "crm_stages" ("pipeline_id", "position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_stages_workspace_idx" ON "crm_stages" ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_stages_pipeline_won_uq" ON "crm_stages" ("pipeline_id") WHERE is_won = true and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "crm_stages_pipeline_lost_uq" ON "crm_stages" ("pipeline_id") WHERE is_lost = true and deleted_at is null;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_opportunities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "pipeline_id" uuid NOT NULL REFERENCES "crm_pipelines"("id") ON DELETE cascade,
  "stage_id" uuid NOT NULL REFERENCES "crm_stages"("id") ON DELETE restrict,
  "lead_id" uuid REFERENCES "leads"("id") ON DELETE set null,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE set null,
  "assigned_to_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "title" text NOT NULL,
  "value_cents" integer NOT NULL DEFAULT 0,
  "currency" text NOT NULL DEFAULT 'usd',
  "status" "crm_opportunity_status" NOT NULL DEFAULT 'open',
  "loss_reason" text,
  "expected_close_date" timestamptz,
  "closed_at" timestamptz,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_workspace_stage_idx" ON "crm_opportunities" ("workspace_id", "stage_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_workspace_assigned_idx" ON "crm_opportunities" ("workspace_id", "assigned_to_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_workspace_status_idx" ON "crm_opportunities" ("workspace_id", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_workspace_created_idx" ON "crm_opportunities" ("workspace_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_pipeline_idx" ON "crm_opportunities" ("pipeline_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_opportunities_lead_idx" ON "crm_opportunities" ("lead_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "crm_activities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "opportunity_id" uuid NOT NULL REFERENCES "crm_opportunities"("id") ON DELETE cascade,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "type" "crm_activity_type" NOT NULL DEFAULT 'note',
  "title" text NOT NULL,
  "body" text,
  "due_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_opportunity_created_idx" ON "crm_activities" ("opportunity_id", "created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "crm_activities_workspace_due_idx" ON "crm_activities" ("workspace_id", "due_at");--> statement-breakpoint

-- RLS: same workspace-membership policy pattern as every other tenant table.
-- `authenticated`-only grant — never `anon`.
ALTER TABLE "crm_pipelines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "crm_pipelines" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "crm_pipelines";--> statement-breakpoint
CREATE POLICY workspace_access ON "crm_pipelines" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE "crm_stages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "crm_stages" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "crm_stages";--> statement-breakpoint
CREATE POLICY workspace_access ON "crm_stages" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE "crm_opportunities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "crm_opportunities" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "crm_opportunities";--> statement-breakpoint
CREATE POLICY workspace_access ON "crm_opportunities" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE "crm_activities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "crm_activities" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "crm_activities";--> statement-breakpoint
CREATE POLICY workspace_access ON "crm_activities" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
