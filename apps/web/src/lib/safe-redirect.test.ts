import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath (open-redirect guard)", () => {
  it("allows a rooted same-site path", () => {
    expect(safeRedirectPath("/team")).toBe("/team");
    expect(safeRedirectPath("/website-builder?site=1")).toBe(
      "/website-builder?site=1",
    );
  });

  it("falls back for missing values", () => {
    expect(safeRedirectPath(null)).toBe("/dashboard");
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
    expect(safeRedirectPath("")).toBe("/dashboard");
  });

  it("blocks absolute URLs", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("http://evil.com")).toBe("/dashboard");
  });

  it("blocks protocol-relative and backslash network-path tricks", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeRedirectPath(null, "/login")).toBe("/login");
    expect(safeRedirectPath("//evil.com", "/login")).toBe("/login");
  });
});
