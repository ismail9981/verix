import { describe, it, expect } from "vitest";
import {
  INVOICE_STATUSES,
  POSTGRES_INT4_MAX,
  computeLineItemAmountCents,
  computeOutstandingCents,
  computeRemainingRefundableCents,
  deriveInvoiceStatus,
  deriveReservationPaymentStatus,
  formatInvoiceNumber,
  getValidInvoiceTransitionsFrom,
  invoiceNumberPrefix,
  isDueDateOnOrAfterIssuance,
  isIdempotentPaymentReplay,
  isIdempotentRefundReplay,
  isValidInvoiceStatusTransition,
  isValidLineItemAmountSign,
  issueInvoiceInputSchema,
  lineItemInputSchema,
  nextInvoiceSuffix,
  recordPaymentInputSchema,
  recordRefundInputSchema,
  resolveInvoiceScope,
  voidInvoiceInputSchema,
  voidPaymentInputSchema,
  workspaceInvoiceYear,
  writeOffInvoiceInputSchema,
} from "./invoice";

describe("isValidInvoiceStatusTransition", () => {
  it("allows the documented forward transitions", () => {
    expect(isValidInvoiceStatusTransition("draft", "open")).toBe(true);
    expect(isValidInvoiceStatusTransition("draft", "void")).toBe(true);
    expect(isValidInvoiceStatusTransition("open", "paid")).toBe(true);
    expect(isValidInvoiceStatusTransition("open", "void")).toBe(true);
    expect(isValidInvoiceStatusTransition("open", "written_off")).toBe(true);
    expect(isValidInvoiceStatusTransition("paid", "open")).toBe(true);
  });

  it("rejects paid -> void (a paid invoice can never be voided directly)", () => {
    expect(isValidInvoiceStatusTransition("paid", "void")).toBe(false);
  });

  it("rejects paid -> written_off and draft -> written_off (write-off only applies to an open balance)", () => {
    expect(isValidInvoiceStatusTransition("paid", "written_off")).toBe(false);
    expect(isValidInvoiceStatusTransition("draft", "written_off")).toBe(false);
  });

  it("rejects draft -> paid (an invoice must be issued before it can be paid)", () => {
    expect(isValidInvoiceStatusTransition("draft", "paid")).toBe(false);
  });

  it("treats void and written_off as terminal — no transition out of either", () => {
    for (const to of INVOICE_STATUSES) {
      expect(isValidInvoiceStatusTransition("void", to)).toBe(false);
      expect(isValidInvoiceStatusTransition("written_off", to)).toBe(false);
    }
  });

  it("rejects a no-op transition to the same status for every status", () => {
    for (const status of INVOICE_STATUSES) {
      expect(isValidInvoiceStatusTransition(status, status)).toBe(false);
    }
  });

  it("exhaustively cross-checks every (from, to) pair against getValidInvoiceTransitionsFrom", () => {
    for (const from of INVOICE_STATUSES) {
      for (const to of INVOICE_STATUSES) {
        const allowed = getValidInvoiceTransitionsFrom(from).includes(to);
        expect(isValidInvoiceStatusTransition(from, to)).toBe(allowed);
      }
    }
  });

  it("terminal statuses have no valid outgoing transitions", () => {
    expect(getValidInvoiceTransitionsFrom("void")).toEqual([]);
    expect(getValidInvoiceTransitionsFrom("written_off")).toEqual([]);
  });
});

describe("deriveInvoiceStatus", () => {
  it("stays open when net paid is below the total", () => {
    expect(deriveInvoiceStatus(10000, 0)).toBe("open");
    expect(deriveInvoiceStatus(10000, 9999)).toBe("open");
  });

  it("becomes paid once net paid reaches the total exactly", () => {
    expect(deriveInvoiceStatus(10000, 10000)).toBe("paid");
  });

  it("stays paid if net paid exceeds the total (should not happen, but must not misclassify)", () => {
    expect(deriveInvoiceStatus(10000, 10001)).toBe("paid");
  });

  it("a zero-total invoice is paid at zero net paid", () => {
    expect(deriveInvoiceStatus(0, 0)).toBe("paid");
  });

  it("stays open at a negative net paid (symmetry with deriveReservationPaymentStatus's equivalent case)", () => {
    expect(deriveInvoiceStatus(10000, -500)).toBe("open");
  });
});

