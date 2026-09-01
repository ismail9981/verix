import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePlatformCapability: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./platform-authorize", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./platform-authorize")>();
  return {
    ...original,
    requirePlatformCapability: mocks.requirePlatformCapability,
  };
});

import { PlatformAuthorizationError } from "./platform-authorize";
import { requirePlatformPageCapability } from "./platform-page-authorization";

const deniedActors = [
  ["unauthenticated", "UNAUTHENTICATED"],
  ["authenticated without memberships", "NOT_PLATFORM_ADMIN"],
  ["Workspace Owner", "NOT_PLATFORM_ADMIN"],
  ["Workspace Manager", "NOT_PLATFORM_ADMIN"],
  ["Workspace Employee", "NOT_PLATFORM_ADMIN"],
  ["active Support Admin", "PLATFORM_CAPABILITY_DENIED"],
  ["suspended Super Admin", "PLATFORM_ADMIN_SUSPENDED"],
] as const;

describe("C2 Platform Admin page authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(deniedActors)("hides /admin from %s", async (_actor, code) => {
    mocks.requirePlatformCapability.mockRejectedValue(
      new PlatformAuthorizationError(code),
    );
    await expect(
      requirePlatformPageCapability("platform.workspaces.read"),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it.each(["/admin", "/admin/workspaces"])(
    "allows direct URL %s only after the server capability gate succeeds",
    async () => {
      const context = {
        role: "super_admin",
        capabilities: ["platform.workspaces.read"],
      };
      mocks.requirePlatformCapability.mockResolvedValue(context);
      await expect(
        requirePlatformPageCapability("platform.workspaces.read"),
      ).resolves.toBe(context);
      expect(mocks.requirePlatformCapability).toHaveBeenCalledWith(
        "platform.workspaces.read",
      );
    },
  );

  it("does not convert infrastructure failures into authorization outcomes", async () => {
    const failure = new Error("database unavailable");
    mocks.requirePlatformCapability.mockRejectedValue(failure);
    await expect(
      requirePlatformPageCapability("platform.workspaces.read"),
    ).rejects.toBe(failure);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("accepts no client actor, role, membership, or Active Workspace input", () => {
    expect(requirePlatformPageCapability).toHaveLength(1);
  });
});
