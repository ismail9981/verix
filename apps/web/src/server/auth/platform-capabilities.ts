import "server-only";

/** Platform authorization is independent of every Workspace role/capability. */
export const PLATFORM_ADMIN_ROLES = ["super_admin", "support_admin"] as const;
export type PlatformAdminRole = (typeof PLATFORM_ADMIN_ROLES)[number];

/** Closed Platform capability vocabulary approved for Sprint 2. */
export const PLATFORM_CAPABILITIES = [
  "platform.workspaces.read",
  "platform.workspaces.create",
  "platform.workspaces.assign_owner",
  "platform.workspaces.suspend",
  "platform.workspaces.activate",
  "platform.audit.read",
] as const;

export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

const NO_PLATFORM_CAPABILITIES = Object.freeze(
  [] as readonly PlatformCapability[],
);

/** Exact, deny-by-default Platform role matrix for Sprint 2. */
export const PLATFORM_ROLE_CAPABILITIES = Object.freeze({
  super_admin: Object.freeze([...PLATFORM_CAPABILITIES]),
  support_admin: NO_PLATFORM_CAPABILITIES,
}) satisfies Readonly<Record<PlatformAdminRole, readonly PlatformCapability[]>>;

const PLATFORM_CAPABILITY_SET = new Set<string>(PLATFORM_CAPABILITIES);

export function isPlatformAdminRole(role: string): role is PlatformAdminRole {
  return (PLATFORM_ADMIN_ROLES as readonly string[]).includes(role);
}

export function isPlatformCapability(
  capability: string,
): capability is PlatformCapability {
  return PLATFORM_CAPABILITY_SET.has(capability);
}

/**
 * Registry lookup only; this does not authorize a caller. The trusted
 * authorization boundary additionally requires a server-derived, branded
 * Platform context.
 */
export function capabilitiesForPlatformRole(
  role: string,
): readonly PlatformCapability[] {
  return isPlatformAdminRole(role)
    ? PLATFORM_ROLE_CAPABILITIES[role]
    : NO_PLATFORM_CAPABILITIES;
}

/** Suspended or structurally unknown identities always have zero capabilities. */
export function effectivePlatformCapabilities(identity: {
  readonly role: string;
  readonly status: string;
}): readonly PlatformCapability[] {
  return identity.status === "active"
    ? capabilitiesForPlatformRole(identity.role)
    : NO_PLATFORM_CAPABILITIES;
}
