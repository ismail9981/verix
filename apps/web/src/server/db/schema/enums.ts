import { pgEnum } from "drizzle-orm/pg-core";

/*
 * Postgres enum types, shared across tables. Enums are used for closed,
 * low-cardinality value sets (statuses, roles, kinds) so the database itself
 * enforces valid values.
 */

/** Workspace subscription tier. */
export const planEnum = pgEnum("plan", ["starter", "pro", "business"]);

/** A member's permission level within a workspace. */
export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "manager",
  "employee",
]);

/** Lifecycle state of a workspace membership. */
export const memberStatusEnum = pgEnum("member_status", [
  "active",
  "invited",
  "suspended",
]);

/** Platform-wide administrative role, independent of workspace membership. */
export const platformAdminRoleEnum = pgEnum("platform_admin_role", [
  "super_admin",
  "support_admin",
]);

/** Revocation state for an immutable Platform Admin identity. */
export const platformAdminStatusEnum = pgEnum("platform_admin_status", [
  "active",
  "suspended",
]);

/** Lifecycle state of a tenant workspace. */
export const workspaceStatusEnum = pgEnum("workspace_status", [
  "active",
  "suspended",
]);

/** Trusted actor class recorded by the Platform Audit log. */
export const platformAuditActorKindEnum = pgEnum("platform_audit_actor_kind", [
  "platform_admin",
  "system_bootstrap",
]);

/** Closed Sprint 2 vocabulary for Platform Audit operations. */
export const platformAuditActionEnum = pgEnum("platform_audit_action", [
  "platform_admin.bootstrap_completed",
  "workspace.created",
  "workspace.owner_assigned",
  "workspace.suspended",
  "workspace.activated",
]);

/** Closed Sprint 2 vocabulary for Platform Audit target classes. */
export const platformAuditTargetTypeEnum = pgEnum(
  "platform_audit_target_type",
  ["platform_admin", "workspace"],
);

/** Result recorded for an attempted Platform operation. */
export const platformAuditOutcomeEnum = pgEnum("platform_audit_outcome", [
  "success",
  "failure",
]);

/** CRM customer segment. */
export const customerStatusEnum = pgEnum("customer_status", [
  "active",
  "new",
  "vip",
  "inactive",
]);

/** Availability of a bookable service. */
export const serviceStatusEnum = pgEnum("service_status", [
  "active",
  "draft",
  "inactive",
]);

/** Lifecycle of a booking/appointment. */
export const bookingStatusEnum = pgEnum("booking_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
]);

/** Settlement state of a payment. */
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

/** How a payment was taken. */
export const paymentMethodEnum = pgEnum("payment_method", [
  "card",
  "cash",
  "paypal",
  "bank_transfer",
]);

/**
 * Lifecycle of an invoice (Sprint 14 adds `written_off`). "Partially paid" is
 * deliberately NOT a stored status — it's `open` plus a nonzero-but-incomplete
 * balance derived from allocations, see `deriveInvoiceStatus`/`ensureInvoiceForReservation`
 * in the billing service. `paid -> void` is not a valid transition (a paid
 * invoice is closed history); reversing a paid invoice means recording a
 * refund or writing off the balance, not voiding.
 */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
  "written_off",
]);

/** Author of an AI chat message. */
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

/** Category of an in-app notification. */
export const notificationTypeEnum = pgEnum("notification_type", [
  "booking",
  "payment",
  "ai",
  "team",
  "system",
]);

/** Third-party integration provider. */
export const integrationProviderEnum = pgEnum("integration_provider", [
  "stripe",
  "google_calendar",
  "openai",
  "slack",
  "paypal",
]);

/** Connection state of an integration. */
export const integrationStatusEnum = pgEnum("integration_status", [
  "connected",
  "disconnected",
  "error",
]);

/** What an uploaded file is used for. */
export const filePurposeEnum = pgEnum("file_purpose", [
  "avatar",
  "logo",
  "cover",
  "attachment",
  "other",
]);

/** UI theme preference. */
export const themeEnum = pgEnum("theme", ["dark", "light", "system"]);

/** Lifecycle of a website-builder site. */
export const siteStatusEnum = pgEnum("site_status", [
  "draft",
  "published",
  "unpublished",
]);

/** Editing state of a page within a site. */
export const pageStatusEnum = pgEnum("page_status", ["draft", "ready"]);

/** Lifecycle of an immutable published site version. */
export const siteVersionStatusEnum = pgEnum("site_version_status", [
  "published",
  "superseded",
  "archived",
]);

/** How a domain is attached to a site. */
export const domainTypeEnum = pgEnum("domain_type", ["subdomain", "custom"]);

/** Verification/serving lifecycle of a domain. */
export const domainStatusEnum = pgEnum("domain_status", [
  "pending",
  "verified",
  "active",
  "failed",
]);

/** How a custom domain proves ownership. */
export const domainVerificationMethodEnum = pgEnum(
  "domain_verification_method",
  ["txt", "cname"],
);

