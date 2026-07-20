-- Billing & Payments (Sprint 14), Phase 2A — schema touch-up only. Adds an
-- actor column to `payments` so invoice-linked payment/refund rows can
-- record who performed them (Phase 1's `invoices` already has this for
-- void/write-off via `voidedBy`/`writtenOffBy`; `payments` had no equivalent
-- at all). Applied idempotently, directly against DATABASE_URL — see
-- 0013_housekeeping.sql's note on why `drizzle-kit generate`/`push` remain
-- unusable for this repo's unjournaled migration history.
--
-- Booking-payments (`payments.bookingId` set, `invoiceId` null) are
-- unaffected: this column is nullable, never populated by
-- `payment.service.ts`, and no existing constraint/trigger references it.

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "actor_team_member_id" uuid REFERENCES "team_members"("id") ON DELETE set null;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payments_actor_team_member_idx" ON "payments" ("actor_team_member_id");
