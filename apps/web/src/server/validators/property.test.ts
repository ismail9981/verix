import { describe, it, expect } from "vitest";
import { propertyFiltersSchema, propertyInputSchema } from "./property";

describe("propertyInputSchema", () => {
  it("accepts a minimal valid input", () => {
    const result = propertyInputSchema.safeParse({ name: "Sunset Villas" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addressLine1).toBeUndefined();
      expect(result.data.city).toBeUndefined();
    }
  });

  it("treats empty-string optional fields as absent", () => {
    const result = propertyInputSchema.safeParse({
      name: "Sunset Villas",
      addressLine1: "",
      city: "   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.addressLine1).toBeUndefined();
      expect(result.data.city).toBeUndefined();
    }
  });

  it("accepts full address details", () => {
    const result = propertyInputSchema.safeParse({
      name: "Sunset Villas",
      addressLine1: "123 Ocean Ave",
      city: "Malibu",
      state: "CA",
      postalCode: "90265",
      country: "USA",
      description: "Beachfront villas",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = propertyInputSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });
});

describe("propertyFiltersSchema", () => {
  it("defaults search to an empty string", () => {
    const result = propertyFiltersSchema.parse({});
    expect(result.search).toBe("");
  });

  it("trims search", () => {
    const result = propertyFiltersSchema.parse({ search: "  villas  " });
    expect(result.search).toBe("villas");
  });
});