describe("computeOutstandingCents", () => {
  it("is the simple difference when net paid is below the total", () => {
    expect(computeOutstandingCents(10000, 0)).toBe(10000);
    expect(computeOutstandingCents(10000, 4000)).toBe(6000);
  });

  it("is zero once net paid reaches the total exactly", () => {
    expect(computeOutstandingCents(10000, 10000)).toBe(0);
  });

  it("clamps at zero rather than going negative if net paid exceeds the total", () => {
    expect(computeOutstandingCents(10000, 10001)).toBe(0);
  });

  it("is zero for a zero-total invoice", () => {
    expect(computeOutstandingCents(0, 0)).toBe(0);
  });
});

describe("computeRemainingRefundableCents", () => {
  it("is the simple difference when nothing has been refunded yet", () => {
    expect(computeRemainingRefundableCents(10000, 0)).toBe(10000);
  });

  it("is the simple difference after a partial refund", () => {
    expect(computeRemainingRefundableCents(10000, 4000)).toBe(6000);
  });

  it("is zero once the charge has been refunded exactly in full", () => {
    expect(computeRemainingRefundableCents(10000, 10000)).toBe(0);
  });

  it("clamps at zero rather than going negative if refunded exceeds the charge", () => {
    expect(computeRemainingRefundableCents(10000, 10001)).toBe(0);
  });

  it("is zero for a zero-amount charge", () => {
    expect(computeRemainingRefundableCents(0, 0)).toBe(0);
  });
});

describe("deriveReservationPaymentStatus", () => {
  it("is unpaid at zero or negative net paid", () => {
    expect(deriveReservationPaymentStatus(10000, 0)).toBe("unpaid");
    expect(deriveReservationPaymentStatus(10000, -500)).toBe("unpaid");
  });

  it("is partially_paid strictly between zero and the total", () => {
    expect(deriveReservationPaymentStatus(10000, 1)).toBe("partially_paid");
    expect(deriveReservationPaymentStatus(10000, 9999)).toBe("partially_paid");
  });

  it("is paid once net paid reaches the total", () => {
    expect(deriveReservationPaymentStatus(10000, 10000)).toBe("paid");
    expect(deriveReservationPaymentStatus(10000, 10001)).toBe("paid");
  });

  it("REGRESSION: a fully refunded invoice (net paid back to 0) reads as unpaid, not a distinct 'refunded' bucket", () => {
    // e.g. $100 charged then $100 refunded -> net paid = 0
    expect(deriveReservationPaymentStatus(10000, 0)).toBe("unpaid");
  });

  it("REGRESSION: a partially refunded invoice reads as partially_paid, not a distinct bucket", () => {
    // e.g. $100 charged then $40 refunded -> net paid = 60, total = 100
    expect(deriveReservationPaymentStatus(10000, 6000)).toBe("partially_paid");
  });
});

describe("isValidLineItemAmountSign", () => {
  it("requires a discount's final amount to be negative", () => {
    expect(isValidLineItemAmountSign("discount", -500)).toBe(true);
    expect(isValidLineItemAmountSign("discount", 500)).toBe(false);
    expect(isValidLineItemAmountSign("discount", 0)).toBe(false);
  });

  it("requires every non-discount type's final amount to be positive", () => {
    for (const type of ["stay", "fee", "tax"] as const) {
      expect(isValidLineItemAmountSign(type, 500)).toBe(true);
      expect(isValidLineItemAmountSign(type, -500)).toBe(false);
      expect(isValidLineItemAmountSign(type, 0)).toBe(false);
    }
  });
});

