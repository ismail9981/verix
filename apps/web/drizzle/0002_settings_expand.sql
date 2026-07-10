-- Expand the settings table for the Settings module.
-- Applied idempotently (settings table is empty pre-feature).

ALTER TABLE "settings" DROP COLUMN IF EXISTS "compact_mode";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN IF EXISTS "push_notifications";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN IF EXISTS "booking_alerts";--> statement-breakpoint
ALTER TABLE "settings" DROP COLUMN IF EXISTS "weekly_reports";--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "primary_color" text NOT NULL DEFAULT '#6D5EF9';--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "accent_color" SET DEFAULT '#8B5CF6';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "booking_notifications" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "payment_notifications" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "marketing_emails" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "session_timeout_minutes" integer NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "login_alerts" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "date_format" text NOT NULL DEFAULT 'MM/DD/YYYY';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "time_format" text NOT NULL DEFAULT '12h';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "week_starts_on" text NOT NULL DEFAULT 'sunday';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_booking_duration_minutes" integer NOT NULL DEFAULT 30;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tax_enabled" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "tax_percent_bps" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_booking_status" "booking_status" NOT NULL DEFAULT 'confirmed';--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "default_payment_method" "payment_method" NOT NULL DEFAULT 'card';
