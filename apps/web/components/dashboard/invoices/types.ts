import type {
  InvoiceDetail,
  InvoiceStatusValue,
  PaymentDto,
} from "../../../src/server/validators/invoice";

/**
 * An invoice combined with its full payment/refund ledger — preloaded
 * server-side (Sprint 17 Phase 2) from the existing `getInvoice`/
 * `listInvoicePayments` APIs so the view drawer never needs a client-side
 * fetch. Never mutated locally; always re-derived from the latest
 * `initialInvoices` prop after `router.refresh()`.
 */
export interface InvoiceRow extends InvoiceDetail {
  payments: PaymentDto[];
}

export type InvoiceStatusFilter = "all" | InvoiceStatusValue;

/** Capitalized status label shown by StatusPill (mapped from the DB enum). */
export type InvoiceStatusLabel =
  | "Draft"
  | "Open"
  | "Paid"
  | "Void"
  | "Written off";
