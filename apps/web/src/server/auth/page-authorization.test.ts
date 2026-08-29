import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActiveWorkspaceCapability: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("./authorize", () => ({
  requireActiveWorkspaceCapability: mocks.requireActiveWorkspaceCapability,
}));

import { AuthorizationError } from "./capabilities";
import { requirePageCapability } from "./page-authorization";

describe("B6 page authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps a capability denial to the controlled not-found boundary", async () => {
    mocks.requireActiveWorkspaceCapability.mockRejectedValue(
      new AuthorizationError(),
    );
    await expect(requirePageCapability("payments.read")).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("returns the validated Active Workspace context when allowed", async () => {
    const context = { workspaceId: "workspace-a", role: "manager" };
    mocks.requireActiveWorkspaceCapability.mockResolvedValue(context);
    await expect(requirePageCapability("payments.read")).resolves.toBe(context);
  });
});
