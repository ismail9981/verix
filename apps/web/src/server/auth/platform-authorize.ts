import "server-only";

import {
  effectivePlatformCapabilities,
  isPlatformCapability,
  type PlatformCapability,
} from "./platform-capabilities";
import {
  getPlatformIdentityResolution,
  type PlatformAdminIdentity,
} from "./platform-identity";

export type PlatformAuthorizationErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_PLATFORM_ADMIN"
  | "PLATFORM_ADMIN_SUSPENDED"
  | "PLATFORM_CAPABILITY_DENIED";

export class PlatformAuthorizationError extends Error {
  constructor(readonly code: PlatformAuthorizationErrorCode) {
    super("Platform authorization denied.");
    this.name = "PlatformAuthorizationError";
  }
}

const PLATFORM_CONTEXT_BRAND: unique symbol = Symbol("PlatformActorContext");
const trustedPlatformContexts = new WeakSet<object>();

/** Opaque server-derived context. No public factory or serializable claim exists. */
export interface ActivePlatformAdminContext extends Omit<
  PlatformAdminIdentity,
  "status"
> {
  readonly status: "active";
  readonly capabilities: readonly PlatformCapability[];
  readonly [PLATFORM_CONTEXT_BRAND]: true;
}

function activeContext(
  identity: PlatformAdminIdentity & { readonly status: "active" },
): ActivePlatformAdminContext {
  const context = Object.freeze({
    platformAdminId: identity.platformAdminId,
    authUserId: identity.authUserId,
    role: identity.role,
    status: identity.status,
    capabilities: effectivePlatformCapabilities(identity),
    [PLATFORM_CONTEXT_BRAND]: true as const,
  });
  trustedPlatformContexts.add(context);
  return context;
}

/** Recognizes any stored Platform Admin, including a suspended identity. */
export async function requirePlatformAdminIdentity(): Promise<PlatformAdminIdentity> {
  const resolution = await getPlatformIdentityResolution();
  if (resolution.state === "UNAUTHENTICATED") {
    throw new PlatformAuthorizationError("UNAUTHENTICATED");
  }
  if (resolution.state === "NOT_PLATFORM_ADMIN") {
    throw new PlatformAuthorizationError("NOT_PLATFORM_ADMIN");
  }
  return resolution.identity;
}

/** Requires an independently stored, active Platform Admin identity. */
export async function requireActivePlatformAdmin(): Promise<ActivePlatformAdminContext> {
  const resolution = await getPlatformIdentityResolution();
  if (resolution.state === "UNAUTHENTICATED") {
    throw new PlatformAuthorizationError("UNAUTHENTICATED");
  }
  if (resolution.state === "NOT_PLATFORM_ADMIN") {
    throw new PlatformAuthorizationError("NOT_PLATFORM_ADMIN");
  }
  if (resolution.state === "SUSPENDED_PLATFORM_ADMIN") {
    throw new PlatformAuthorizationError("PLATFORM_ADMIN_SUSPENDED");
  }
  return activeContext(resolution.identity);
}

/** A forged role/id object can never satisfy this runtime check. */
export function hasPlatformCapability(
  context: unknown,
  capability: string,
): context is ActivePlatformAdminContext {
  if (
    typeof context !== "object" ||
    context === null ||
    !trustedPlatformContexts.has(context) ||
    !isPlatformCapability(capability)
  ) {
    return false;
  }
  return (context as ActivePlatformAdminContext).capabilities.includes(
    capability,
  );
}

/** Service-layer defense in depth for a context already derived by this module. */
export function assertPlatformCapability(
  context: unknown,
  capability: PlatformCapability,
): asserts context is ActivePlatformAdminContext {
  if (!hasPlatformCapability(context, capability)) {
    throw new PlatformAuthorizationError("PLATFORM_CAPABILITY_DENIED");
  }
}

/** Canonical Platform action/page/service entry boundary. */
export async function requirePlatformCapability(
  capability: PlatformCapability,
): Promise<ActivePlatformAdminContext> {
  const context = await requireActivePlatformAdmin();
  if (!hasPlatformCapability(context, capability)) {
    throw new PlatformAuthorizationError("PLATFORM_CAPABILITY_DENIED");
  }
  return context;
}
