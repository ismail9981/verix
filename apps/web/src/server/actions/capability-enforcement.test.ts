import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthorizedWorkspace: vi.fn(),
  revalidatePath: vi.fn(),
  updateMember: vi.fn(),
  recordPayment: vi.fn(),
  createDomain: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../auth/workspace", () => ({
  getAuthorizedWorkspace: mocks.getAuthorizedWorkspace,
}));
vi.mock("../observability/request-context", () => ({
  getRequestId: vi.fn(async () => "request-b6"),
  logActionError: vi.fn(),
}));
vi.mock("../services/team.service", () => ({
  inviteMember: vi.fn(),
  removeMember: vi.fn(),
  updateMember: mocks.updateMember,
}));
vi.mock("../services/invoice.service", () => ({
  createInvoiceForReservation: vi.fn(),
  recordPayment: mocks.recordPayment,
  recordRefund: vi.fn(),
  voidPayment: vi.fn(),
}));
vi.mock("../services/domain.service", () => ({
  DUPLICATE_DOMAIN_ERROR: "DUPLICATE_DOMAIN",
  createDomain: mocks.createDomain,
  deleteDomain: vi.fn(),
  setPrimaryDomain: vi.fn(),
}));
vi.mock("../services/domain-verification.service", () => ({
  DomainVerificationError: class DomainVerificationError extends Error {},
  regenerateVerificationToken: vi.fn(),
  verifyDomain: vi.fn(),
}));

import { refreshAnalyticsAction } from "./analytics";
import { createDomainAction } from "./domain";
import { recordPaymentAction } from "./invoice";
import { updateMemberAction } from "./team";

function context(role: string) {
  return {
    workspaceId: "workspace-a",
    userId: "user-a",
    membershipId: "member-a",
    authUserId: "auth-a",
    selectionSource: "signed_cookie" as const,
    role,
  };
}

describe("B6 direct Server Action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an employee invoking a financial action before validation or service access", async () => {
    mocks.getAuthorizedWorkspace.mockResolvedValue(context("employee"));
    await expect(
      recordPaymentAction("invoice-a", new FormData()),
    ).rejects.toMatchObject({
      name: "AuthorizationError",
    });
    expect(mocks.recordPayment).not.toHaveBeenCalled();
  });

  it("rejects a manager role-escalation action and returns the controlled action result", async () => {
    mocks.getAuthorizedWorkspace.mockResolvedValue(context("manager"));
    await expect(
      updateMemberAction("member-b", new FormData()),
    ).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.updateMember).not.toHaveBeenCalled();
  });

  it("rejects Platform-only domain management even for a Workspace owner", async () => {
    mocks.getAuthorizedWorkspace.mockResolvedValue(context("owner"));
    await expect(createDomainAction(new FormData())).rejects.toMatchObject({
      name: "AuthorizationError",
    });
    expect(mocks.createDomain).not.toHaveBeenCalled();
  });

  it("rejects employee analytics refresh and allows an approved manager", async () => {
    mocks.getAuthorizedWorkspace.mockResolvedValueOnce(context("employee"));
    await expect(refreshAnalyticsAction()).rejects.toMatchObject({
      name: "AuthorizationError",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();

    mocks.getAuthorizedWorkspace.mockResolvedValueOnce(context("manager"));
    await expect(refreshAnalyticsAction()).resolves.toMatchObject({
      status: "success",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/analytics");
  });
});
