-- Sprint 4.5 (hardening): close the tenant-isolation gap on invoices and
-- integrations. Every other workspace-scoped table already has RLS + the
-- workspace_access policy; these two were missing it, leaving them readable/
-- writable by anon/authenticated over PostgREST. Applied idempotently.

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

GRANT SELECT, INSERT, UPDATE, DELETE ON "invoices", "integrations" TO authenticated;--> statement-breakpoint

DROP POLICY IF EXISTS workspace_access ON "invoices";--> statement-breakpoint
CREATE POLICY workspace_access ON "invoices" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));--> statement-breakpoint

DROP POLICY IF EXISTS workspace_access ON "integrations";--> statement-breakpoint
CREATE POLICY workspace_access ON "integrations" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
