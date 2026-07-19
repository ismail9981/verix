-- Billing & Payments (Sprint 14), Phase 1 — schema only. Wires the
-- previously-dormant `invoices`/`payments` tables to the Reservations domain:
-- adds `invoices.reservationId` + issuance audit-snapshots, an
-- `invoice_line_items` table (taxes/fees/discounts abstraction), a `type`
-- (charge|refund) discriminator + idempotency key on `payments`, and a
-- derived `reservations.paymentStatus`. Also canonicalizes every currency
-- column in the schema to uppercase ISO 4217 and backfills existing rows.
-- Applied idempotently, directly against DATABASE_URL — see 0013_housekeeping.sql's
-- note on why `drizzle-kit generate`/`push` remain unusable for this repo's
-- unjournaled migration history.
--
-- Booking-payments (`payments.bookingId` set, `invoiceId` null) are
-- deliberately untouched by every constraint/trigger below: each new
-- trigger short-circuits (or its WHEN clause excludes) any row where
-- `invoice_id is null`, so `payment.service.ts`'s existing behavior is
-- unaffected. Six trigger functions provide DB-level defense in depth ahead
-- of Phase 2's service layer: `enforce_invoice_payment_integrity` (currency/
-- workspace/status match, overpayment + refund-cap rejection, full
-- charge-reference validation), `enforce_payment_immutability` (invoice-linked
-- ledger rows can't be edited, only soft-deleted or superseded by a new row —
-- and a charge can't be soft-deleted while active refunds still reference
-- it), `enforce_invoice_line_items_draft_only` (+ workspace-spoof guard),
-- `sync_invoice_amount_from_line_items` (keeps `amountCents` from ever
-- drifting from its line items, bumps `updatedAt` to match, and rejects a
-- line-item edit that would push the total negative),
-- `enforce_invoice_reservation_consistency` (workspace/customer/currency
-- must agree with the billed reservation), and
-- `enforce_invoice_status_transitions` (void/written_off are terminal; a
-- transition to `void` is rejected whenever net paid > 0; a fully paid
-- invoice cannot become `written_off`).
--
-- Fix pass (independent review of this migration): every CHECK constraint
-- now uses `DROP CONSTRAINT IF EXISTS` + an unconditional `ADD CONSTRAINT`
-- instead of swallowing `duplicate_object` — the review proved the old
-- pattern left a stale definition in place when a constraint's body was
-- revised under an unchanged name (confirmed live on
-- `payments_refund_reference_ck`). Also added: `invoices_amount_non_negative_ck`.
--
-- Second fix pass (H1, concurrency): a charge's soft-delete guard and a
-- refund's charge-reference lookup now lock the SAME charge row (`FOR
-- UPDATE`), so a concurrent soft-delete-vs-refund-insert race on the same
-- charge always serializes to exactly one winner — proven with two real
-- concurrent database connections in both orderings, see the fix note on
-- `enforce_invoice_payment_integrity` below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- `written_off` joins the existing draft|open|paid|void invoice lifecycle.
-- Safe to run alongside the rest of this migration (PostgreSQL 12+ allows
-- ALTER TYPE ... ADD VALUE inside a transaction as long as the new value
-- isn't *used* — inserted/defaulted to — within that same transaction, which
-- nothing below does).
ALTER TYPE "invoice_status" ADD VALUE IF NOT EXISTS 'written_off';--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "invoice_line_item_type" AS ENUM ('stay', 'fee', 'tax', 'discount');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "payment_type" AS ENUM ('charge', 'refund');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "reservation_payment_status" AS ENUM ('unpaid', 'partially_paid', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Currency canonicalization: ISO 4217, uppercase, everywhere. Backfill existing
-- lowercase values BEFORE adding the format constraint below, so no live row
-- is ever left violating it. `invoices`/`payments` already default to
-- uppercase, but are backfilled too for safety/consistency.
-- ---------------------------------------------------------------------------

UPDATE "workspaces" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint
UPDATE "crm_opportunities" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint
UPDATE "rental_units" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint
UPDATE "reservations" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint
UPDATE "invoices" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint
UPDATE "payments" SET currency = upper(currency) WHERE currency <> upper(currency);--> statement-breakpoint

ALTER TABLE "workspaces" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "crm_opportunities" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "rental_units" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "currency" SET DEFAULT 'USD';--> statement-breakpoint

-- Fix (independent review, A2): CHECK constraints are no longer made
-- idempotent by swallowing `duplicate_object` — that pattern leaves a
-- STALE definition in place if the CHECK body is ever revised under the
-- same name (a duplicate-name ADD CONSTRAINT raises before Postgres ever
-- looks at whether the body changed). `DROP CONSTRAINT IF EXISTS` + an
-- unconditional `ADD CONSTRAINT` guarantees reapplying this file always
-- installs exactly the definition below, matching how `CREATE OR REPLACE
-- FUNCTION` already behaves for the trigger functions further down.
ALTER TABLE "workspaces" DROP CONSTRAINT IF EXISTS "workspaces_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

ALTER TABLE "crm_opportunities" DROP CONSTRAINT IF EXISTS "crm_opportunities_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

ALTER TABLE "rental_units" DROP CONSTRAINT IF EXISTS "rental_units_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "reservations_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_currency_iso_ck";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_iso_ck" CHECK (currency ~ '^[A-Z]{3}$');--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- `invoices`: reservation linkage, issuance audit-snapshots, void/write-off trail.
-- ---------------------------------------------------------------------------

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "reservation_id" uuid REFERENCES "reservations"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "customer_email_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "property_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "building_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "unit_name_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "check_in_date_snapshot" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "check_out_date_snapshot" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "voided_at" timestamptz;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "voided_by" uuid REFERENCES "team_members"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "written_off_at" timestamptz;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "written_off_by" uuid REFERENCES "team_members"("id") ON DELETE set null;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "notes" text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "invoices_reservation_idx" ON "invoices" ("reservation_id");--> statement-breakpoint

-- At most one active (non-void) invoice per reservation — the DB-level
-- guarantee behind `ensureInvoiceForReservation`'s idempotent select ->
-- insert-with-onConflictDoNothing -> reselect upsert (Phase 2). Voiding an
-- invoice frees the slot for a corrected replacement; `written_off` still
-- counts as active (it billed a real stay, just one the business gave up
-- collecting on) and must not allow a duplicate invoice to be created.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_reservation_active_uq" ON "invoices" ("reservation_id")
  WHERE (reservation_id is not null and status <> 'void');--> statement-breakpoint

-- Internal consistency of the lifecycle/audit columns themselves (a single
-- row's own values, not a cross-row/history check — that's the
-- `enforce_invoice_status_transitions` trigger further down). Only the
-- *timestamp* half of each audit pair (voided_at/written_off_at) is
-- hard-required — the "_by" actor columns are `ON DELETE SET NULL` FKs to
-- team_members, so requiring them NOT NULL here would create a constraint a
-- later (even if currently only theoretical, since team members are
-- soft-deleted in practice) removal of that team member could violate.
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_issued_at_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_issued_at_ck" CHECK (status = 'draft' or issued_at is not null);--> statement-breakpoint

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_void_audit_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_void_audit_ck" CHECK (status <> 'void' or voided_at is not null);--> statement-breakpoint

ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_written_off_audit_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_written_off_audit_ck" CHECK (status <> 'written_off' or written_off_at is not null);--> statement-breakpoint

-- An invoice can only ever have been closed one way — void XOR written-off,
-- never both (would otherwise be possible if a bug set both audit pairs).
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_audit_exclusive_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_audit_exclusive_ck" CHECK (not (voided_at is not null and written_off_at is not null));--> statement-breakpoint

-- Fix (independent review, B4): the invoice total is server-computed from
-- line items and must never go negative (an oversized discount could
-- otherwise push it below zero — nothing else in the schema models a
-- credit/wallet concept). This is the defense-in-depth backstop; the
-- primary rejection point is `sync_invoice_amount_from_line_items`, which
-- rejects the line-item mutation itself before this constraint would ever
-- see a negative value.
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_amount_non_negative_ck";--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_non_negative_ck" CHECK (amount_cents >= 0);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- `invoice_line_items`: taxes/fees/discounts abstraction. Denormalizes
-- workspace_id from the parent invoice purely so RLS can filter directly,
-- matching `housekeeping_tasks`' precedent.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "invoice_line_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "type" "invoice_line_item_type" NOT NULL,
  "description" text NOT NULL,
  "quantity" integer NOT NULL DEFAULT 1,
  "unit_amount_cents" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "invoice_line_items_workspace_idx" ON "invoice_line_items" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_line_items_invoice_idx" ON "invoice_line_items" ("invoice_id");--> statement-breakpoint

ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_quantity_positive_ck";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_quantity_positive_ck" CHECK (quantity > 0);--> statement-breakpoint

ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_sort_order_ck";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_sort_order_ck" CHECK (sort_order >= 0);--> statement-breakpoint

-- Sign rule: a discount reduces the total (negative), everything else adds
-- to it (positive) — enforced here, not left to service-layer discipline,
-- since a sign-flip bug here is a direct financial-total bug.
ALTER TABLE "invoice_line_items" DROP CONSTRAINT IF EXISTS "invoice_line_items_amount_sign_ck";--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_amount_sign_ck"
  CHECK ((type = 'discount' and amount_cents < 0) or (type <> 'discount' and amount_cents > 0));--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- `payments`: ledger direction, refund traceability, idempotency key.
-- ---------------------------------------------------------------------------

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "type" "payment_type" NOT NULL DEFAULT 'charge';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_payment_id" uuid REFERENCES "payments"("id") ON DELETE restrict;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "idempotency_key" text;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "payments_type_idx" ON "payments" ("type");--> statement-breakpoint

-- Idempotent retry guarantee for payment/refund mutations (Phase 2): repeating
-- the same (workspace, key) pair is a unique-violation, not a second ledger row.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_workspace_idempotency_uq" ON "payments" ("workspace_id", "idempotency_key")
  WHERE (idempotency_key is not null);--> statement-breakpoint

-- Full biconditional: a row references an original charge if and only if
-- it's a refund (a charge row must never carry a refund reference, and a
-- refund row must always name what it's refunding).
--
-- Fix (independent review, A2): this exact constraint is the one the review
-- proved was silently left stale on the live database — it was revised from
-- a one-directional check to this biconditional under the same name, and
-- the old `duplicate_object`-swallowing pattern kept the OLD, weaker
-- definition active. DROP + unconditional ADD (below) guarantees this
-- reapplication actually installs the current text.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_refund_reference_ck";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_reference_ck"
  CHECK ((type = 'refund') = (refunded_payment_id is not null));--> statement-breakpoint

-- Every payment row is either a booking-payment or an invoice-payment —
-- never both, never neither. Verified against live data before adding this:
-- 0 existing rows violate it.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_exactly_one_link_ck";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_exactly_one_link_ck"
  CHECK ((booking_id is not null) <> (invoice_id is not null));--> statement-breakpoint

-- Invoice-linked amounts must be strictly positive (a $0 "payment" is not a
-- real ledger entry). Booking-payments keep their existing, unrelated
-- app-level `min(0)` allowance untouched — this constraint only applies
-- when invoice_id is set.
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_amount_positive_ck";--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive_ck"
  CHECK (invoice_id is null or amount_cents > 0);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- `reservations`: derived payment-status summary.
-- ---------------------------------------------------------------------------

ALTER TABLE "reservations" ADD COLUMN IF NOT EXISTS "payment_status" "reservation_payment_status" NOT NULL DEFAULT 'unpaid';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reservations_payment_status_idx" ON "reservations" ("payment_status");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Triggers: DB-level backstops in addition to the Phase 2 service-layer
-- checks (defense in depth), scoped so booking-payments (invoice_id is null)
-- are never affected.
-- ---------------------------------------------------------------------------

-- 1. Every invoice-linked payment/refund must belong to the same workspace
--    as its invoice, be in the invoice's own currency, and only land on an
--    invoice that's actually open to collect against (`open` or `paid` — not
--    `draft`, `void`, or `written_off`). A charge must not push net charges
--    past the invoice total (reject overpayment). A refund must reference a
--    specific prior charge, and that charge must exist, be a `charge` (not
--    another refund), be `paid`, not be soft-deleted, and share the same
--    workspace/invoice/currency as the refund itself — the refund amount is
--    then capped by BOTH that specific charge's remaining refundable amount
--    and the invoice-wide net-refundable amount (belt and suspenders).
--    `SELECT ... FOR UPDATE` on the invoice row is what makes the balance
--    checks safe under concurrency: two simultaneous inserts for the same
--    invoice serialize on this lock rather than both reading a stale balance
--    and both succeeding.
--
--    Fix (independent re-review, H1): the referenced charge lookup also
--    takes `FOR UPDATE`, so it serializes against `enforce_payment_immutability`'s
--    soft-delete guard on that exact charge row — that guard's own `UPDATE`
--    already holds the row lock for the whole duration of its transaction, so
--    this lock is what was missing on the refund-insert side. Whichever
--    transaction (a concurrent soft-delete of the charge, or this refund
--    insert) reaches the row first now makes the other wait, then re-read
--    post-commit state, rather than both proceeding from a stale read:
--      - soft-delete commits first -> this SELECT then sees `deleted_at`
--        set and is rejected by the new check below.
--      - this refund insert commits first -> the soft-delete's own COUNT of
--        active refunds (run after it acquires the same row lock) then sees
--        this new row and rejects the soft-delete.
--    Exactly one side succeeds in either ordering; no invalid final state
--    (a soft-deleted charge with a live refund still referencing it) is
--    reachable under concurrency.
CREATE OR REPLACE FUNCTION enforce_invoice_payment_integrity() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_invoice_payment_integrity_trg ON "payments";--> statement-breakpoint
CREATE TRIGGER enforce_invoice_payment_integrity_trg
  BEFORE INSERT ON "payments"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_payment_integrity();--> statement-breakpoint

-- 2. Invoice-linked payment/refund rows are immutable ledger entries once
--    inserted — correct a mistake with a new row (e.g. a refund) or a
--    soft-delete, never an edit of the financial facts. Booking-payments
--    (invoice_id is null) are completely unaffected and keep editing
--    amount/status/etc. exactly as `payment.service.ts` does today.
--
--    `deletedAt` (and `updatedAt`/`notes`) are deliberately NOT in the locked
--    field list — soft-delete is this table's own documented correction
--    mechanism ("Supports soft delete so mistaken entries can be corrected
--    without losing the row") and the one sanctioned way to void a
--    mis-entered ledger row without a hard delete. Locking every column
--    would remove that mechanism entirely, not make the ledger more correct.
--
--    Every invoice-linked row is inserted already `status = 'paid'` (staff-
--    recorded, no gateway exists yet to need a pending -> paid/failed
--    transition) — so blocking ALL status mutation here is the correct,
--    conservative choice for Phase 1, not an oversight. If/when a real
--    payment-gateway integration lands, this trigger will need a narrow,
--    forward-only pending -> paid|failed carve-out added at that time.
--
--    Fix (independent review, B1): a `charge` may not be soft-deleted while
--    it still has active (non-deleted, paid) `refund` rows referencing it —
--    doing so would drop the charge out of every `deleted_at IS NULL`
--    balance sum while its dependent refunds remained, corrupting
--    `net_charged` into a negative, nonsensical value. Soft-deleting a
--    `refund` row is unaffected by this guard and remains safe in isolation
--    (it simply un-does that refund's effect on the balance).
--
--    This `UPDATE` (the one firing this trigger) already holds Postgres's
--    row lock on the charge for the rest of this transaction — that part
--    was never the gap. The gap (fixed alongside, H1) was that a concurrent
--    refund INSERT never tried to acquire that same lock, so it could read
--    a stale "not yet deleted" snapshot and commit anyway; see the `FOR
--    UPDATE` added to `enforce_invoice_payment_integrity`'s charge lookup.
CREATE OR REPLACE FUNCTION enforce_payment_immutability() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_payment_immutability_trg ON "payments";--> statement-breakpoint
CREATE TRIGGER enforce_payment_immutability_trg
  BEFORE UPDATE ON "payments"
  FOR EACH ROW
  WHEN (OLD.invoice_id IS NOT NULL)
  EXECUTE FUNCTION enforce_payment_immutability();--> statement-breakpoint

-- 3. Invoice line items may only be added/edited/removed while their parent
--    invoice is still `draft` — once issued, invoice history must remain
--    auditable at the database level, not just by service-layer convention.
--    Also guards against `workspace_id` being spoofed independently of the
--    parent invoice's own workspace (the plain FK alone can't catch that —
--    it only guarantees the invoice exists, not that the workspace matches).
CREATE OR REPLACE FUNCTION enforce_invoice_line_items_draft_only() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_invoice_line_items_draft_only_trg ON "invoice_line_items";--> statement-breakpoint
CREATE TRIGGER enforce_invoice_line_items_draft_only_trg
  BEFORE INSERT OR UPDATE OR DELETE ON "invoice_line_items"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_line_items_draft_only();--> statement-breakpoint

-- 4. Keep `invoices.amountCents` synchronized with the sum of its line items
--    at all times, so the stored total can never drift from what the line
--    items actually add up to. Fires AFTER the draft-only guard above, so it
--    only ever runs for mutations that guard already allowed (i.e. only
--    while the invoice is still `draft`) — once issued, no line item change
--    can occur, so `amountCents` is equally frozen from that point on.
--
--    Fix (independent review, B3): explicitly bumps `updated_at`. Drizzle's
--    `$onUpdate(() => new Date())` is a client-side ORM behavior — it never
--    fires for this trigger's own raw SQL `UPDATE`, so without this the
--    invoice's `updated_at` would silently understate its true last-modified
--    time every time a line item changes its total.
--
--    Fix (independent review, B4): rejects the triggering line-item
--    mutation outright if the recomputed total would go negative (e.g. a
--    discount exceeding the sum of positive charges), rather than letting
--    `invoices_amount_non_negative_ck` catch it after the fact — this is
--    the primary rejection point; the CHECK constraint is the backstop.
CREATE OR REPLACE FUNCTION sync_invoice_amount_from_line_items() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS sync_invoice_amount_from_line_items_trg ON "invoice_line_items";--> statement-breakpoint
CREATE TRIGGER sync_invoice_amount_from_line_items_trg
  AFTER INSERT OR UPDATE OR DELETE ON "invoice_line_items"
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_amount_from_line_items();--> statement-breakpoint

-- 5. When an invoice bills a reservation, the invoice must actually belong
--    to that reservation's tenant, and (if set) its customer and currency
--    must agree with the reservation's — a plain FK on `reservation_id`
--    alone can't catch a workspace/customer/currency mismatch, only that the
--    referenced reservation exists.
CREATE OR REPLACE FUNCTION enforce_invoice_reservation_consistency() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_invoice_reservation_consistency_trg ON "invoices";--> statement-breakpoint
CREATE TRIGGER enforce_invoice_reservation_consistency_trg
  BEFORE INSERT OR UPDATE ON "invoices"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_reservation_consistency();--> statement-breakpoint

-- 6. A narrow, targeted transition guard — NOT the full draft/open/paid/void/
--    written_off state machine (that's Phase 2's `isValidInvoiceStatusTransition`
--    pure function, service-enforced). Enforces three hard invariants that
--    must never be violated even by a Phase-2 bug:
--
--    Fix (independent review, A1): a transition TO `void` is rejected
--    whenever the invoice has a positive net paid balance (sum of active
--    paid charges minus active paid refunds > 0) — chosen as the single,
--    general rule over the narrower "paid -> void" special case this
--    replaces, since a partially-paid `open` invoice was exploitable the
--    same way and is now covered too. Refund the balance to zero first,
--    then void.
--
--    Fix (independent review, B2): `paid -> written_off` is rejected — a
--    fully-settled invoice has no outstanding balance to write off; that
--    would only make sense on an `open` invoice with money still owed.
--
--    Unchanged: the two terminal states (`void`, `written_off`) never
--    transition to anything else once reached.
CREATE OR REPLACE FUNCTION enforce_invoice_status_transitions() RETURNS trigger AS $$
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
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS enforce_invoice_status_transitions_trg ON "invoices";--> statement-breakpoint
CREATE TRIGGER enforce_invoice_status_transitions_trg
  BEFORE UPDATE ON "invoices"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_status_transitions();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- RLS: only `invoice_line_items` is a genuinely new table. `invoices`,
-- `payments`, and `reservations` already have working `workspace_access`
-- policies from earlier migrations — adding columns doesn't require touching
-- them. RLS provides tenant isolation only; RBAC (who may issue/void/pay/
-- refund) is enforced in the Phase 2 service layer, not here.
-- ---------------------------------------------------------------------------

ALTER TABLE "invoice_line_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "invoice_line_items" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS workspace_access ON "invoice_line_items";--> statement-breakpoint
CREATE POLICY workspace_access ON "invoice_line_items" FOR ALL TO authenticated USING (workspace_id in (select public.current_workspace_ids())) WITH CHECK (workspace_id in (select public.current_workspace_ids()));
