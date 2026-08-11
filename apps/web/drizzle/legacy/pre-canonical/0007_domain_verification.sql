-- Website Builder (Sprint 7.2): DNS verification + SSL-readiness bookkeeping.
-- Extends site_domains with verification/SSL columns. No routing, no cert
-- provider integration — SSL status is stored only. Applied idempotently.

DO $$ BEGIN
  CREATE TYPE "domain_verification_method" AS ENUM ('txt', 'cname');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "ssl_status" AS ENUM ('not_requested', 'pending', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "verification_token" text;--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "verification_method" "domain_verification_method";--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "verification_error" text;--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "verification_attempted_at" timestamptz;--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "verified_at" timestamptz;--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "ssl_status" "ssl_status" NOT NULL DEFAULT 'not_requested';--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "ssl_error" text;--> statement-breakpoint
ALTER TABLE "site_domains" ADD COLUMN IF NOT EXISTS "ssl_issued_at" timestamptz;--> statement-breakpoint

-- Tokens must be unique when set; most rows (subdomains) have none.
CREATE UNIQUE INDEX IF NOT EXISTS "site_domains_verification_token_uq" ON "site_domains" ("verification_token") WHERE verification_token is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "site_domains_status_idx" ON "site_domains" ("status");--> statement-breakpoint

-- Safe defaults for any pre-existing rows: subdomains stay untouched (no
-- verification columns apply to them); any pre-7.2 custom domain rows are
-- reset to 'pending' with no token so the app generates one deterministically
-- on next read rather than this migration guessing at a token format.
UPDATE "site_domains"
  SET "status" = 'pending', "verification_token" = null, "verification_method" = null
  WHERE "type" = 'custom' AND "status" IN ('verified', 'active') AND "verified_at" IS NULL;
