import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getResolution: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./platform-identity", () => ({
  getPlatformIdentityResolution: mocks.getResolution,
}));

import { PLATFORM_CAPABILITIES } from "./platform-capabilities";
import {
  PlatformAuthorizationError,
  assertPlatformCapability,
  hasPlatformCapability,
  requireActivePlatformAdmin,
  requirePlatformAdminIdentity,
  requirePlatformCapability,
} from "./platform-authorize";

const baseIdentity = {
  platformAdminId: "b1000000-0000-4000-8000-000000000001",
  authUserId: "b2000000-0000-4000-8000-000000000001",
} as const;

function active(role: "super_admin" | "support_admin") {
  return {
    state: "ACTIVE_PLATFORM_ADMIN" as const,
    identity: { ...baseIdentity, role, status: "active" as const },
  };
}

function suspended(role: "super_admin" | "support_admin") {
  return {
    state: "SUSPENDED_PLATFORM_ADMIN" as const,
    identity: { ...baseIdentity, role, status: "suspended" as const },
  };
}

describe("C1 Platform authorization boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies unauthenticated requests", async () => {
    mocks.getResolution.mockResolvedValue({ state: "UNAUTHENTICATED" });
    await expect(requirePlatformAdminIdentity()).rejects.toMatchObject({
      name: "PlatformAuthorizationError",
      code: "UNAUTHENTICATED",
    });
    await expect(requireActivePlatformAdmin()).rejects.toBeInstanceOf(
      PlatformAuthorizationError,
    );
  });

  it.each(["no memberships", "owner", "manager", "employee"])(
    "denies an authenticated tenant actor (%s)",
    async () => {
      mocks.getResolution.mockResolvedValue({ state: "NOT_PLATFORM_ADMIN" });
      await expect(
        requirePlatformCapability("platform.workspaces.read"),
      ).rejects.toMatchObject({ code: "NOT_PLATFORM_ADMIN" });
    },
  );

  it("recognizes support_admin identity but grants it zero capabilities", async () => {
    mocks.getResolution.mockResolvedValue(active("support_admin"));
    await expect(requirePlatformAdminIdentity()).resolves.toMatchObject({
      role: "support_admin",
      status: "active",
    });
    const context = await requireActivePlatformAdmin();
    expect(context.capabilities).toEqual([]);

    for (const capability of PLATFORM_CAPABILITIES) {
      mocks.getResolution.mockResolvedValue(active("support_admin"));
      await expect(requirePlatformCapability(capability)).rejects.toMatchObject(
        {
          code: "PLATFORM_CAPABILITY_DENIED",
        },
      );
    }
  });

  it.each(["support_admin", "super_admin"] as const)(
    "denies every suspended %s operation",
    async (role) => {
      mocks.getResolution.mockResolvedValue(suspended(role));
      await expect(requireActivePlatformAdmin()).rejects.toMatchObject({
        code: "PLATFORM_ADMIN_SUSPENDED",
      });
      mocks.getResolution.mockResolvedValue(suspended(role));
      await expect(
        requirePlatformCapability("platform.workspaces.read"),
      ).rejects.toMatchObject({ code: "PLATFORM_ADMIN_SUSPENDED" });
    },
  );

  it("allows an active super_admin exactly the registered capabilities", async () => {
    for (const capability of PLATFORM_CAPABILITIES) {
      mocks.getResolution.mockResolvedValue(active("super_admin"));
      const context = await requirePlatformCapability(capability);
      expect(context.role).toBe("super_admin");
      expect(hasPlatformCapability(context, capability)).toBe(true);
    }
  });

  it("fails an unknown capability closed even for an active super_admin", async () => {
    mocks.getResolution.mockResolvedValue(active("super_admin"));
    await expect(
      (requirePlatformCapability as (value: string) => Promise<unknown>)(
        "platform.stores.read",
      ),
    ).rejects.toMatchObject({ code: "PLATFORM_CAPABILITY_DENIED" });
  });

  it("rejects forged Platform id, role, status, and capability claims", () => {
    const forged = {
      platformAdminId: baseIdentity.platformAdminId,
      authUserId: baseIdentity.authUserId,
      role: "super_admin",
      status: "active",
      capabilities: PLATFORM_CAPABILITIES,
    };
    expect(hasPlatformCapability(forged, "platform.workspaces.read")).toBe(
      false,
    );
    expect(() =>
      assertPlatformCapability(forged, "platform.workspaces.read"),
    ).toThrow(PlatformAuthorizationError);
  });

  it("derives Platform permission only from platform_admins for a dual-role user", async () => {
    mocks.getResolution.mockResolvedValue({
      ...active("super_admin"),
      workspaceRole: "owner",
    });
    await expect(
      requirePlatformCapability("platform.workspaces.create"),
    ).resolves.toMatchObject({ role: "super_admin" });

    mocks.getResolution.mockResolvedValue({
      state: "NOT_PLATFORM_ADMIN",
      workspaceRole: "owner",
      claimedPlatformRole: "super_admin",
    });
    await expect(
      requirePlatformCapability("platform.workspaces.create"),
    ).rejects.toMatchObject({ code: "NOT_PLATFORM_ADMIN" });
  });

  it("exposes no caller-supplied actor/id/role parameter on trusted resolvers", () => {
    expect(requirePlatformAdminIdentity).toHaveLength(0);
    expect(requireActivePlatformAdmin).toHaveLength(0);
    expect(requirePlatformCapability).toHaveLength(1);
  });
});
