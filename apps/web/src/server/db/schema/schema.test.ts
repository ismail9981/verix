import { describe, it, expect } from "vitest";
import { ISO_4217_CURRENCY_PATTERN } from "./columns";
import {
  invoiceLineItemTypeEnum,
  invoiceStatusEnum,
  paymentTypeEnum,
  platformAdminRoleEnum,
  platformAdminStatusEnum,
  platformAuditActionEnum,
  platformAuditActorKindEnum,
  platformAuditOutcomeEnum,
  platformAuditTargetTypeEnum,
  reservationPaymentStatusEnum,
  workspaceStatusEnum,
} from "./enums";

/*
 * Schema-level regression tests. This suite is dependency-free (no DB, no
 * env) — it locks in the *shape* of the schema contract (enum value sets,
 * the currency-format rule) that Phase 2's validators/services build on, so
 * an accidental edit to `enums.ts`/`columns.ts` that drifts from the
 * `0014_billing.sql` migration it mirrors is caught in CI rather than at
 * runtime against a live database.
 */

describe("invoice lifecycle enum (invoiceStatusEnum)", () => {
  it("has exactly the 5 Sprint 14 statuses, in order", () => {
    expect(invoiceStatusEnum.enumValues).toEqual([
      "draft",
      "open",
      "paid",
      "void",
      "written_off",
    ]);
  });

  it("does NOT include a stored 'partially_paid' value", () => {
    expect(invoiceStatusEnum.enumValues).not.toContain("partially_paid");
  });
});

describe("Sprint 2 Platform Admin foundation enums", () => {
  it("keeps Platform identity independent from workspace roles", () => {
    expect(platformAdminRoleEnum.enumValues).toEqual([
      "super_admin",
      "support_admin",
    ]);
    expect(platformAdminStatusEnum.enumValues).toEqual(["active", "suspended"]);
    expect(workspaceStatusEnum.enumValues).toEqual(["active", "suspended"]);
  });

  it("locks the reviewed Platform Audit vocabulary", () => {
    expect(platformAuditActorKindEnum.enumValues).toEqual([
      "platform_admin",
      "system_bootstrap",
    ]);
    expect(platformAuditActionEnum.enumValues).toEqual([
      "platform_admin.bootstrap_completed",
      "workspace.created",
      "workspace.owner_assigned",
      "workspace.suspended",
      "workspace.activated",
    ]);
    expect(platformAuditTargetTypeEnum.enumValues).toEqual([
      "platform_admin",
      "workspace",
    ]);
    expect(platformAuditOutcomeEnum.enumValues).toEqual(["success", "failure"]);
  });
});

describe("payment type enum (paymentTypeEnum)", () => {
  it("is exactly charge|refund", () => {
    expect(paymentTypeEnum.enumValues).toEqual(["charge", "refund"]);
  });
});

describe("reservation payment status enum (reservationPaymentStatusEnum)", () => {
  it("is exactly unpaid|partially_paid|paid", () => {
    expect(reservationPaymentStatusEnum.enumValues).toEqual([
      "unpaid",
      "partially_paid",
      "paid",
    ]);
  });
});

describe("invoice line item type enum (invoiceLineItemTypeEnum)", () => {
  it("is exactly stay|fee|tax|discount", () => {
    expect(invoiceLineItemTypeEnum.enumValues).toEqual([
      "stay",
      "fee",
      "tax",
      "discount",
    ]);
  });
});

describe("ISO_4217_CURRENCY_PATTERN (mirrors the DB currency CHECK constraint)", () => {
  it("accepts a 3-uppercase-letter code", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("USD")).toBe(true);
    expect(ISO_4217_CURRENCY_PATTERN.test("EUR")).toBe(true);
    expect(ISO_4217_CURRENCY_PATTERN.test("GBP")).toBe(true);
  });

  it("rejects lowercase", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("usd")).toBe(false);
  });

  it("rejects mixed case", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("Usd")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("US")).toBe(false);
    expect(ISO_4217_CURRENCY_PATTERN.test("USDD")).toBe(false);
    expect(ISO_4217_CURRENCY_PATTERN.test("")).toBe(false);
  });

  it("rejects digits or symbols", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("US1")).toBe(false);
    expect(ISO_4217_CURRENCY_PATTERN.test("US$")).toBe(false);
  });

  it("anchors the match — rejects a valid code embedded in a longer string", () => {
    expect(ISO_4217_CURRENCY_PATTERN.test("USD ")).toBe(false);
    expect(ISO_4217_CURRENCY_PATTERN.test(" USD")).toBe(false);
    expect(ISO_4217_CURRENCY_PATTERN.test("USDUSD")).toBe(false);
  });
});
