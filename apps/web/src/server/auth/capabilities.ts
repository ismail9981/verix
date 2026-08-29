/**
 * The single Sprint 1 Workspace authorization vocabulary and role mapping.
 *
 * RLS proves active tenant membership and Active Workspace chooses the tenant.
 * This module answers the separate question: what may that membership role do
 * inside the already-validated Active Workspace?
 */

export const WORKSPACE_ROLES = ["owner", "manager", "employee"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const CAPABILITIES = [
  "workspace.read",
  "workspace.settings.read",
  "workspace.settings.update",
  "workspace.members.read",
  "workspace.members.invite",
  "workspace.members.update",
  "workspace.members.remove",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.archive",
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.archive",
  "crm.pipeline.read",
  "crm.pipeline.manage",
  "crm.pipeline.delete",
  "services.read",
  "services.manage",
  "bookings.read",
  "bookings.manage",
  "bookings.assign",
  "properties.read",
  "properties.manage",
  "properties.archive",
  "rental_units.read",
  "rental_units.manage",
  "rental_units.delete",
  "reservations.read",
  "reservations.manage",
  "reservations.assign",
  "housekeeping.read",
  "housekeeping.manage",
  "housekeeping.assign",
  "invoices.read",
  "invoices.manage",
  "payments.read",
  "payments.manage",
  "refunds.manage",
  "reports.operational.read",
  "reports.financial.read",
  "website.content.read",
  "website.content.update",
  "website.design.manage",
  "website.publish",
  "website.domain.manage",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const OWNER_CAPABILITIES = CAPABILITIES.filter(
  (capability) => !capability.startsWith("website."),
);

const MANAGER_CAPABILITIES = [
  "workspace.read",
  "workspace.settings.read",
  "workspace.members.read",
  "customers.read",
  "customers.create",
  "customers.update",
  "customers.archive",
  "leads.read",
  "leads.create",
  "leads.update",
  "leads.archive",
  "crm.pipeline.read",
  "crm.pipeline.manage",
  "services.read",
  "services.manage",
  "bookings.read",
  "bookings.manage",
  "bookings.assign",
  "properties.read",
  "properties.manage",
  "rental_units.read",
  "rental_units.manage",
  "reservations.read",
  "reservations.manage",
  "reservations.assign",
  "housekeeping.read",
  "housekeeping.manage",
  "housekeeping.assign",
  "invoices.read",
  "invoices.manage",
  "payments.read",
  "payments.manage",
  "refunds.manage",
  "reports.operational.read",
  "reports.financial.read",
] as const satisfies readonly Capability[];

const EMPLOYEE_CAPABILITIES = [
  "workspace.read",
  "crm.pipeline.read",
  "services.read",
  "bookings.read",
  "properties.read",
  "rental_units.read",
  "reservations.read",
  "reservations.manage",
  "housekeeping.read",
  "housekeeping.manage",
  "reports.operational.read",
] as const satisfies readonly Capability[];

/** Exactly one authoritative role-to-capability mapping for Workspace roles. */
export const ROLE_CAPABILITIES = Object.freeze({
  owner: Object.freeze(OWNER_CAPABILITIES),
  manager: Object.freeze(MANAGER_CAPABILITIES),
  employee: Object.freeze(EMPLOYEE_CAPABILITIES),
}) satisfies Readonly<Record<WorkspaceRole, readonly Capability[]>>;

const CAPABILITY_SET = new Set<string>(CAPABILITIES);

export class AuthorizationError extends Error {
  constructor(message = "You don't have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return (WORKSPACE_ROLES as readonly string[]).includes(role);
}

export function capabilitiesForRole(role: string): readonly Capability[] {
  return isWorkspaceRole(role) ? ROLE_CAPABILITIES[role] : [];
}

export function hasCapability(
  context: { readonly role: string },
  capability: string,
): boolean {
  if (!CAPABILITY_SET.has(capability) || !isWorkspaceRole(context.role))
    return false;
  return (ROLE_CAPABILITIES[context.role] as readonly Capability[]).includes(
    capability as Capability,
  );
}

export function requireCapability(
  context: { readonly role: string },
  capability: Capability,
): void {
  if (!hasCapability(context, capability)) throw new AuthorizationError();
}
