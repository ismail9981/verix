import { z } from "zod";
import { PAYMENT_METHODS, type PaymentMethodValue } from "./payment";
import { workspaceTodayDate } from "./reservation";
import { cleanOptional, hasAtMostCentsPrecision } from "./shared";

/*
 * Validation + pure decision logic for the Billing feature (Sprint 14 Phase
 * 2A): invoices billed against a reservation, their line items, and the
 * payment/refund ledger recorded against them. Dependency-free (no db/env
 * imports) so every invariant here is unit-testable — mirrors the split
 * `reservation.ts`/`housekeeping.ts` already established between pure
 * decisions and their `*.service.ts` DB access.
 *
 * This file validates input *shape* only. Every business invariant already
 * enforced at the database level (overpayment rejection, refund caps,
 * immutability, currency/tenant consistency, lifecycle terminality — see
 * `apps/web/drizzle/0014_billing.sql` and `0015_billing_actor_attribution.sql`)
 * is deliberately NOT re-validated here; the pure functions below exist so
 * the service layer (Phase 2B+) has a client-independent pre-check for a
 * friendly error message, not as a second source of truth.
 */

// ---------------------------------------------------------------------------
// Invoice lifecycle
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = [
  "draft",
  "open",
  "paid",
  "void",
  "written_off",
] as const;
export type InvoiceStatusValue = (typeof INVOICE_STATUSES)[number];

/**
 * The invoice state machine. `draft`/`open` transitions to `void`/`written_off`
 * are explicit, actor-initiated (`issueInvoice`/`voidInvoice`/`writeOffInvoice`
 * — Phase 2B). `open -> paid` and `paid -> open` are never directly
 * actor-settable — they're the automatic result of `syncInvoiceStatus`
 * recomputing net paid vs. total after a payment/refund lands (Phase 2B).
 * `void`/`written_off` are terminal (mirrors `enforce_invoice_status_transitions`'s
 * DB-level backstop). `paid -> void` and `draft -> written_off`/`paid -> written_off`
 * are deliberately absent — the latter two are this project's decided rule
 * that write-off only ever applies to an `open` invoice with money still owed.
 */
const INVOICE_TRANSITIONS: Record<
  InvoiceStatusValue,
  readonly InvoiceStatusValue[]
> = {
  draft: ["open", "void"],
  open: ["paid", "void", "written_off"],
  paid: ["open"],
  void: [],
  written_off: [],
};

export function isValidInvoiceStatusTransition(
  from: InvoiceStatusValue,
  to: InvoiceStatusValue,
): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

export function getValidInvoiceTransitionsFrom(
  from: InvoiceStatusValue,
): readonly InvoiceStatusValue[] {
  return INVOICE_TRANSITIONS[from];
}

/**
 * Derives whether an invoice should read as `open` or `paid` from its net
 * paid balance — the automatic half of the state machine above. Only ever
 * meaningful when `currentStatus` is NOT terminal (`void`/`written_off`);
 * the service layer must leave those untouched rather than calling this.
 * Mirrors `enforce_invoice_payment_integrity`'s balance arithmetic: the
 * service computes `netPaidCents` from the same `type='charge' minus
 * type='refund', deleted_at is null, status='paid'` sum, this function only
 * makes the open/paid decision from that already-computed number.
 */
export function deriveInvoiceStatus(
  amountCents: number,
  netPaidCents: number,
): "open" | "paid" {
  return netPaidCents >= amountCents ? "paid" : "open";
}

/**
 * The invoice's remaining balance — never negative, even though `netPaidCents`
 * algebraically shouldn't exceed `amountCents` (the overpayment trigger
 * rejects that at the source). Clamped defensively so a display value is
 * never a confusing negative number if that invariant were ever violated.
 */
export function computeOutstandingCents(
  amountCents: number,
  netPaidCents: number,
): number {
  return Math.max(amountCents - netPaidCents, 0);
}

// ---------------------------------------------------------------------------
// Reservation payment-status summary
// ---------------------------------------------------------------------------

export const RESERVATION_PAYMENT_STATUSES = [
  "unpaid",
  "partially_paid",
  "paid",
] as const;
export type ReservationPaymentStatusValue =
  (typeof RESERVATION_PAYMENT_STATUSES)[number];

