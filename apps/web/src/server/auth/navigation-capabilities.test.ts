import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "../../../components/dashboard/nav-config";
import { hasCapability } from "./capabilities";

function visibleHrefs(role: string): string[] {
  return NAV_ITEMS.filter((item) =>
    hasCapability({ role }, item.capability),
  ).map((item) => item.href);
}

describe("capability-aware dashboard navigation", () => {
  it("hides every Platform-only builder entry for all Workspace roles", () => {
    for (const role of ["owner", "manager", "employee"]) {
      expect(visibleHrefs(role)).not.toContain("/website-builder");
    }
  });

  it("hides all financial and member-directory entries from employees", () => {
    const employee = visibleHrefs("employee");
    expect(employee).not.toContain("/analytics");
    expect(employee).not.toContain("/payments");
    expect(employee).not.toContain("/invoices");
    expect(employee).not.toContain("/team");
    expect(employee).not.toContain("/settings");
  });

  it("keeps approved owner/manager operational and financial entries", () => {
    for (const role of ["owner", "manager"]) {
      const visible = visibleHrefs(role);
      expect(visible).toContain("/analytics");
      expect(visible).toContain("/payments");
      expect(visible).toContain("/invoices");
      expect(visible).toContain("/team");
    }
  });
});
