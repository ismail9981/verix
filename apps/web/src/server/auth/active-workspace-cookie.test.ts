import { describe, expect, it } from "vitest";
import {
  ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
  signActiveWorkspaceCookie,
  verifyActiveWorkspaceCookie,
} from "./active-workspace-cookie";

const secret = "b5-test-secret-with-at-least-thirty-two-characters";
const workspaceId = "61000000-0000-4000-8000-000000000001";

describe("Active Workspace signed cookie", () => {
  it("round-trips a UUID with a bounded expiry", () => {
    const now = Date.UTC(2026, 7, 12);
    const value = signActiveWorkspaceCookie(workspaceId, secret, now);
    expect(verifyActiveWorkspaceCookie(value, secret, now)).toEqual({
      workspaceId,
      expiresAt: Math.floor(now / 1000) + ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it("rejects tampering, another secret, expiry, malformed data, and a weak secret", () => {
    const now = Date.UTC(2026, 7, 12);
    const value = signActiveWorkspaceCookie(workspaceId, secret, now);
    expect(verifyActiveWorkspaceCookie(`${value}x`, secret, now)).toBeNull();
    expect(verifyActiveWorkspaceCookie(value, `${secret}-different`, now)).toBeNull();
    expect(
      verifyActiveWorkspaceCookie(
        value,
        secret,
        now + (ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS + 1) * 1000,
      ),
    ).toBeNull();
    expect(verifyActiveWorkspaceCookie("not-a-cookie", secret, now)).toBeNull();
    expect(() => signActiveWorkspaceCookie(workspaceId, "weak", now)).toThrow(
      "at least 32 characters",
    );
  });
});

