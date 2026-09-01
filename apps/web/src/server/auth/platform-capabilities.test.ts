import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CAPABILITIES, WORKSPACE_ROLES } from "./capabilities";
import {
  PLATFORM_ADMIN_ROLES,
  PLATFORM_CAPABILITIES,
  PLATFORM_ROLE_CAPABILITIES,
  capabilitiesForPlatformRole,
  effectivePlatformCapabilities,
  isPlatformCapability,
} from "./platform-capabilities";

describe("C1 Platform capability registry", () => {
  it("is exhaustive, duplicate-free, and separate from Workspace RBAC", () => {
    expect(Object.keys(PLATFORM_ROLE_CAPABILITIES).sort()).toEqual(
      [...PLATFORM_ADMIN_ROLES].sort(),
    );
    expect(new Set(PLATFORM_CAPABILITIES).size).toBe(
      PLATFORM_CAPABILITIES.length,
    );
    expect(
      PLATFORM_CAPABILITIES.every(
        (capability) => !CAPABILITIES.includes(capability as never),
      ),
    ).toBe(true);
    for (const role of WORKSPACE_ROLES) {
      expect(capabilitiesForPlatformRole(role)).toEqual([]);
    }
  });

  it("grants active super_admin exactly all six approved Sprint 2 capabilities", () => {
    expect(PLATFORM_ROLE_CAPABILITIES.super_admin).toEqual(
      PLATFORM_CAPABILITIES,
    );
    expect(
      effectivePlatformCapabilities({ role: "super_admin", status: "active" }),
    ).toEqual(PLATFORM_CAPABILITIES);
  });

  it("gives support_admin zero capabilities", () => {
    expect(PLATFORM_ROLE_CAPABILITIES.support_admin).toEqual([]);
    expect(
      effectivePlatformCapabilities({
        role: "support_admin",
        status: "active",
      }),
    ).toEqual([]);
  });

  it("gives suspended or structurally unknown identities zero capabilities", () => {
    expect(
      effectivePlatformCapabilities({
        role: "super_admin",
        status: "suspended",
      }),
    ).toEqual([]);
    expect(
      effectivePlatformCapabilities({ role: "owner", status: "active" }),
    ).toEqual([]);
    expect(
      effectivePlatformCapabilities({ role: "super_admin", status: "unknown" }),
    ).toEqual([]);
  });

  it("rejects every unknown capability", () => {
    expect(isPlatformCapability("platform.workspaces.read")).toBe(true);
    expect(isPlatformCapability("platform.stores.read")).toBe(false);
    expect(isPlatformCapability("workspace.read")).toBe(false);
    expect(isPlatformCapability("")).toBe(false);
  });
});
