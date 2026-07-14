-- Website Builder (Sprint 8): SEO/social metadata fields on sites and pages.
-- All columns are nullable or default-safe — no backfill needed, existing
-- published snapshots remain valid and continue rendering unchanged. Applied
-- idempotently.

ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "seo_default_title" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "seo_title_template" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "seo_default_description" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "seo_default_image_url" text;--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "seo_indexable" boolean NOT NULL DEFAULT true;--> statement-breakpoint

ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "seo_no_index" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "seo_no_follow" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "og_title" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "og_description" text;--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "og_image_url" text;
