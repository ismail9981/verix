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
