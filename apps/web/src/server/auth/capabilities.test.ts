import { describe, expect, it } from "vitest";
import {
  AuthorizationError,
  CAPABILITIES,
  ROLE_CAPABILITIES,
  capabilitiesForRole,
  hasCapability,
  requireCapability,
  WORKSPACE_ROLES,
  type Capability,
} from "./capabilities";

describe("central Workspace capability matrix", () => {
  it("is exhaustive for the three approved roles and contains no duplicate grants", () => {
    expect(Object.keys(ROLE_CAPABILITIES).sort()).toEqual(
      [...WORKSPACE_ROLES].sort(),
    );
    for (const role of WORKSPACE_ROLES) {
      expect(new Set(ROLE_CAPABILITIES[role]).size).toBe(
        ROLE_CAPABILITIES[role].length,
      );
      expect(
        ROLE_CAPABILITIES[role].every((value) => CAPABILITIES.includes(value)),
      ).toBe(true);
    }
  });

  it("defaults unknown roles and unknown capabilities to deny", () => {
    expect(capabilitiesForRole("platform_admin")).toEqual([]);
    expect(hasCapability({ role: "unknown" }, "workspace.read")).toBe(false);
    expect(hasCapability({ role: "owner" }, "unknown.capability")).toBe(false);
  });

  it("denies every Website capability to every Workspace role", () => {
    const platformOnly = CAPABILITIES.filter((value) =>
      value.startsWith("website."),
    );
    for (const role of WORKSPACE_ROLES) {
      for (const capability of platformOnly) {
        expect(hasCapability({ role }, capability)).toBe(false);
      }
    }
  });

  it("denies all financial capabilities to employees", () => {
    const financial: Capability[] = [
      "invoices.read",
      "invoices.manage",
      "payments.read",
      "payments.manage",
      "refunds.manage",
      "reports.financial.read",
    ];
    for (const capability of financial) {
      expect(hasCapability({ role: "employee" }, capability)).toBe(false);
      expect(() => requireCapability({ role: "employee" }, capability)).toThrow(
        AuthorizationError,
      );
    }
  });

  it("keeps manager and owner financial access and owner-only boundaries distinct", () => {
    expect(hasCapability({ role: "manager" }, "reports.financial.read")).toBe(
      true,
    );
    expect(hasCapability({ role: "owner" }, "reports.financial.read")).toBe(
      true,
    );
    expect(
      hasCapability({ role: "manager" }, "workspace.settings.update"),
    ).toBe(false);
    expect(hasCapability({ role: "manager" }, "workspace.members.update")).toBe(
      false,
    );
    expect(hasCapability({ role: "manager" }, "properties.archive")).toBe(
      false,
    );
    expect(hasCapability({ role: "owner" }, "properties.archive")).toBe(true);
  });

  it("evaluates only the role in the supplied Active Workspace context", () => {
    const activeWorkspaceA = { workspaceId: "A", role: "manager" };
    const inactiveWorkspaceB = { workspaceId: "B", role: "owner" };
    expect(hasCapability(activeWorkspaceA, "workspace.settings.update")).toBe(
      false,
    );
    expect(hasCapability(inactiveWorkspaceB, "workspace.settings.update")).toBe(
      true,
    );
  });
});
