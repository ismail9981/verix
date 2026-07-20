import { describe, it, expect } from "vitest";
import {
  INVOICE_STATUSES,
  deriveInvoiceStatus,
  deriveReservationPaymentStatus,
  getValidInvoiceTransitionsFrom,
  isValidInvoiceStatusTransition,
  isValidLineItemAmountSign,
  issueInvoiceInputSchema,
  lineItemInputSchema,
  recordPaymentInputSchema,
  recordRefundInputSchema,
  voidInvoiceInputSchema,
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