/**
 * The one formula behind `reservations.paymentStatus` — a coarse,
 * staff-facing summary, not a full ledger state machine. Applied uniformly
 * regardless of the underlying invoice's own status: a `void` invoice always
 * has net paid <= 0 (DB-enforced), so it always resolves to `unpaid`; a
 * `written_off` invoice can never reach `paid` (DB blocks `paid ->
 * written_off`), so it resolves to `unpaid`/`partially_paid` based on
 * whatever was actually collected before write-off. "Refunded" and
 * "partially refunded" have no distinct bucket here by design — a fully
 * refunded invoice (net paid back to 0) reads identically to "never paid",
 * and a partially refunded one reads identically to "partially paid toward
 * the total"; the payment ledger itself (not this summary field) is what
 * preserves that a refund occurred.
 */
export function deriveReservationPaymentStatus(
  amountCents: number,
  netPaidCents: number,
): ReservationPaymentStatusValue {
  if (netPaidCents <= 0) return "unpaid";
  if (netPaidCents >= amountCents) return "paid";
  return "partially_paid";
}

// ---------------------------------------------------------------------------
// Invoice line items
// ---------------------------------------------------------------------------

export const INVOICE_LINE_ITEM_TYPES = [
  "stay",
  "fee",
  "tax",
  "discount",
] as const;
export type InvoiceLineItemType = (typeof INVOICE_LINE_ITEM_TYPES)[number];

/**
 * Mirrors `invoice_line_items_amount_sign_ck` exactly: a `discount` line's
 * final (signed) `amountCents` must be negative; every other type's must be
 * positive. Operates on the computed, signed total — not the user-entered
 * (always-positive) `unitAmount` — so the service layer calls this only
 * after applying the type-based sign, as a fast pre-check before the DB
 * constraint would otherwise reject the insert.
 */
export function isValidLineItemAmountSign(
  type: InvoiceLineItemType,
  amountCents: number,
): boolean {
  return type === "discount" ? amountCents < 0 : amountCents > 0;
}

/**
 * `unitAmount` (dollars, always entered positive regardless of `type`) ->
 * the signed, authoritative `amountCents` the service inserts — negative for
 * `discount`, positive otherwise. Pure so the exact cents/sign/quantity
 * arithmetic is unit-tested independently of the service's DB access.
 */
export function computeLineItemAmountCents(
  type: InvoiceLineItemType,
  quantity: number,
  unitAmount: number,
): number {
  const magnitude = Math.round(unitAmount * 100) * quantity;
  return type === "discount" ? -magnitude : magnitude;
}

const DESCRIPTION_MAX = 200;

/** Postgres `integer` (int4) upper bound — `invoiceLineItems.amountCents`/`unitAmountCents` are stored as `integer`, not `bigint`. */
export const POSTGRES_INT4_MAX = 2_147_483_647;

/**
 * `unitAmount` arrives in the major unit (dollars) and is always entered as
 * a positive number regardless of `type` — a $50 discount is entered as
 * `50`, not `-50`. The service (Phase 2B) applies the type-based sign when
 * computing the stored, authoritative `amountCents` (see
 * `isValidLineItemAmountSign`). There is deliberately no `currency` field —
 * a line item is always denominated in its parent invoice's currency.
 *
 * `quantity` deliberately has no standalone upper bound — `unitAmount` alone
 * already maxes out well under the int4 range, so an arbitrary quantity cap
 * would reject some valid combinations while missing others. Instead the
 * cross-field check below validates the actual computed magnitude
 * (`quantity * unitAmountCents`, mirroring `computeLineItemAmountCents`)
 * against Postgres's `integer` ceiling directly.
 */
export const lineItemInputSchema = z
  .object({
    type: z.enum(INVOICE_LINE_ITEM_TYPES),
    description: z.string().trim().min(1, "Description is required").max(DESCRIPTION_MAX),
    quantity: z.coerce.number().int().min(1, "Must be at least 1"),
    unitAmount: z.coerce
      .number()
      .min(0.01, "Must be greater than zero")
      .max(1_000_000, "Too large")
      .refine(hasAtMostCentsPrecision, "Amount can't have more than 2 decimal places"),
  })
  .superRefine((data, ctx) => {
    const absoluteAmountCents = Math.round(data.unitAmount * 100) * data.quantity;
    if (absoluteAmountCents > POSTGRES_INT4_MAX) {
      ctx.addIssue({
        code: "custom",
        path: ["quantity"],
        message: `Quantity × amount can't exceed ${POSTGRES_INT4_MAX.toLocaleString("en-US")} cents.`,
      });
    }
  });

