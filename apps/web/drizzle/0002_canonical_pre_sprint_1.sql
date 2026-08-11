-- B2.4 canonical consolidation/adoption point.
-- Fresh Supabase-compatible databases execute this after active 0000/0001.
-- Existing canonical databases must use the guarded adoption tool and must
-- never execute this schema-building migration.

DO $$
BEGIN
  IF to_regnamespace('auth') IS NULL
    OR to_regclass('auth.users') IS NULL
    OR to_regprocedure('auth.uid()') IS NULL
    OR to_regprocedure('pg_catalog.gen_random_uuid()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role')
  THEN
    RAISE EXCEPTION 'Verix canonical migration requires a supported Supabase PostgreSQL environment';
  END IF;
END
$$;--> statement-breakpoint

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;--> statement-breakpoint

CREATE TYPE "public"."crm_activity_type" AS ENUM('note', 'call', 'email', 'meeting', 'task', 'status_change');--> statement-breakpoint
CREATE TYPE "public"."crm_opportunity_status" AS ENUM('open', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."crm_stage_tone" AS ENUM('neutral', 'info', 'warning', 'success', 'danger', 'accent');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verified', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."domain_type" AS ENUM('subdomain', 'custom');--> statement-breakpoint
CREATE TYPE "public"."domain_verification_method" AS ENUM('txt', 'cname');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."housekeeping_task_type" AS ENUM('cleaning', 'inspection', 'maintenance', 'linen_change', 'restocking', 'other');--> statement-breakpoint
CREATE TYPE "public"."invoice_line_item_type" AS ENUM('stay', 'fee', 'tax', 'discount');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'archived', 'spam');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('draft', 'ready');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('charge', 'refund');--> statement-breakpoint
CREATE TYPE "public"."rental_unit_condition" AS ENUM('cleaning', 'maintenance', 'out_of_service');--> statement-breakpoint
CREATE TYPE "public"."rental_unit_type" AS ENUM('room', 'apartment', 'villa', 'other');--> statement-breakpoint
CREATE TYPE "public"."reservation_payment_status" AS ENUM('unpaid', 'partially_paid', 'paid');--> statement-breakpoint
CREATE TYPE "public"."reservation_source" AS ENUM('direct', 'phone', 'walk_in', 'website', 'other');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('inquiry', 'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('draft', 'published', 'unpublished');--> statement-breakpoint
CREATE TYPE "public"."site_version_status" AS ENUM('published', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."ssl_status" AS ENUM('not_requested', 'pending', 'ready', 'failed');--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'written_off';--> statement-breakpoint
CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" "crm_activity_type" DEFAULT 'note' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"lead_id" uuid,
	"customer_id" uuid,
	"assigned_to_user_id" uuid,
	"title" text NOT NULL,
	"value_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status" "crm_opportunity_status" DEFAULT 'open' NOT NULL,
	"loss_reason" text,
	"expected_close_date" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "crm_opportunities_currency_iso_ck" CHECK ("crm_opportunities"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "crm_pipelines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"probability_percent" integer DEFAULT 0 NOT NULL,
	"tone" "crm_stage_tone" DEFAULT 'neutral' NOT NULL,
	"is_won" boolean DEFAULT false NOT NULL,
	"is_lost" boolean DEFAULT false NOT NULL,
	"is_protected" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "housekeeping_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"reservation_id" uuid,
	"task_type" "housekeeping_task_type" NOT NULL,
	"status" "housekeeping_task_status" DEFAULT 'pending' NOT NULL,
	"priority" "housekeeping_task_priority" DEFAULT 'normal' NOT NULL,
	"assigned_to" uuid,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"due_time" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"type" "invoice_line_item_type" NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_amount_cents" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_line_items_quantity_positive_ck" CHECK ("invoice_line_items"."quantity" > 0),
	CONSTRAINT "invoice_line_items_sort_order_ck" CHECK ("invoice_line_items"."sort_order" >= 0),
	CONSTRAINT "invoice_line_items_amount_sign_ck" CHECK (("invoice_line_items"."type" = 'discount' and "invoice_line_items"."amount_cents" < 0) or ("invoice_line_items"."type" <> 'discount' and "invoice_line_items"."amount_cents" > 0))
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_path" text DEFAULT '' NOT NULL,
	"source_domain" text,
	"form_key" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"subject" text,
	"message" text,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"converted_customer_id" uuid,
	"converted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "page_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type_key" text NOT NULL,
	"type_version" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	"locale" text DEFAULT 'en-us' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"path" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"locale" text DEFAULT 'en-us' NOT NULL,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"seo_no_index" boolean DEFAULT false NOT NULL,
	"seo_no_follow" boolean DEFAULT false NOT NULL,
	"og_title" text,
	"og_description" text,
	"og_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address_line1" text,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rental_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"building_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit_number" text,
	"floor" integer,
	"unit_type" "rental_unit_type" DEFAULT 'room' NOT NULL,
	"description" text,
	"capacity" integer DEFAULT 1 NOT NULL,
	"bedrooms" integer DEFAULT 0 NOT NULL,
	"bathrooms" integer DEFAULT 0 NOT NULL,
	"size_sq_ft" integer,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"notes" text,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"status_override" "rental_unit_condition",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "rental_units_currency_iso_ck" CHECK ("rental_units"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"staff_id" uuid,
	"status" "reservation_status" DEFAULT 'inquiry' NOT NULL,
	"check_in_date" date NOT NULL,
	"check_out_date" date NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"source" "reservation_source" DEFAULT 'direct' NOT NULL,
	"payment_status" "reservation_payment_status" DEFAULT 'unpaid' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "reservations_currency_iso_ck" CHECK ("reservations"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "site_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"type" "domain_type" NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"verification_method" "domain_verification_method",
	"verification_error" text,
	"verification_attempted_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"ssl_status" "ssl_status" DEFAULT 'not_requested' NOT NULL,
	"ssl_error" text,
	"ssl_issued_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "site_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"status" "site_version_status" DEFAULT 'published' NOT NULL,
	"label" text,
	"snapshot" jsonb NOT NULL,
	"created_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_versions_site_number_uq" UNIQUE("site_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"default_locale" text DEFAULT 'en-us' NOT NULL,
	"status" "site_status" DEFAULT 'draft' NOT NULL,
	"theme_key" text,
	"published_version_id" uuid,
	"seo_default_title" text,
	"seo_title_template" text,
	"seo_default_description" text,
	"seo_default_image_url" text,
	"seo_indexable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "accent_color" SET DEFAULT '#8B5CF6';--> statement-breakpoint
ALTER TABLE "workspaces" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "reservation_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_email_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "property_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "building_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "unit_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "check_in_date_snapshot" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "check_out_date_snapshot" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "written_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "written_off_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "type" "payment_type" DEFAULT 'charge' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "refunded_payment_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "actor_team_member_id" uuid;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "primary_color" text DEFAULT '#6D5EF9' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "booking_notifications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "payment_notifications" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "marketing_emails" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "session_timeout_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "login_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "date_format" text DEFAULT 'MM/DD/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "time_format" text DEFAULT '12h' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "week_starts_on" text DEFAULT 'sunday' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_booking_duration_minutes" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "tax_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "tax_percent_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_booking_status" "booking_status" DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "default_payment_method" "payment_method" DEFAULT 'card' NOT NULL;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_id_crm_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."crm_opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_id_crm_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."crm_stages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_pipeline_id_crm_pipelines_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."crm_pipelines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_assigned_to_team_members_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_completed_by_team_members_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_tasks_created_by_team_members_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_customer_id_customers_id_fk" FOREIGN KEY ("converted_customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unit_id_rental_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."rental_units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_staff_id_team_members_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buildings_workspace_idx" ON "buildings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "buildings_property_position_idx" ON "buildings" USING btree ("property_id","position");--> statement-breakpoint
CREATE INDEX "crm_activities_opportunity_created_idx" ON "crm_activities" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_activities_workspace_due_idx" ON "crm_activities" USING btree ("workspace_id","due_at");--> statement-breakpoint
CREATE INDEX "crm_opportunities_workspace_stage_idx" ON "crm_opportunities" USING btree ("workspace_id","stage_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_workspace_assigned_idx" ON "crm_opportunities" USING btree ("workspace_id","assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_workspace_status_idx" ON "crm_opportunities" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "crm_opportunities_workspace_created_idx" ON "crm_opportunities" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "crm_opportunities_pipeline_idx" ON "crm_opportunities" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "crm_opportunities_lead_idx" ON "crm_opportunities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "crm_pipelines_workspace_idx" ON "crm_pipelines" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_pipelines_workspace_default_uq" ON "crm_pipelines" USING btree ("workspace_id") WHERE is_default = true and deleted_at is null;--> statement-breakpoint
CREATE INDEX "crm_stages_pipeline_position_idx" ON "crm_stages" USING btree ("pipeline_id","position");--> statement-breakpoint
CREATE INDEX "crm_stages_workspace_idx" ON "crm_stages" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_stages_pipeline_won_uq" ON "crm_stages" USING btree ("pipeline_id") WHERE is_won = true and deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "crm_stages_pipeline_lost_uq" ON "crm_stages" USING btree ("pipeline_id") WHERE is_lost = true and deleted_at is null;--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_workspace_idx" ON "housekeeping_tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_unit_idx" ON "housekeeping_tasks" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_property_idx" ON "housekeeping_tasks" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_building_idx" ON "housekeeping_tasks" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_assigned_idx" ON "housekeeping_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_status_idx" ON "housekeeping_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_task_type_idx" ON "housekeeping_tasks" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_priority_idx" ON "housekeeping_tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_due_date_idx" ON "housekeeping_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_reservation_idx" ON "housekeeping_tasks" USING btree ("reservation_id");--> statement-breakpoint
CREATE INDEX "housekeeping_tasks_deleted_idx" ON "housekeeping_tasks" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "housekeeping_checkout_task_uq" ON "housekeeping_tasks" USING btree ("reservation_id","task_type") WHERE reservation_id is not null and task_type = 'cleaning' and deleted_at is null;--> statement-breakpoint
CREATE INDEX "invoice_line_items_workspace_idx" ON "invoice_line_items" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "leads_workspace_created_idx" ON "leads" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "leads_workspace_status_idx" ON "leads" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "leads_site_created_idx" ON "leads" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "page_sections_page_idx" ON "page_sections" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "page_sections_site_idx" ON "page_sections" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "page_sections_workspace_idx" ON "page_sections" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_path_locale_uq" ON "pages" USING btree ("site_id","path","locale") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "pages_site_idx" ON "pages" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "pages_workspace_idx" ON "pages" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "properties_workspace_idx" ON "properties" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rental_units_workspace_idx" ON "rental_units" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "rental_units_property_idx" ON "rental_units" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "rental_units_building_idx" ON "rental_units" USING btree ("building_id");--> statement-breakpoint
CREATE INDEX "reservations_workspace_idx" ON "reservations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "reservations_unit_idx" ON "reservations" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "reservations_customer_idx" ON "reservations" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "reservations_staff_idx" ON "reservations" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "reservations_status_idx" ON "reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "reservations_payment_status_idx" ON "reservations" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "reservations_workspace_checkin_idx" ON "reservations" USING btree ("workspace_id","check_in_date");--> statement-breakpoint
CREATE INDEX "reservations_workspace_checkout_idx" ON "reservations" USING btree ("workspace_id","check_out_date");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_hostname_uq" ON "site_domains" USING btree ("hostname") WHERE deleted_at is null;--> statement-breakpoint
CREATE INDEX "site_domains_site_idx" ON "site_domains" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_domains_workspace_idx" ON "site_domains" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_verification_token_uq" ON "site_domains" USING btree ("verification_token") WHERE verification_token is not null;--> statement-breakpoint
CREATE INDEX "site_domains_status_idx" ON "site_domains" USING btree ("status");--> statement-breakpoint
CREATE INDEX "site_versions_site_idx" ON "site_versions" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "site_versions_workspace_idx" ON "site_versions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "sites_workspace_idx" ON "sites" USING btree ("workspace_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservation_id_reservations_id_fk" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_team_members_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_written_off_by_team_members_id_fk" FOREIGN KEY ("written_off_by") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_payment_id_payments_id_fk" FOREIGN KEY ("refunded_payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_actor_team_member_id_team_members_id_fk" FOREIGN KEY ("actor_team_member_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_reservation_idx" ON "invoices" USING btree ("reservation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_reservation_active_uq" ON "invoices" USING btree ("reservation_id") WHERE reservation_id is not null and status <> 'void';--> statement-breakpoint
CREATE INDEX "payments_type_idx" ON "payments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "payments_actor_team_member_idx" ON "payments" USING btree ("actor_team_member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_workspace_idempotency_uq" ON "payments" USING btree ("workspace_id","idempotency_key") WHERE idempotency_key is not null;--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "compact_mode";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "push_notifications";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "booking_alerts";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN "weekly_reports";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_iso_ck" CHECK ("invoices"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_at_ck" CHECK ("invoices"."status" = 'draft' or "invoices"."issued_at" is not null);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_void_audit_ck" CHECK ("invoices"."status" <> 'void' or "invoices"."voided_at" is not null);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_written_off_audit_ck" CHECK ("invoices"."status" <> 'written_off' or "invoices"."written_off_at" is not null);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_audit_exclusive_ck" CHECK (not ("invoices"."voided_at" is not null and "invoices"."written_off_at" is not null));--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_non_negative_ck" CHECK ("invoices"."amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_iso_ck" CHECK ("payments"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_reference_ck" CHECK (("payments"."type" = 'refund') = ("payments"."refunded_payment_id" is not null));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_exactly_one_link_ck" CHECK (("payments"."booking_id" is not null) <> ("payments"."invoice_id" is not null));--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive_ck" CHECK ("payments"."invoice_id" is null or "payments"."amount_cents" > 0);--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_currency_iso_ck" CHECK ("workspaces"."currency" ~ '^[A-Z]{3}$');


-- Canonical objects outside Drizzle's schema snapshot surface.
ALTER TABLE public.sites
  ADD CONSTRAINT sites_published_version_id_site_versions_id_fk
  FOREIGN KEY (published_version_id)
  REFERENCES public.site_versions(id)
  ON DELETE SET NULL
  ON UPDATE NO ACTION;--> statement-breakpoint

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_no_overlap_excl
  EXCLUDE USING gist (
    unit_id WITH =,
    daterange(check_in_date, check_out_date, '[)') WITH &&
  )
  WHERE (
    status NOT IN ('cancelled', 'no_show')
    AND deleted_at IS NULL
  );--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.current_workspace_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
     select tm.workspace_id
     from public.team_members tm
     join public.users u on u.id = tm.user_id and u.deleted_at is null
     join auth.users au on lower(au.email) = lower(u.email)
     where au.id = auth.uid()
       and tm.status = 'active'
       and tm.deleted_at is null
   $function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.current_comember_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
     select distinct tm.user_id
     from public.team_members tm
     where tm.workspace_id in (select public.current_workspace_ids())
       and tm.deleted_at is null
   $function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.current_conversation_ids()
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
     select c.id
     from public.ai_conversations c
     where c.workspace_id in (select public.current_workspace_ids())
       and c.deleted_at is null
   $function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_invoice_line_items_draft_only()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  inv_status text;
  inv_workspace_id uuid;
BEGIN
  SELECT status, workspace_id INTO inv_status, inv_workspace_id
    FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  IF inv_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Cannot modify line items on an invoice that is not in draft status';
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.workspace_id IS DISTINCT FROM inv_workspace_id THEN
    RAISE EXCEPTION 'Line item workspace % does not match invoice workspace %', NEW.workspace_id, inv_workspace_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_invoice_payment_integrity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  inv_workspace_id uuid;
  inv_currency text;
  inv_amount integer;
  inv_status text;
  net_charged integer;
  charge_workspace_id uuid;
  charge_invoice_id uuid;
  charge_currency text;
  charge_type text;
  charge_status text;
  charge_amount integer;
  charge_deleted_at timestamptz;
  already_refunded_against_charge integer;
BEGIN
  IF NEW.invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Idempotency short-circuit: if a row with this (workspace, key) already
  -- exists, this INSERT is a retry of an already-completed operation, not a
  -- new one. Skip straight to RETURN so Postgres's own
  -- `payments_workspace_idempotency_uq` unique index rejects the duplicate
  -- with a plain unique-violation (23505) — the error class the Phase 2
  -- service layer's catch-and-reselect logic expects (same convention as
  -- `ensureCheckoutCleaningTask`/`assertNoDuplicatePaid`). Without this
  -- early return, a legitimate retry could instead fail on a business-rule
  -- check below (e.g. "would exceed balance") if state changed since the
  -- original request — the wrong error for what is actually a successful
  -- retry, not a new conflicting operation.
  IF NEW.idempotency_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM payments
    WHERE workspace_id = NEW.workspace_id AND idempotency_key = NEW.idempotency_key
  ) THEN
    RETURN NEW;
  END IF;

  SELECT workspace_id, currency, amount_cents, status
    INTO inv_workspace_id, inv_currency, inv_amount, inv_status
    FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;

  IF inv_currency IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found', NEW.invoice_id;
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM inv_workspace_id THEN
    RAISE EXCEPTION 'Payment workspace % does not match invoice workspace %', NEW.workspace_id, inv_workspace_id;
  END IF;

  IF NEW.currency IS DISTINCT FROM inv_currency THEN
    RAISE EXCEPTION 'Payment currency % does not match invoice currency %', NEW.currency, inv_currency;
  END IF;

  IF inv_status NOT IN ('open', 'paid') THEN
    RAISE EXCEPTION 'Cannot record a payment against an invoice with status %', inv_status;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type = 'charge' THEN amount_cents ELSE -amount_cents END), 0)
    INTO net_charged
    FROM payments
    WHERE invoice_id = NEW.invoice_id AND deleted_at IS NULL AND status = 'paid';

  IF NEW.type = 'charge' THEN
    IF net_charged + NEW.amount_cents > inv_amount THEN
      RAISE EXCEPTION 'Payment of % would exceed invoice balance (already % of %)', NEW.amount_cents, net_charged, inv_amount;
    END IF;
  ELSIF NEW.type = 'refund' THEN
    -- The `payments_refund_reference_ck` CHECK constraint also rejects this,
    -- but BEFORE ROW triggers run before CHECK constraints are evaluated in
    -- Postgres, so without this explicit guard a null reference would
    -- instead surface as a confusing "not found" from the lookup below.
    IF NEW.refunded_payment_id IS NULL THEN
      RAISE EXCEPTION 'A refund must reference the charge it reverses';
    END IF;

    -- `FOR UPDATE` locks the referenced charge row for the rest of this
    -- transaction — see the H1 fix note above the function signature.
    SELECT workspace_id, invoice_id, currency, type, status, amount_cents, deleted_at
      INTO charge_workspace_id, charge_invoice_id, charge_currency, charge_type, charge_status, charge_amount, charge_deleted_at
      FROM payments WHERE id = NEW.refunded_payment_id
      FOR UPDATE;

    IF charge_type IS NULL THEN
      RAISE EXCEPTION 'Refunded payment % not found', NEW.refunded_payment_id;
    END IF;
    IF charge_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Refunded payment % has been deleted and cannot be refunded', NEW.refunded_payment_id;
    END IF;
    IF charge_type <> 'charge' THEN
      RAISE EXCEPTION 'Refunded payment % is not a charge', NEW.refunded_payment_id;
    END IF;
    IF charge_status <> 'paid' THEN
      RAISE EXCEPTION 'Refunded payment % is not paid (status %)', NEW.refunded_payment_id, charge_status;
    END IF;
    IF charge_workspace_id IS DISTINCT FROM NEW.workspace_id THEN
      RAISE EXCEPTION 'Refunded payment % belongs to a different workspace', NEW.refunded_payment_id;
    END IF;
    IF charge_invoice_id IS DISTINCT FROM NEW.invoice_id THEN
      RAISE EXCEPTION 'Refunded payment % belongs to a different invoice', NEW.refunded_payment_id;
    END IF;
    IF charge_currency IS DISTINCT FROM NEW.currency THEN
      RAISE EXCEPTION 'Refunded payment % currency % does not match refund currency %', NEW.refunded_payment_id, charge_currency, NEW.currency;
    END IF;

    SELECT COALESCE(SUM(amount_cents), 0) INTO already_refunded_against_charge
      FROM payments
      WHERE refunded_payment_id = NEW.refunded_payment_id AND type = 'refund' AND deleted_at IS NULL AND status = 'paid';

    IF NEW.amount_cents > (charge_amount - already_refunded_against_charge) THEN
      RAISE EXCEPTION 'Refund of % exceeds remaining refundable amount % on charge %', NEW.amount_cents, (charge_amount - already_refunded_against_charge), NEW.refunded_payment_id;
    END IF;

    IF NEW.amount_cents > net_charged THEN
      RAISE EXCEPTION 'Refund of % exceeds invoice-wide net refundable amount %', NEW.amount_cents, net_charged;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_invoice_reservation_consistency()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  res_workspace_id uuid;
  res_customer_id uuid;
  res_currency text;
BEGIN
  IF NEW.reservation_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT workspace_id, customer_id, currency
    INTO res_workspace_id, res_customer_id, res_currency
    FROM reservations WHERE id = NEW.reservation_id;

  IF res_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Reservation % not found', NEW.reservation_id;
  END IF;

  IF NEW.workspace_id IS DISTINCT FROM res_workspace_id THEN
    RAISE EXCEPTION 'Invoice workspace % does not match reservation workspace %', NEW.workspace_id, res_workspace_id;
  END IF;

  IF NEW.customer_id IS NOT NULL AND NEW.customer_id IS DISTINCT FROM res_customer_id THEN
    RAISE EXCEPTION 'Invoice customer % does not match reservation customer %', NEW.customer_id, res_customer_id;
  END IF;

  IF NEW.currency IS DISTINCT FROM res_currency THEN
    RAISE EXCEPTION 'Invoice currency % does not match reservation currency %', NEW.currency, res_currency;
  END IF;

  RETURN NEW;
END;
$function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_invoice_status_transitions()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  net_paid integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('void', 'written_off') THEN
      RAISE EXCEPTION 'Invoice status % is terminal and cannot change', OLD.status;
    END IF;

    IF NEW.status = 'void' THEN
      SELECT COALESCE(SUM(CASE WHEN type = 'charge' THEN amount_cents ELSE -amount_cents END), 0)
        INTO net_paid
        FROM payments
        WHERE invoice_id = NEW.id AND deleted_at IS NULL AND status = 'paid';

      IF net_paid > 0 THEN
        RAISE EXCEPTION 'Cannot void an invoice with a positive net paid balance (%) — refund it to zero first', net_paid;
      END IF;
    END IF;

    IF OLD.status = 'paid' AND NEW.status = 'written_off' THEN
      RAISE EXCEPTION 'A fully paid invoice has no balance to write off';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.enforce_payment_immutability()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  active_refund_count integer;
BEGIN
  IF NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
    OR NEW.booking_id IS DISTINCT FROM OLD.booking_id
    OR NEW.invoice_id IS DISTINCT FROM OLD.invoice_id
    OR NEW.amount_cents IS DISTINCT FROM OLD.amount_cents
    OR NEW.currency IS DISTINCT FROM OLD.currency
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.refunded_payment_id IS DISTINCT FROM OLD.refunded_payment_id
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
    OR NEW.method IS DISTINCT FROM OLD.method
    OR NEW.provider IS DISTINCT FROM OLD.provider
    OR NEW.provider_ref IS DISTINCT FROM OLD.provider_ref
    OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.actor_team_member_id IS DISTINCT FROM OLD.actor_team_member_id
  THEN
    RAISE EXCEPTION 'Invoice-linked payment rows are immutable; correct via a new ledger row (e.g. a refund) or a soft-delete, not an edit.';
  END IF;

  IF OLD.type = 'charge' AND OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    SELECT COUNT(*) INTO active_refund_count
      FROM payments
      WHERE refunded_payment_id = OLD.id AND type = 'refund' AND deleted_at IS NULL;

    IF active_refund_count > 0 THEN
      RAISE EXCEPTION 'Cannot soft-delete charge % — % active refund(s) still reference it', OLD.id, active_refund_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.sync_invoice_amount_from_line_items()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  target_invoice_id uuid;
  new_total integer;
BEGIN
  target_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount_cents), 0) INTO new_total
    FROM invoice_line_items WHERE invoice_id = target_invoice_id;

  IF new_total < 0 THEN
    RAISE EXCEPTION 'Invoice total cannot be negative (line items would total %)', new_total;
  END IF;

  UPDATE invoices
    SET amount_cents = new_total, updated_at = now()
    WHERE id = target_invoice_id AND amount_cents IS DISTINCT FROM new_total;

  RETURN NULL;
END;
$function$
;--> statement-breakpoint

CREATE TRIGGER enforce_invoice_line_items_draft_only_trg BEFORE INSERT OR DELETE OR UPDATE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION enforce_invoice_line_items_draft_only();--> statement-breakpoint
CREATE TRIGGER sync_invoice_amount_from_line_items_trg AFTER INSERT OR DELETE OR UPDATE ON invoice_line_items FOR EACH ROW EXECUTE FUNCTION sync_invoice_amount_from_line_items();--> statement-breakpoint
CREATE TRIGGER enforce_invoice_reservation_consistency_trg BEFORE INSERT OR UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION enforce_invoice_reservation_consistency();--> statement-breakpoint
CREATE TRIGGER enforce_invoice_status_transitions_trg BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION enforce_invoice_status_transitions();--> statement-breakpoint
CREATE TRIGGER enforce_invoice_payment_integrity_trg BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION enforce_invoice_payment_integrity();--> statement-breakpoint
CREATE TRIGGER enforce_payment_immutability_trg BEFORE UPDATE ON payments FOR EACH ROW WHEN (old.invoice_id IS NOT NULL) EXECUTE FUNCTION enforce_payment_immutability();--> statement-breakpoint

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.ai_conversations
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.ai_messages
  FOR ALL TO authenticated
  USING (conversation_id IN (SELECT public.current_conversation_ids()))
  WITH CHECK (conversation_id IN (SELECT public.current_conversation_ids()));--> statement-breakpoint

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.bookings
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.buildings
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.crm_activities
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.crm_opportunities
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.crm_pipelines
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.crm_stages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.crm_stages
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.customers
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.files
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.housekeeping_tasks ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.housekeeping_tasks
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.integrations
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.invoice_line_items
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.invoices
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.leads
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.notifications
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.page_sections ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.page_sections
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.pages
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.payments
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.properties
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.rental_units ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.rental_units
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.reservations
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.services
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.settings
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.site_domains ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.site_domains
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.site_versions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.site_versions
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.sites
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.team_members
  FOR ALL TO authenticated
  USING (workspace_id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.users
  FOR ALL TO authenticated
  USING (id IN (SELECT public.current_comember_ids()))
  WITH CHECK (id IN (SELECT public.current_comember_ids()));--> statement-breakpoint

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY workspace_access ON public.workspaces
  FOR ALL TO authenticated
  USING (id IN (SELECT public.current_workspace_ids()))
  WITH CHECK (id IN (SELECT public.current_workspace_ids()));--> statement-breakpoint

-- Supabase default privileges vary by platform version. Canonicalize effective
-- access explicitly instead of inheriting environment-specific defaults.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated, service_role;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated;--> statement-breakpoint

REVOKE ALL PRIVILEGES ON FUNCTION public.current_comember_ids() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.current_conversation_ids() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.current_workspace_ids() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_invoice_line_items_draft_only() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_invoice_payment_integrity() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_invoice_reservation_consistency() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_invoice_status_transitions() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_payment_immutability() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_invoice_amount_from_line_items() FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_workspace_ids() TO anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_comember_ids() TO anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.current_conversation_ids() TO anon, authenticated;
