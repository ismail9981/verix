import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../db/db", () => ({
  db: { query: { platformAdmins: { findFirst: mocks.findFirst } } },
}));
vi.mock("./session", () => ({ getCurrentUser: vi.fn() }));

import { resolvePlatformIdentity } from "./platform-identity";

const ids = {
  admin: "a1000000-0000-4000-8000-000000000001",
  auth: "a2000000-0000-4000-8000-000000000001",
  otherAuth: "a2000000-0000-4000-8000-000000000002",
} as const;

describe("C1 Platform identity resolver", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns UNAUTHENTICATED without touching the database", async () => {
    await expect(resolvePlatformIdentity(null)).resolves.toEqual({
      state: "UNAUTHENTICATED",
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("fails a malformed authenticated UUID closed", async () => {
    await expect(
      resolvePlatformIdentity({ id: "attacker-controlled-role" } as never),
    ).resolves.toEqual({ state: "NOT_PLATFORM_ADMIN" });
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("returns NOT_PLATFORM_ADMIN for an authenticated tenant without a row", async () => {
    mocks.findFirst.mockResolvedValue(undefined);
    await expect(
      resolvePlatformIdentity({ id: ids.auth } as never),
    ).resolves.toEqual({ state: "NOT_PLATFORM_ADMIN" });
    expect(mocks.findFirst).toHaveBeenCalledOnce();
  });

  it.each([
    ["active", "ACTIVE_PLATFORM_ADMIN"],
    ["suspended", "SUSPENDED_PLATFORM_ADMIN"],
  ] as const)(
    "resolves a %s admin by immutable Auth UUID",
    async (status, state) => {
      mocks.findFirst.mockResolvedValue({
        id: ids.admin,
        authUserId: ids.auth,
        role: "super_admin",
        status,
      });
      const result = await resolvePlatformIdentity({
        id: ids.auth,
        email: "ignored@tenant-controlled.example",
        user_metadata: { platform_role: "super_admin" },
      } as never);
      expect(result).toEqual({
        state,
        identity: {
          platformAdminId: ids.admin,
          authUserId: ids.auth,
          role: "super_admin",
          status,
        },
      });
      expect(result).not.toHaveProperty("email");
    },
  );

  it("rejects a mismatched Auth UUID even if a lookup adapter returns a row", async () => {
    mocks.findFirst.mockResolvedValue({
      id: ids.admin,
      authUserId: ids.otherAuth,
      role: "super_admin",
      status: "active",
    });
    await expect(
      resolvePlatformIdentity({
        id: ids.auth,
        email: "same-email@verix.local",
      } as never),
    ).resolves.toEqual({ state: "NOT_PLATFORM_ADMIN" });
  });

  it("fails closed on impossible role or status drift", async () => {
    mocks.findFirst.mockResolvedValue({
      id: ids.admin,
      authUserId: ids.auth,
      role: "owner",
      status: "active",
    });
    await expect(
      resolvePlatformIdentity({ id: ids.auth } as never),
    ).resolves.toEqual({ state: "NOT_PLATFORM_ADMIN" });

    mocks.findFirst.mockResolvedValue({
      id: ids.admin,
      authUserId: ids.auth,
      role: "super_admin",
      status: "deleted",
    });
    await expect(
      resolvePlatformIdentity({ id: ids.auth } as never),
    ).resolves.toEqual({ state: "NOT_PLATFORM_ADMIN" });
  });
});
