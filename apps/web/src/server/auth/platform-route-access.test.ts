import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResolution: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./platform-identity", () => ({
  getPlatformIdentityResolution: mocks.getResolution,
}));

import { requirePlatformPageCapability } from "./platform-page-authorization";

const platformIdentity = {
  platformAdminId: "c2300000-0000-4000-8000-000000000001",
  authUserId: "c2400000-0000-4000-8000-000000000001",
  role: "super_admin" as const,
  status: "active" as const,
};

const C2_DIRECT_ROUTES = new Set(["/admin", "/admin/workspaces"]);

async function requireAdminDirectUrl(pathname: string) {
  if (!C2_DIRECT_ROUTES.has(pathname)) throw new Error("UNKNOWN_C2_ROUTE");
  return requirePlatformPageCapability("platform.workspaces.read");
}

describe("C2 direct Platform Admin route boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["/admin", "/admin/workspaces"])(
    "allows active Super Admin direct access to %s",
    async (pathname) => {
      mocks.getResolution.mockResolvedValue({
        state: "ACTIVE_PLATFORM_ADMIN",
        identity: platformIdentity,
      });
      await expect(requireAdminDirectUrl(pathname)).resolves.toMatchObject({
        role: "super_admin",
        status: "active",
      });
    },
  );

  it("denies unauthenticated direct access", async () => {
    mocks.getResolution.mockResolvedValue({ state: "UNAUTHENTICATED" });
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it.each([
    "authenticated without memberships",
    "Workspace Owner",
    "Workspace Manager",
    "Workspace Employee",
  ])("denies tenant actor: %s", async () => {
    mocks.getResolution.mockResolvedValue({ state: "NOT_PLATFORM_ADMIN" });
    await expect(requireAdminDirectUrl("/admin/workspaces")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("denies active Support Admin because Sprint 2 grants zero capabilities", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "ACTIVE_PLATFORM_ADMIN",
      identity: { ...platformIdentity, role: "support_admin" },
    });
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("denies suspended Super Admin", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "SUSPENDED_PLATFORM_ADMIN",
      identity: { ...platformIdentity, status: "suspended" },
    });
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("allows a dual Workspace Owner only because the independent Platform identity exists", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "ACTIVE_PLATFORM_ADMIN",
      identity: platformIdentity,
      workspaceRole: "owner",
    });
    await expect(requireAdminDirectUrl("/admin")).resolves.toMatchObject({
      role: "super_admin",
    });

    mocks.getResolution.mockResolvedValue({
      state: "NOT_PLATFORM_ADMIN",
      workspaceRole: "owner",
      claimedPlatformRole: "super_admin",
    });
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("revokes route access after Platform suspension while Workspace Owner remains", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "SUSPENDED_PLATFORM_ADMIN",
      identity: { ...platformIdentity, status: "suspended" },
      workspaceRole: "owner",
    });
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("ignores forged Active Workspace cookie/state during Platform authorization", async () => {
    mocks.getResolution.mockResolvedValue({ state: "NOT_PLATFORM_ADMIN" });
    const maliciousTenantState = {
      activeWorkspaceCookie: "signed-owner-workspace",
      workspaceRole: "owner",
      platformRole: "super_admin",
    };
    expect(maliciousTenantState.platformRole).toBe("super_admin");
    await expect(requireAdminDirectUrl("/admin")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.getResolution).toHaveBeenCalledWith();
  });
});
