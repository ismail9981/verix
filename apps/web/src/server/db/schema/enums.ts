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

/** Lifecycle of an invoice. */
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "open",
  "paid",
  "void",
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
