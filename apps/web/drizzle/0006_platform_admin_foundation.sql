CREATE TYPE "public"."platform_admin_role" AS ENUM('super_admin', 'support_admin');--> statement-breakpoint
CREATE TYPE "public"."platform_admin_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."platform_audit_action" AS ENUM('platform_admin.bootstrap_completed', 'workspace.created', 'workspace.owner_assigned', 'workspace.suspended', 'workspace.activated');--> statement-breakpoint
CREATE TYPE "public"."platform_audit_actor_kind" AS ENUM('platform_admin', 'system_bootstrap');--> statement-breakpoint
CREATE TYPE "public"."platform_audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."platform_audit_target_type" AS ENUM('platform_admin', 'workspace');--> statement-breakpoint
CREATE TYPE "public"."workspace_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"role" "platform_admin_role" NOT NULL,
	"status" "platform_admin_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_auth_user_id_uq" UNIQUE("auth_user_id"),
	CONSTRAINT "platform_admins_id_auth_user_id_uq" UNIQUE("id","auth_user_id")
);
--> statement-breakpoint
CREATE TABLE "platform_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_kind" "platform_audit_actor_kind" NOT NULL,
	"actor_platform_admin_id" uuid,
	"actor_auth_user_id" uuid,
	"action" "platform_audit_action" NOT NULL,
	"target_type" "platform_audit_target_type" NOT NULL,
	"target_id" uuid,
	"outcome" "platform_audit_outcome" NOT NULL,
	"request_id" text NOT NULL,
	"idempotency_key" uuid,
	"request_fingerprint" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_audit_events_actor_shape_ck" CHECK (("platform_audit_events"."actor_kind" = 'platform_admin' and "platform_audit_events"."actor_platform_admin_id" is not null and "platform_audit_events"."actor_auth_user_id" is not null and "platform_audit_events"."action" <> 'platform_admin.bootstrap_completed') or ("platform_audit_events"."actor_kind" = 'system_bootstrap' and "platform_audit_events"."actor_platform_admin_id" is null and "platform_audit_events"."actor_auth_user_id" is null and "platform_audit_events"."action" = 'platform_admin.bootstrap_completed' and "platform_audit_events"."outcome" = 'success' and "platform_audit_events"."target_type" = 'platform_admin' and "platform_audit_events"."target_id" is not null)),
	CONSTRAINT "platform_audit_events_success_target_ck" CHECK ("platform_audit_events"."outcome" <> 'success' or "platform_audit_events"."target_id" is not null),
	CONSTRAINT "platform_audit_events_idempotency_pair_ck" CHECK (("platform_audit_events"."idempotency_key" is null) = ("platform_audit_events"."request_fingerprint" is null)),
	CONSTRAINT "platform_audit_events_fingerprint_ck" CHECK ("platform_audit_events"."request_fingerprint" is null or "platform_audit_events"."request_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "platform_audit_events_request_id_ck" CHECK (char_length("platform_audit_events"."request_id") between 1 and 128),
	CONSTRAINT "platform_audit_events_metadata_ck" CHECK (jsonb_typeof("platform_audit_events"."metadata") = 'object' and octet_length("platform_audit_events"."metadata"::text) <= 16384)
);
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "status" "workspace_status";--> statement-breakpoint
UPDATE "workspaces" SET "status" = 'active' WHERE "status" IS NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "status" SET DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_audit_events" ADD CONSTRAINT "platform_audit_events_actor_identity_fk" FOREIGN KEY ("actor_platform_admin_id","actor_auth_user_id") REFERENCES "public"."platform_admins"("id","auth_user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_events_occurred_at_idx" ON "platform_audit_events" USING btree ("occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "platform_audit_events_actor_occurred_idx" ON "platform_audit_events" USING btree ("actor_platform_admin_id","occurred_at" DESC NULLS LAST) WHERE "platform_audit_events"."actor_platform_admin_id" is not null;--> statement-breakpoint
CREATE INDEX "platform_audit_events_target_occurred_idx" ON "platform_audit_events" USING btree ("target_type","target_id","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "platform_audit_events_action_occurred_idx" ON "platform_audit_events" USING btree ("action","occurred_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "platform_audit_events_success_idempotency_uq" ON "platform_audit_events" USING btree ("actor_platform_admin_id","action","idempotency_key") WHERE "platform_audit_events"."actor_platform_admin_id" is not null and "platform_audit_events"."idempotency_key" is not null and "platform_audit_events"."outcome" = 'success';--> statement-breakpoint
CREATE UNIQUE INDEX "platform_audit_events_bootstrap_once_uq" ON "platform_audit_events" USING btree ("action") WHERE "platform_audit_events"."action" = 'platform_admin.bootstrap_completed' and "platform_audit_events"."outcome" = 'success';--> statement-breakpoint
CREATE INDEX "workspaces_status_created_at_idx" ON "workspaces" USING btree ("status","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_platform_admin_auth_user_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'platform_admins.auth_user_id is immutable.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_platform_admin_auth_user_id_immutability()
  FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
CREATE TRIGGER enforce_platform_admin_auth_user_id_immutability_trg
BEFORE UPDATE OF auth_user_id ON public.platform_admins
FOR EACH ROW EXECUTE FUNCTION public.enforce_platform_admin_auth_user_id_immutability();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.prevent_platform_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  RAISE EXCEPTION 'platform_audit_events is append-only.'
    USING ERRCODE = '55000';
END
$function$;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.prevent_platform_audit_event_mutation()
  FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
CREATE TRIGGER prevent_platform_audit_event_mutation_trg
BEFORE UPDATE OR DELETE ON public.platform_audit_events
FOR EACH ROW EXECUTE FUNCTION public.prevent_platform_audit_event_mutation();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT tm.workspace_id
  FROM public.team_members tm
  JOIN public.users u
    ON u.id = tm.user_id
   AND u.deleted_at IS NULL
  JOIN public.workspaces w
    ON w.id = tm.workspace_id
   AND w.status = 'active'
   AND w.deleted_at IS NULL
  WHERE u.auth_user_id = auth.uid()
    AND tm.status = 'active'
    AND tm.deleted_at IS NULL
$function$;--> statement-breakpoint
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.platform_audit_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.platform_admins
  FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.platform_audit_events
  FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.current_workspace_ids()
  FROM PUBLIC, anon, authenticated, service_role;