export type LineItemInput = z.infer<typeof lineItemInputSchema>;

// ---------------------------------------------------------------------------
// Invoice numbering (Phase 2B)
// ---------------------------------------------------------------------------

/**
 * The calendar year an invoice number's `INV-{year}-` prefix should use —
 * the workspace's own local date, never the server process's local time
 * (which could disagree with the workspace across a year boundary). Mirrors
 * `workspaceTodayDate`'s own timezone handling exactly; only the year
 * component is extracted since that's all the numbering scheme uses.
 */
export function workspaceInvoiceYear(timezone: string, now: Date = new Date()): number {
  return Number(workspaceTodayDate(timezone, now).slice(0, 4));
}

export function invoiceNumberPrefix(year: number): string {
  return `INV-${year}-`;
}

/**
 * The next numeric suffix for a workspace/year's invoice number series —
 * `max(existing suffix) + 1`, not `count(*) + 1`. A count-based approach
 * silently reuses a number whenever the row count doesn't equal the highest
 * suffix ever issued (an imported/backfilled number out of sequence, a
 * historical gap) — max-based never does, since it only ever grows. Ignores
 * any `number` that doesn't match `{prefix}{digits}` (e.g. a manually
 * imported number in a different format) rather than letting it corrupt the
 * computed suffix.
 */
export function nextInvoiceSuffix(existingNumbers: readonly string[], prefix: string): number {
  let maxSuffix = 0;
  for (const number of existingNumbers) {
    if (!number.startsWith(prefix)) continue;
    const suffixText = number.slice(prefix.length);
    if (!/^\d+$/.test(suffixText)) continue;
    const suffix = Number(suffixText);
    if (Number.isSafeInteger(suffix) && suffix > maxSuffix) maxSuffix = suffix;
  }
  return maxSuffix + 1;
}