describe("lineItemInputSchema", () => {
  it("accepts a valid stay line item", () => {
    const result = lineItemInputSchema.safeParse({
      type: "stay",
      description: "3 nights",
      quantity: 1,
      unitAmount: 150.5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a blank description", () => {
    const result = lineItemInputSchema.safeParse({
      type: "fee",
      description: "   ",
      quantity: 1,
      unitAmount: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity below 1", () => {
    const result = lineItemInputSchema.safeParse({
      type: "fee",
      description: "Cleaning fee",
      quantity: 0,
      unitAmount: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    const result = lineItemInputSchema.safeParse({
      type: "fee",
      description: "Cleaning fee",
      quantity: 1.5,
      unitAmount: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero or negative unitAmount — always entered positive regardless of type", () => {
    expect(
      lineItemInputSchema.safeParse({
        type: "discount",
        description: "Loyalty discount",
        quantity: 1,
        unitAmount: 0,
      }).success,
    ).toBe(false);
    expect(
      lineItemInputSchema.safeParse({
        type: "discount",
        description: "Loyalty discount",
        quantity: 1,
        unitAmount: -20,
      }).success,
    ).toBe(false);
  });

  it("rejects an amount with more than 2 decimal places", () => {
    const result = lineItemInputSchema.safeParse({
      type: "tax",
      description: "City tax",
      quantity: 1,
      unitAmount: 12.999,
    });
    expect(result.success).toBe(false);
  });

  it("accepts the maximum allowed amount and rejects one cent over it", () => {
    expect(
      lineItemInputSchema.safeParse({
        type: "fee",
        description: "Large fee",
        quantity: 1,
        unitAmount: 1_000_000,
      }).success,
    ).toBe(true);
    expect(
      lineItemInputSchema.safeParse({
        type: "fee",
        description: "Too-large fee",
        quantity: 1,
        unitAmount: 1_000_000.01,
      }).success,
    ).toBe(false);
  });

  it("has no currency field to ignore — a line item is always denominated in its invoice's currency", () => {
    const result = lineItemInputSchema.safeParse({
      type: "stay",
      description: "3 nights",
      quantity: 1,
      unitAmount: 150,
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).currency).toBeUndefined();
    }
  });

  it("rejects a quantity × unitAmount combination that overflows Postgres's integer column", () => {
    // Both fields are individually within their own allowed range
    // (quantity has no standalone max; unitAmount's max is 1,000,000), but
    // their product (100 * $1,000,000 = 10,000,000,000 cents) exceeds int4.
    const result = lineItemInputSchema.safeParse({
      type: "fee",
      description: "Bulk fee",
      quantity: 100,
      unitAmount: 1_000_000,
    });
    expect(result.success).toBe(false);
  });

  it("accepts the largest quantity × unitAmount combination that stays within int4", () => {
    // 21 * $1,000,000 = 2,100,000,000 cents — under the 2,147,483,647 ceiling.
    expect(
      lineItemInputSchema.safeParse({
        type: "fee",
        description: "Large but valid",
        quantity: 21,
        unitAmount: 1_000_000,
      }).success,
    ).toBe(true);
    // 22 * $1,000,000 = 2,200,000,000 cents — over the ceiling.
    expect(
      lineItemInputSchema.safeParse({
        type: "fee",
        description: "One step too far",
        quantity: 22,
        unitAmount: 1_000_000,
      }).success,
    ).toBe(false);
  });

  it("computeLineItemAmountCents never exceeds Postgres's int4 range for schema-valid input", () => {
    const result = lineItemInputSchema.safeParse({
      type: "fee",
      description: "Max valid",
      quantity: 21,
      unitAmount: 1_000_000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const amountCents = computeLineItemAmountCents(result.data.type, result.data.quantity, result.data.unitAmount);
      expect(Number.isSafeInteger(amountCents)).toBe(true);
      expect(Math.abs(amountCents)).toBeLessThanOrEqual(POSTGRES_INT4_MAX);
    }
  });
});

describe("issueInvoiceInputSchema", () => {
  it("allows an absent dueAt", () => {
    expect(issueInvoiceInputSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a valid ISO date", () => {
    expect(issueInvoiceInputSchema.safeParse({ dueAt: "2026-08-01" }).success).toBe(true);
  });

  it("normalizes an empty string to absent (FormData convention)", () => {
    const result = issueInvoiceInputSchema.safeParse({ dueAt: "" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.dueAt).toBeUndefined();
  });
});

describe("voidInvoiceInputSchema / writeOffInvoiceInputSchema", () => {
  it("requires a non-empty reason", () => {
    expect(voidInvoiceInputSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(voidInvoiceInputSchema.safeParse({ reason: "   " }).success).toBe(false);
    expect(writeOffInvoiceInputSchema.safeParse({ reason: "" }).success).toBe(false);
  });

  it("accepts a real reason", () => {
    expect(voidInvoiceInputSchema.safeParse({ reason: "Booked in error" }).success).toBe(true);
    expect(writeOffInvoiceInputSchema.safeParse({ reason: "Guest unreachable, balance uncollectible" }).success).toBe(true);
  });
});

describe("voidPaymentInputSchema", () => {
  it("requires a non-empty reason", () => {
    expect(voidPaymentInputSchema.safeParse({ reason: "" }).success).toBe(false);
    expect(voidPaymentInputSchema.safeParse({ reason: "   " }).success).toBe(false);
  });

  it("accepts a real reason", () => {
    expect(voidPaymentInputSchema.safeParse({ reason: "Duplicate entry" }).success).toBe(true);
  });
});

describe("isIdempotentPaymentReplay", () => {
  const base = { invoiceId: "inv-1", amountCents: 5000, method: "cash" as const };

  it("is a replay when invoice, amount, and method all match", () => {
    expect(isIdempotentPaymentReplay(base, { ...base })).toBe(true);
  });

  it("is not a replay when the invoice differs", () => {
    expect(isIdempotentPaymentReplay(base, { ...base, invoiceId: "inv-2" })).toBe(false);
  });

  it("is not a replay when the amount differs", () => {
    expect(isIdempotentPaymentReplay(base, { ...base, amountCents: 5001 })).toBe(false);
  });

  it("is not a replay when the method differs", () => {
    expect(isIdempotentPaymentReplay(base, { ...base, method: "card" })).toBe(false);
  });

  it("cannot by itself distinguish a charge from a refund with coincidentally matching fields — the caller must additionally gate on `type`", () => {
    // A refund's `invoiceId`/`amountCents`/`method` can coincidentally equal
    // a later, unrelated charge request's (a refund's `method` is inherited
    // from the charge it reverses). This function only ever compares those
    // three fields, so it alone would call this pair a "replay" even though
    // one is a charge and the other a refund. `recordPayment`'s idempotency
    // recovery path is what actually prevents a refund row from being
    // returned as a charge replay, via an explicit `existing.type ===
    // "charge"` check *before* calling this function — never inferred from
    // field overlap.
    const refundShaped = { invoiceId: "inv-1", amountCents: 5000, method: "cash" as const };
    const chargeRequest = { invoiceId: "inv-1", amountCents: 5000, method: "cash" as const };
    expect(isIdempotentPaymentReplay(refundShaped, chargeRequest)).toBe(true);
  });
});

describe("isIdempotentRefundReplay", () => {
  const base = { invoiceId: "inv-1", refundedPaymentId: "charge-1", amountCents: 3000 };

  it("is a replay when invoice, refunded charge, and amount all match", () => {
    expect(isIdempotentRefundReplay(base, { ...base })).toBe(true);
  });

  it("is not a replay when the invoice differs", () => {
    expect(isIdempotentRefundReplay(base, { ...base, invoiceId: "inv-2" })).toBe(false);
  });

  it("is not a replay when the refunded charge differs", () => {
    expect(isIdempotentRefundReplay(base, { ...base, refundedPaymentId: "charge-2" })).toBe(false);
  });

  it("is not a replay when the amount differs", () => {
    expect(isIdempotentRefundReplay(base, { ...base, amountCents: 3001 })).toBe(false);
  });
});

describe("recordPaymentInputSchema", () => {
  it("accepts a valid payment", () => {
    const result = recordPaymentInputSchema.safeParse({
      amount: 50,
      method: "cash",
      idempotencyKey: "idem-1",
    });
    expect(result.success).toBe(true);
  });

  it("requires a non-empty idempotencyKey", () => {
    expect(
      recordPaymentInputSchema.safeParse({ amount: 50, method: "cash", idempotencyKey: "" }).success,
    ).toBe(false);
  });

  it("rejects a zero or negative amount", () => {
    expect(
      recordPaymentInputSchema.safeParse({ amount: 0, method: "cash", idempotencyKey: "k" }).success,
    ).toBe(false);
    expect(
      recordPaymentInputSchema.safeParse({ amount: -10, method: "cash", idempotencyKey: "k" }).success,
    ).toBe(false);
  });

  it("rejects an unrecognized method", () => {
    const result = recordPaymentInputSchema.safeParse({
      amount: 50,
      method: "crypto",
      idempotencyKey: "k",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the maximum allowed amount and rejects one cent over it", () => {
    expect(
      recordPaymentInputSchema.safeParse({
        amount: 1_000_000,
        method: "cash",
        idempotencyKey: "k",
      }).success,
    ).toBe(true);
    expect(
      recordPaymentInputSchema.safeParse({
        amount: 1_000_000.01,
        method: "cash",
        idempotencyKey: "k",
      }).success,
    ).toBe(false);
  });

  it("has no currency field — always the invoice's own currency", () => {
    const result = recordPaymentInputSchema.safeParse({
      amount: 50,
      method: "cash",
      idempotencyKey: "k",
      currency: "EUR",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).currency).toBeUndefined();
    }
  });

  it("normalizes absent notes to undefined and preserves a real note", () => {
    const absent = recordPaymentInputSchema.safeParse({ amount: 50, method: "cash", idempotencyKey: "k" });
    expect(absent.success).toBe(true);
    if (absent.success) expect(absent.data.notes).toBeUndefined();

    const present = recordPaymentInputSchema.safeParse({
      amount: 50,
      method: "cash",
      idempotencyKey: "k",
      notes: "Paid at front desk",
    });
    expect(present.success).toBe(true);
    if (present.success) expect(present.data.notes).toBe("Paid at front desk");
  });
});

describe("recordRefundInputSchema", () => {
  it("requires a chargePaymentId", () => {
    const result = recordRefundInputSchema.safeParse({
      amount: 20,
      idempotencyKey: "k",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid chargePaymentId", () => {
    const result = recordRefundInputSchema.safeParse({
      chargePaymentId: "not-a-uuid",
      amount: 20,
      idempotencyKey: "k",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid refund", () => {
    const result = recordRefundInputSchema.safeParse({
      chargePaymentId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 20,
      idempotencyKey: "k",
    });
    expect(result.success).toBe(true);
  });

  it("requires a non-empty idempotencyKey", () => {
    const result = recordRefundInputSchema.safeParse({
      chargePaymentId: "123e4567-e89b-12d3-a456-426614174000",
      amount: 20,
      idempotencyKey: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts the maximum allowed amount and rejects one cent over it", () => {
    expect(
      recordRefundInputSchema.safeParse({
        chargePaymentId: "123e4567-e89b-12d3-a456-426614174000",
        amount: 1_000_000,
        idempotencyKey: "k",
      }).success,
    ).toBe(true);
    expect(
      recordRefundInputSchema.safeParse({
        chargePaymentId: "123e4567-e89b-12d3-a456-426614174000",
        amount: 1_000_000.01,
        idempotencyKey: "k",
      }).success,
    ).toBe(false);
  });
});

describe("computeLineItemAmountCents", () => {
  it("converts dollars to whole cents and multiplies by quantity", () => {
    expect(computeLineItemAmountCents("fee", 1, 25)).toBe(2500);
    expect(computeLineItemAmountCents("fee", 3, 25)).toBe(7500);
    expect(computeLineItemAmountCents("tax", 1, 19.99)).toBe(1999);
  });

  it("negates the total for a discount, keeping every other type positive", () => {
    expect(computeLineItemAmountCents("discount", 1, 10)).toBe(-1000);
    expect(computeLineItemAmountCents("stay", 2, 100)).toBe(20000);
  });

  it("rounds away ordinary floating-point noise before multiplying", () => {
    // 0.1 + 0.2 style noise: unitAmount * 100 lands just off 100 in raw FP.
    expect(computeLineItemAmountCents("fee", 1, 1.1)).toBe(110);
    expect(computeLineItemAmountCents("fee", 7, 1.1)).toBe(770);
  });
});

describe("resolveInvoiceScope", () => {
  it("gives owners and managers full scope", () => {
    expect(resolveInvoiceScope("owner", "tm1")).toEqual({ kind: "all" });
    expect(resolveInvoiceScope("manager", null)).toEqual({ kind: "all" });
  });
  it("scopes employees to their own team-member id", () => {
    expect(resolveInvoiceScope("employee", "tm1")).toEqual({
      kind: "assigned",
      teamMemberId: "tm1",
    });
  });
  it("returns 'none' rather than an empty-string placeholder when no team-member id resolves", () => {
    expect(resolveInvoiceScope("employee", null)).toEqual({ kind: "none" });
  });
});

describe("workspaceInvoiceYear", () => {
  it("derives the year from the workspace's own timezone, not server-local time", () => {
    // 2026-01-01 00:30 UTC is still 2025-12-31 in a timezone far enough west.
    const justAfterUtcMidnight = new Date("2026-01-01T00:30:00Z");
    expect(workspaceInvoiceYear("UTC", justAfterUtcMidnight)).toBe(2026);
    expect(workspaceInvoiceYear("america-los_angeles", justAfterUtcMidnight)).toBe(2025);
  });

  it("agrees with UTC well away from a year boundary", () => {
    const midyear = new Date("2026-06-15T12:00:00Z");
    expect(workspaceInvoiceYear("UTC", midyear)).toBe(2026);
    expect(workspaceInvoiceYear("america-los_angeles", midyear)).toBe(2026);
  });
});

describe("invoiceNumberPrefix / formatInvoiceNumber", () => {
  it("builds the documented INV-{year}-{00001..} shape", () => {
    expect(invoiceNumberPrefix(2026)).toBe("INV-2026-");
    expect(formatInvoiceNumber(2026, 1)).toBe("INV-2026-00001");
    expect(formatInvoiceNumber(2026, 42)).toBe("INV-2026-00042");
  });

  it("does not truncate a suffix wider than the usual 5-digit padding", () => {
    expect(formatInvoiceNumber(2026, 123456)).toBe("INV-2026-123456");
  });
});

describe("nextInvoiceSuffix", () => {
  it("returns 1 when no invoice numbers exist yet for the prefix", () => {
    expect(nextInvoiceSuffix([], "INV-2026-")).toBe(1);
  });

  it("uses max(suffix) + 1, not count + 1", () => {
    // Only 2 rows exist, but the highest suffix is 00050 (e.g. a prior
    // deletion left a gap) — a count-based scheme would wrongly compute 3.
    expect(nextInvoiceSuffix(["INV-2026-00001", "INV-2026-00050"], "INV-2026-")).toBe(51);
  });

  it("ignores a gap left by a deleted/voided-and-replaced number", () => {
    expect(nextInvoiceSuffix(["INV-2026-00001", "INV-2026-00003"], "INV-2026-")).toBe(4);
  });

  it("does not let an imported/out-of-format number corrupt the computed suffix", () => {
    expect(
      nextInvoiceSuffix(["INV-2026-00001", "INV-2026-LEGACY-9999", "INV-2026-00002"], "INV-2026-"),
    ).toBe(3);
  });

  it("ignores numbers from a different year's prefix", () => {
    expect(nextInvoiceSuffix(["INV-2025-00099", "INV-2026-00001"], "INV-2026-")).toBe(2);
  });
});

describe("isDueDateOnOrAfterIssuance", () => {
  it("accepts a due date on or after the issuance date", () => {
    expect(isDueDateOnOrAfterIssuance("2026-08-01", "2026-08-01")).toBe(true);
    expect(isDueDateOnOrAfterIssuance("2026-08-15", "2026-08-01")).toBe(true);
  });

  it("rejects a due date before the issuance date", () => {
    expect(isDueDateOnOrAfterIssuance("2026-07-31", "2026-08-01")).toBe(false);
  });
});

