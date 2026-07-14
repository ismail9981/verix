import { describe, it, expect } from "vitest";
import { generateVerificationToken } from "./token";

describe("generateVerificationToken", () => {
  it("returns a 40-character lowercase hex string", () => {
    const token = generateVerificationToken();
    expect(token).toMatch(/^[0-9a-f]{40}$/);
  });

  it("is unpredictable: generates distinct tokens across many calls", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateVerificationToken));
    expect(tokens.size).toBe(200);
  });
});