export function formatInvoiceNumber(year: number, suffix: number): string {
  return `${invoiceNumberPrefix(year)}${String(suffix).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Access scope (Phase 2B)
// ---------------------------------------------------------------------------

/**
 * Mirrors `resolveReservationScope` exactly: an invoice's visibility follows
 * its billed reservation's `staffId` (owners/managers see everything, an
 * employee only invoices for reservations staffed to them, an employee with
 * no resolved team-member row sees none). Pure so the same decision backs
 * both the `listInvoices` scope filter and a single-record RBAC check.
 */
export type InvoiceScope =
  | { kind: "all" }
  | { kind: "assigned"; teamMemberId: string }
  | { kind: "none" };

export function resolveInvoiceScope(
  role: string,
  actorTeamMemberId: string | null,
): InvoiceScope {
  if (role === "owner" || role === "manager") return { kind: "all" };
  if (!actorTeamMemberId) return { kind: "none" };
  return { kind: "assigned", teamMemberId: actorTeamMemberId };
}

// ---------------------------------------------------------------------------
// DTOs (Phase 2B)
// ---------------------------------------------------------------------------

/** Lean DTO for list views — no line items, no snapshot fields. */
export interface InvoiceListItem {
  id: string;
  workspaceId: string;
  reservationId: string | null;
  customerId: string | null;
  customerName: string | null;
  number: string;
  status: InvoiceStatusValue;
  amountCents: number;
  currency: string;
  issuedAt: Date | null;
  dueAt: Date | null;
  createdAt: Date;
}

export interface InvoiceLineItemDto {
  id: string;
  type: InvoiceLineItemType;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  sortOrder: number;
}

/** Full detail DTO — adds the issuance snapshots, notes, and line items. */
export interface InvoiceDetail extends InvoiceListItem {
  customerNameSnapshot: string | null;
  customerEmailSnapshot: string | null;
  propertyNameSnapshot: string | null;
  buildingNameSnapshot: string | null;
  unitNameSnapshot: string | null;
  checkInDateSnapshot: string | null;
  checkOutDateSnapshot: string | null;
  notes: string | null;
  lineItems: InvoiceLineItemDto[];
  /** Sum of active (`type='charge'` minus `type='refund'`, not soft-deleted, `status='paid'`) payments — see `getInvoiceNetPaidCents` (Sprint 15), the single source of truth this is always computed from. */
  netPaidCents: number;
  outstandingCents: number;
}

// ---------------------------------------------------------------------------
// Invoice lifecycle actions
// ---------------------------------------------------------------------------

/**
 * `dueAt` is the only meaningful input at issuance — `invoices.dueAt` exists
 * on the schema already but nothing sets it yet. Everything else issuance
 * touches (status, `issuedAt`, the customer/property/unit/date snapshots) is
 * server-derived, never client input.
 */
export const issueInvoiceInputSchema = z.object({
  dueAt: z.preprocess(cleanOptional, z.iso.date().optional()),
});

export type IssueInvoiceInput = z.infer<typeof issueInvoiceInputSchema>;

/**
 * `dueAt` (a plain calendar date, no time component) must not fall before the
 * workspace-local date the invoice is actually being issued on — comparing
 * two `YYYY-MM-DD` strings lexicographically is equivalent to comparing them
 * chronologically. Pure so the rule is unit-testable without a workspace row.
 */
export function isDueDateOnOrAfterIssuance(dueDate: string, issuanceDate: string): boolean {
  return dueDate >= issuanceDate;
}

const REASON_MAX = 1000;

export const voidInvoiceInputSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(REASON_MAX),
});

export type VoidInvoiceInput = z.infer<typeof voidInvoiceInputSchema>;

export const writeOffInvoiceInputSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(REASON_MAX),
});

export type WriteOffInvoiceInput = z.infer<typeof writeOffInvoiceInputSchema>;

// ---------------------------------------------------------------------------
// Payments and refunds
// ---------------------------------------------------------------------------

const NOTES_MAX = 1000;

/**
 * `amount` arrives in dollars (converted to cents in the service, exactly
 * like `reservation.ts`/`payment.ts`). There is deliberately no `currency`
 * field — every invoice-linked payment is always denominated in its
 * invoice's own currency, resolved server-side and never accepted from the
 * client. `idempotencyKey` is required (not optional): retrying the same
 * request must be safe, matching `payments_workspace_idempotency_uq`.
 */
export const recordPaymentInputSchema = z.object({
  amount: z.coerce
    .number()
    .min(0.01, "Must be greater than zero")
    .max(1_000_000, "Too large")
    .refine(hasAtMostCentsPrecision, "Amount can't have more than 2 decimal places"),
  method: z.enum(PAYMENT_METHODS),
  idempotencyKey: z.string().trim().min(1, "Missing idempotency key").max(255),
  notes: z.preprocess(cleanOptional, z.string().max(NOTES_MAX).optional()),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentInputSchema>;

/**
 * `chargePaymentId` names the specific prior charge this refund reverses —
 * required, matching `payments_refund_reference_ck`'s biconditional (a
 * refund row must always name what it's refunding). No `currency` field,
 * same reasoning as `recordPaymentInputSchema`.
 */
export const recordRefundInputSchema = z.object({
  chargePaymentId: z.uuid("Select the charge to refund"),
  amount: z.coerce
    .number()
    .min(0.01, "Must be greater than zero")
    .max(1_000_000, "Too large")
    .refine(hasAtMostCentsPrecision, "Amount can't have more than 2 decimal places"),
  idempotencyKey: z.string().trim().min(1, "Missing idempotency key").max(255),
  notes: z.preprocess(cleanOptional, z.string().max(NOTES_MAX).optional()),
});

export type RecordRefundInput = z.infer<typeof recordRefundInputSchema>;

/**
 * A charge's remaining refundable balance — mirrors
 * `enforce_invoice_payment_integrity`'s per-charge cap arithmetic exactly
 * (`charge_amount - already_refunded_against_charge`, both summed the same
 * way `getInvoiceNetPaidCents`/its refund-sum counterpart do: active,
 * `status='paid'`, not soft-deleted). Clamped at zero for the same reason as
 * `computeOutstandingCents` — `refundedCents` algebraically shouldn't exceed
 * `chargeAmountCents` (the DB trigger rejects that at the source), but a
 * display/pre-check value should never read as a confusing negative number
 * if that invariant were ever violated.
 */
export function computeRemainingRefundableCents(
  chargeAmountCents: number,
  refundedCents: number,
): number {
  return Math.max(chargeAmountCents - refundedCents, 0);
}

/**
 * `reason` is stored in the payment's own `notes` (appended, not
 * overwritten — see `voidPayment`) rather than a new dedicated column,
 * mirroring `voidInvoiceInputSchema`'s identical decision for invoices.
 */
export const voidPaymentInputSchema = z.object({
  reason: z.string().trim().min(1, "A reason is required").max(REASON_MAX),
});

export type VoidPaymentInput = z.infer<typeof voidPaymentInputSchema>;

/**
 * Ledger direction — mirrors `payment_type` exactly. Sprint 15 Phase 1 only
 * ever creates `charge` rows (manual, immediately `status='paid'`); `refund`
 * is schema/trigger-ready but has no consuming service yet (deferred).
 */
export const PAYMENT_TYPES = ["charge", "refund"] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

/** Lean DTO for an invoice-linked payment/refund ledger row (Sprint 15). */
export interface PaymentDto {
  id: string;
  workspaceId: string;
  invoiceId: string;
  type: PaymentType;
  amountCents: number;
  currency: string;
  method: PaymentMethodValue;
  actorTeamMemberId: string | null;
  paidAt: Date | null;
  notes: string | null;
  /** Non-null once `voidPayment` has soft-deleted this row — maps to `payments.deletedAt`. */
  voidedAt: Date | null;
  createdAt: Date;
  /** The charge this row reverses — set only when `type === 'refund'`, always `null` for a charge (Sprint 15 Phase 2). */
  refundedPaymentId: string | null;
}

/** The fields of a payment request that matter for idempotency-key replay
 *  equivalence — deliberately excludes `notes` (cosmetic, not part of the
 *  financial fact being retried). */
export interface PaymentIdempotencyReplayCandidate {
  invoiceId: string;
  amountCents: number;
  method: PaymentMethodValue;
}

/**
 * Whether a payment already stored under a reused idempotency key is a true
 * retry of `requested` (safe to hand back as the successful response) or a
 * materially different request that happens to collide on the same key
 * (must be rejected — `payments_workspace_idempotency_uq` only tells the
 * service *that* the key collided, never *whether* the request is the same
 * one). Pure so the replay/reject decision is unit-testable independently of
 * the service's DB access and error handling.
 */
export function isIdempotentPaymentReplay(
  existing: PaymentIdempotencyReplayCandidate,
  requested: PaymentIdempotencyReplayCandidate,
): boolean {
  return (
    existing.invoiceId === requested.invoiceId &&
    existing.amountCents === requested.amountCents &&
    existing.method === requested.method
  );
}

/**
 * The fields of a refund request that matter for idempotency-key replay
 * equivalence — a deliberately separate type/function from
 * `PaymentIdempotencyReplayCandidate`/`isIdempotentPaymentReplay`, not a
 * generalization of them. A refund's `method` is inherited from the charge
 * it reverses (never client input — see `recordRefundInputSchema`'s doc
 * comment), so it can't discriminate two different refund requests the way
 * it discriminates two different charge requests; `refundedPaymentId` is the
 * refund-specific identity field that does.
 */
export interface RefundIdempotencyReplayCandidate {
  invoiceId: string;
  refundedPaymentId: string;
  amountCents: number;
}

/**
 * Whether a refund already stored under a reused idempotency key is a true
 * retry of `requested` or a materially different request that happens to
 * collide on the same key — same reasoning as `isIdempotentPaymentReplay`,
 * applied to the refund-specific identity fields.
 */
export function isIdempotentRefundReplay(
  existing: RefundIdempotencyReplayCandidate,
  requested: RefundIdempotencyReplayCandidate,
): boolean {
  return (
    existing.invoiceId === requested.invoiceId &&
    existing.refundedPaymentId === requested.refundedPaymentId &&
    existing.amountCents === requested.amountCents
  );
}
