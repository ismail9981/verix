import { describe, it, expect } from "vitest";
import {
  buildingInputSchema,
  buildingReorderSchema,
  isValidBuildingReorder,
  nextBuildingPosition,
} from "./building";

describe("nextBuildingPosition", () => {
  it("returns 0 for an empty property", () => {
    expect(nextBuildingPosition([])).toBe(0);
  });

  it("appends after the current highest position", () => {
    expect(nextBuildingPosition([0, 1, 2])).toBe(3);
  });

  it("is robust to out-of-order or gapped positions", () => {
    expect(nextBuildingPosition([5, 0, 2])).toBe(6);
  });
});

describe("buildingInputSchema", () => {
  it("accepts a valid name", () => {
    const result = buildingInputSchema.safeParse({ name: "Tower A" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = buildingInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("buildingReorderSchema", () => {
  it("accepts a list of valid uuids", () => {
    const result = buildingReorderSchema.safeParse({
      orderedIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty list", () => {
    const result = buildingReorderSchema.safeParse({ orderedIds: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    const result = buildingReorderSchema.safeParse({ orderedIds: ["not-a-uuid"] });
    expect(result.success).toBe(false);
  });
});

describe("isValidBuildingReorder", () => {
  it("accepts an exact permutation of the existing ids", () => {
    expect(isValidBuildingReorder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("rejects a different length (partial list)", () => {
    expect(isValidBuildingReorder(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  it("rejects a list containing a foreign/unknown id", () => {
    expect(isValidBuildingReorder(["a", "b", "c"], ["a", "b", "z"])).toBe(false);
  });

  it("rejects a list missing one of the existing ids even at the same length", () => {
    expect(isValidBuildingReorder(["a", "b", "c"], ["a", "a", "b"])).toBe(false);
  });

  it("accepts the trivial empty-property case", () => {
    expect(isValidBuildingReorder([], [])).toBe(true);
  });
});
