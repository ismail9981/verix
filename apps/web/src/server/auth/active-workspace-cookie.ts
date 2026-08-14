import { createHmac, timingSafeEqual } from "node:crypto";

export const ACTIVE_WORKSPACE_COOKIE_NAME = "verix.active-workspace";
export const ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ActiveWorkspaceCookiePayload {
  readonly workspaceId: string;
  readonly expiresAt: number;
}

function requireSecret(secret: string | undefined): string {
  if (!secret || secret.length < 32) {
    throw new Error("ACTIVE_WORKSPACE_COOKIE_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", requireSecret(secret))
    .update(value)
    .digest("base64url");
}

export function signActiveWorkspaceCookie(
  workspaceId: string,
  secret: string | undefined,
  now = Date.now(),
): string {
  if (!UUID_PATTERN.test(workspaceId)) {
    throw new Error("Active Workspace selection must be a UUID.");
  }
  const expiresAt = Math.floor(now / 1000) + ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS;
  const payload = `v1.${workspaceId}.${expiresAt}`;
  return `${payload}.${signature(payload, requireSecret(secret))}`;
}

export function verifyActiveWorkspaceCookie(
  value: string | undefined,
  secret: string | undefined,
  now = Date.now(),
): ActiveWorkspaceCookiePayload | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, workspaceId, rawExpiry, suppliedSignature] = parts;
  if (!workspaceId || !UUID_PATTERN.test(workspaceId) || !suppliedSignature) return null;
  const expiresAt = Number(rawExpiry);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Math.floor(now / 1000)) return null;
  const payload = `v1.${workspaceId}.${expiresAt}`;
  let expected: string;
  try {
    expected = signature(payload, requireSecret(secret));
  } catch {
    return null;
  }
  const supplied = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (
    supplied.length !== expectedBuffer.length ||
    !timingSafeEqual(supplied, expectedBuffer)
  ) {
    return null;
  }
  return { workspaceId, expiresAt };
}

export const activeWorkspaceCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACTIVE_WORKSPACE_COOKIE_MAX_AGE_SECONDS,
};