/** Stored SSL readiness state (Sprint 7.2 records this only — no provider is wired up). */
export const sslStatusEnum = pgEnum("ssl_status", [
  "not_requested",
  "pending",
  "ready",
  "failed",
]);

/** Lifecycle of a public-form lead (Sprint 9). `converted` is reachable only via
 *  the lead→customer conversion flow, never a direct status update. */
export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "converted",
  "archived",
  "spam",
]);

/** Chip color for a pipeline stage (Sprint 10) — mirrors the dashboard `BadgeTone` vocabulary. */
export const crmStageToneEnum = pgEnum("crm_stage_tone", [
  "neutral",
  "info",
  "warning",
  "success",
  "danger",
  "accent",
]);

/**
 * Outcome of an opportunity (Sprint 10). Deliberately excludes "archived" —
 * archiving is tracked by the separate `archived_at` column so an archived
 * deal keeps its won/lost outcome for "won/lost this month" metrics.
 */
export const crmOpportunityStatusEnum = pgEnum("crm_opportunity_status", [
  "open",
  "won",
  "lost",
]);

/** Kind of CRM follow-up/timeline entry on an opportunity (Sprint 10). */
export const crmActivityTypeEnum = pgEnum("crm_activity_type", [
  "note",
  "call",
  "email",
  "meeting",
  "task",
  "status_change",
]);

/**
 * Lifecycle of a rental reservation (Sprint 11). `checked_out`, `cancelled`,
 * and `no_show` are terminal — see `isValidReservationStatusTransition` in
 * `validators/reservation.ts` for the full state machine. Only `cancelled`
 * and `no_show` are excluded from the overlap-prevention check.
 */
export const reservationStatusEnum = pgEnum("reservation_status", [
  "inquiry",
  "pending",
  "confirmed",
  "checked_in",
  "checked_out",
  "cancelled",
  "no_show",
]);

/** Kind of rentable unit (Sprint 11). */
export const rentalUnitTypeEnum = pgEnum("rental_unit_type", [
  "room",
  "apartment",
  "villa",
  "other",
]);

/** Where a reservation originated (Sprint 11). */
export const reservationSourceEnum = pgEnum("reservation_source", [
  "direct",
  "phone",
  "walk_in",
  "website",
  "other",
]);

/**
 * A manual override of a rental unit's operational condition (Sprint 12).
 * Null (no row value — see `rentalUnits.statusOverride`) means the unit's
 * displayed status is *derived* from live reservation state instead
 * (available/occupied/reserved — see `resolveUnitDisplayStatus` in
 * `validators/rental-unit.ts`). Only conditions with no reservation signal to
 * derive from are modeled here, and — once set — an override always takes
 * precedence over the derived state (a unit under maintenance is "under
 * maintenance" even if nobody has a reservation on it right now).
 */
export const rentalUnitConditionEnum = pgEnum("rental_unit_condition", [
  "cleaning",
  "maintenance",
  "out_of_service",
]);

/** Kind of housekeeping/unit-ops task (Sprint 13). */
export const housekeepingTaskTypeEnum = pgEnum("housekeeping_task_type", [
  "cleaning",
  "inspection",
  "maintenance",
  "linen_change",
  "restocking",
  "other",
]);

/**
 * Lifecycle of a housekeeping task (Sprint 13). `completed` and `cancelled`
 * are terminal — see `isValidHousekeepingStatusTransition` in
 * `validators/housekeeping.ts` for the full state machine.
 */
export const housekeepingTaskStatusEnum = pgEnum("housekeeping_task_status", [
  "pending",
  "assigned",
  "in_progress",
  "completed",
  "cancelled",
]);

/** Urgency of a housekeeping task (Sprint 13). */
export const housekeepingTaskPriorityEnum = pgEnum(
  "housekeeping_task_priority",
  ["low", "normal", "high", "urgent"],
);

/** Kind of invoice line (Sprint 14): the stay charge itself, an add-on fee, a
 *  tax line, or a discount. `discount` rows carry a negative `amountCents` —
 *  there is no separate sign column. */
export const invoiceLineItemTypeEnum = pgEnum("invoice_line_item_type", [
  "stay",
  "fee",
  "tax",
  "discount",
]);

/**
 * Ledger direction of a payment row (Sprint 14). Orthogonal to
 * `paymentStatusEnum`, which is the per-row processing state — `type` carries
 * the domain meaning. A refund is always a new row with `type = 'refund'`,
 * never an edit of the original charge (see `payments.refundedPaymentId` and
 * the `enforce_payment_immutability` trigger in `0014_billing.sql`).
 */
export const paymentTypeEnum = pgEnum("payment_type", ["charge", "refund"]);

/**
 * Derived, staff-facing summary of whether a reservation's bill is settled
 * (Sprint 14). Written by `syncReservationPaymentStatus` from the sum of that
 * reservation's invoice's active payments vs its total — never set directly.
 */
export const reservationPaymentStatusEnum = pgEnum(
  "reservation_payment_status",
  ["unpaid", "partially_paid", "paid"],
);
