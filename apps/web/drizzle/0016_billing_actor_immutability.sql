-- Billing & Payments (Sprint 14), Phase 2A follow-up — fixes the independent
-- review's Medium finding M1: `payments.actor_team_member_id` (added in
-- 0015_billing_actor_attribution.sql) was not covered by
-- `enforce_payment_immutability`'s locked-field list, so an invoice-linked
-- payment/refund row's actor attribution could be silently changed after
-- insert — unlike every other financial-identity field on that row.
--
-- Smallest possible fix: `CREATE OR REPLACE FUNCTION` redefines the existing
-- trigger function's body in place. No new column, table, or trigger is
-- needed — the trigger (`enforce_payment_immutability_trg`, unchanged) picks
-- up the new body automatically by name, exactly like every other trigger
-- revision in this migration set. Every other Phase 1 guarantee this
-- function enforces (the immutable-field list, the soft-delete-with-active-
-- refunds guard) is reproduced verbatim below — only the one new `OR`
-- clause is added.

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
$$ LANGUAGE plpgsql;
