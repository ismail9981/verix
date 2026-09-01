import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getResolution: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("./platform-identity", () => ({
  getPlatformIdentityResolution: mocks.getResolution,
}));

import { requireActivePlatformAdmin } from "./platform-authorize";
import { platformNavigationFor } from "./platform-navigation";

const identity = {
  platformAdminId: "c2100000-0000-4000-8000-000000000001",
  authUserId: "c2200000-0000-4000-8000-000000000001",
  status: "active" as const,
};

describe("C2 Platform Admin capability-derived navigation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows only implemented items authorized for an active Super Admin", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "ACTIVE_PLATFORM_ADMIN",
      identity: { ...identity, role: "super_admin" },
    });
    const context = await requireActivePlatformAdmin();
    expect(platformNavigationFor(context)).toEqual([
      { label: "Overview", href: "/admin" },
      { label: "Workspaces", href: "/admin/workspaces" },
    ]);
  });

  it("shows no navigation for active Support Admin zero-capability context", async () => {
    mocks.getResolution.mockResolvedValue({
      state: "ACTIVE_PLATFORM_ADMIN",
      identity: { ...identity, role: "support_admin" },
    });
    expect(platformNavigationFor(await requireActivePlatformAdmin())).toEqual(
      [],
    );
  });

  it.each(["owner", "manager", "employee", "super_admin"])(
    "rejects a client-forged %s role/navigation context",
    (role) => {
      expect(
        platformNavigationFor({
          role,
          status: "active",
          capabilities: ["platform.workspaces.read"],
          activeWorkspaceId: "attacker-workspace",
        }),
      ).toEqual([]);
    },
  );
});
