import { describe, it, expect } from "vitest";
import { cleanOptional, hasAtMostCentsPrecision } from "./shared";

describe("cleanOptional", () => {
  it("normalizes an empty or whitespace-only string to undefined", () => {
    expect(cleanOptional("")).toBeUndefined();
    expect(cleanOptional("   ")).toBeUndefined();
  });

  it("trims and passes through a non-empty string", () => {
    expect(cleanOptional("  hello  ")).toBe("hello");
  });

  it(
    "REGRESSION: normalizes null to undefined — FormData.get(name) returns null " +
      "(not \"\") when no element with that name exists in the submitted form at all, " +
      "and a bare null fails a Zod `.optional()` schema (which only accepts undefined). " +
      "An optional field a given form variant doesn't render (e.g. Housekeeping's " +
      "create form has no reservationId input) must not reject the whole submission.",
    () => {
      expect(cleanOptional(null)).toBeUndefined();
    },
  );

  it("passes through undefined unchanged", () => {
    expect(cleanOptional(undefined)).toBeUndefined();
  });

  it("passes through non-string, non-null values unchanged", () => {
    expect(cleanOptional(42)).toBe(42);
  });
});

describe("hasAtMostCentsPrecision", () => {
  it("accepts whole numbers and ordinary 1-2 decimal amounts", () => {
    for (const amount of [0, 100, 0.01, 0.1, 19.99, 19.9, 33.33, 1_000_000]) {
      expect(hasAtMostCentsPrecision(amount)).toBe(true);
    }
  });

  it("rejects amounts with a genuine 3rd decimal digit", () => {
    for (const amount of [19.995, 19.999, 1.005, 0.005]) {
      expect(hasAtMostCentsPrecision(amount)).toBe(false);
    }
  });
});
