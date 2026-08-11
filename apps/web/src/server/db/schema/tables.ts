import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { primaryId, softDelete, timestamps } from "./columns";
import {
  bookingStatusEnum,
  crmActivityTypeEnum,
  crmOpportunityStatusEnum,
  crmStageToneEnum,
  customerStatusEnum,
  filePurposeEnum,
  integrationProviderEnum,
  integrationStatusEnum,
  invoiceLineItemTypeEnum,
  invoiceStatusEnum,
  memberRoleEnum,
  memberStatusEnum,
  messageRoleEnum,
  notificationTypeEnum,
  pageStatusEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  paymentTypeEnum,
  domainStatusEnum,
  domainTypeEnum,
  domainVerificationMethodEnum,
  housekeepingTaskPriorityEnum,
  housekeepingTaskStatusEnum,
  housekeepingTaskTypeEnum,
  leadStatusEnum,
  planEnum,
  rentalUnitConditionEnum,
  rentalUnitTypeEnum,
  reservationPaymentStatusEnum,
  reservationSourceEnum,
  reservationStatusEnum,
  serviceStatusEnum,
  siteStatusEnum,
  siteVersionStatusEnum,
  sslStatusEnum,
  themeEnum,
} from "./enums";

/*
 * All application tables. Ordered so that a table only references tables
 * declared above it, keeping the foreign-key graph acyclic.
 *
 * Tenancy model: `workspaces` is the tenant root. Almost every row carries a
 * `workspace_id` with `onDelete: cascade`, so removing a workspace cleanly
 * removes all of its data.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** A person with an account (mirrors a Supabase auth user). */
export const users = pgTable("users", {
  id: primaryId(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  emailVerified: boolean("email_verified").notNull().default(false),
  ...timestamps(),
  ...softDelete(),
});

/** A tenant: one business account that owns all of its data. */
export const workspaces = pgTable(
  "workspaces",
  {
    id: primaryId(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    email: text("email"),
    phone: text("phone"),
    website: text("website"),
    plan: planEnum("plan").notNull().default("starter"),
    timezone: text("timezone").notNull().default("america-los_angeles"),
    // ISO 4217, uppercase (e.g. "USD") — backed by a CHECK constraint, see
    // `0014_billing.sql`. Sprint 14 canonicalized every currency column in the
    // schema to this shape; pre-Sprint-14 rows were backfilled in that migration.
    currency: text("currency").notNull().default("USD"),
    language: text("language").notNull().default("en-us"),
    logoUrl: text("logo_url"),
    coverImageUrl: text("cover_image_url"),
    accentColor: text("accent_color").notNull().default("#6D5EF9"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index("workspaces_owner_idx").on(t.ownerId),
    check("workspaces_currency_iso_ck", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/** Join of a user to a workspace with a role — a workspace's team. */
export const teamMembers = pgTable(
  "team_members",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("employee"),
    status: memberStatusEnum("status").notNull().default("active"),
    title: text("title"),
    phone: text("phone"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("team_members_workspace_user_uq").on(t.workspaceId, t.userId),
    unique("team_members_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("team_members_workspace_idx").on(t.workspaceId),
    index("team_members_user_idx").on(t.userId),
  ],
);

// ---------------------------------------------------------------------------
// CRM & catalog
// ---------------------------------------------------------------------------

/** A customer/contact belonging to a workspace. */
export const customers = pgTable(
  "customers",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phone: text("phone"),
    status: customerStatusEnum("status").notNull().default("new"),
    totalSpentCents: integer("total_spent_cents").notNull().default(0),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("customers_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("customers_workspace_idx").on(t.workspaceId),
    index("customers_email_idx").on(t.email),
    index("customers_status_idx").on(t.status),
  ],
);

/** A bookable service offered by a workspace. */
export const services = pgTable(
  "services",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    priceCents: integer("price_cents").notNull().default(0),
    status: serviceStatusEnum("status").notNull().default("active"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("services_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("services_workspace_idx").on(t.workspaceId),
  ],
);

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------

/** An appointment linking a customer, a service, and (optionally) staff. */
export const bookings = pgTable(
  "bookings",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id),
    staffId: uuid("staff_id").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    status: bookingStatusEnum("status").notNull().default("pending"),
    paymentStatus: paymentStatusEnum("payment_status")
      .notNull()
      .default("pending"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("bookings_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "bookings_customer_workspace_fk",
      columns: [t.workspaceId, t.customerId],
      foreignColumns: [customers.workspaceId, customers.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "bookings_service_workspace_fk",
      columns: [t.workspaceId, t.serviceId],
      foreignColumns: [services.workspaceId, services.id],
    }),
    index("bookings_workspace_idx").on(t.workspaceId),
    index("bookings_customer_idx").on(t.customerId),
    index("bookings_service_idx").on(t.serviceId),
    index("bookings_staff_idx").on(t.staffId),
    index("bookings_starts_at_idx").on(t.startsAt),
    index("bookings_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

/**
 * An invoice issued to a customer. Financial record — no soft delete; a
 * cancelled bill is `void`, an uncollectible one is `written_off` (Sprint 14)
 * — both are terminal statuses, not row deletions.
 *
 * Sprint 14 (Billing & Payments) added `reservationId` plus the audit-snapshot
 * columns below to wire the previously-dormant invoices/payments tables to
 * the Reservations domain. `reservationId` references `reservations`, which
 * is declared further down this file — an intentional exception to the
 * "only reference tables above" ordering convention: `invoices` predates
 * Reservations by many sprints, and Drizzle's `references(() => table.column)`
 * callback is a lazily-evaluated closure, so declaration order within this
 * module has no effect on correctness. Moving the whole Billing section below
 * Reservations to preserve the ordering convention would be a large,
 * unrelated reorder for no functional benefit.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    /** Set when this invoice bills a reservation stay (Sprint 14). `restrict`
     *  — a financial record must never silently vanish because its
     *  reservation row was removed (reservations only soft-delete anyway). */
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "restrict",
    }),
    number: text("number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    /** Server-computed sum of this invoice's `invoiceLineItems.amountCents` —
     *  never accepted from the client, never independently entered. */
    amountCents: integer("amount_cents").notNull().default(0),
    // ISO 4217, uppercase — see the identical note on `workspaces.currency`.
    // Frozen at invoice creation from the workspace's/reservation's currency.
    currency: text("currency").notNull().default("USD"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    /** Stamped by `issueInvoice` (draft -> open) so a later rename/edit of the
     *  customer, unit, or reservation dates never rewrites what an
     *  already-issued bill displayed. Line items are locked from further
     *  mutation at the same moment (see `enforce_invoice_line_items_draft_only`
     *  trigger in `0014_billing.sql`), so `amountCents` is equally frozen. */
    customerNameSnapshot: text("customer_name_snapshot"),
    customerEmailSnapshot: text("customer_email_snapshot"),
    propertyNameSnapshot: text("property_name_snapshot"),
    buildingNameSnapshot: text("building_name_snapshot"),
    unitNameSnapshot: text("unit_name_snapshot"),
    checkInDateSnapshot: date("check_in_date_snapshot", { mode: "string" }),
    checkOutDateSnapshot: date("check_out_date_snapshot", { mode: "string" }),
    /** Void/write-off audit trail — who closed this invoice's balance and
     *  when/why. Only one of the two pairs is ever set for a given invoice. */
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    writtenOffAt: timestamp("written_off_at", { withTimezone: true }),
    writtenOffBy: uuid("written_off_by").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...timestamps(),
  },
  (t) => [
    unique("invoices_workspace_id_id_uq").on(t.workspaceId, t.id),
    unique("invoices_workspace_number_uq").on(t.workspaceId, t.number),
    index("invoices_workspace_idx").on(t.workspaceId),
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_reservation_idx").on(t.reservationId),
    index("invoices_status_idx").on(t.status),
    // At most one active (non-void) invoice per reservation — the DB-level
    // guarantee behind `ensureInvoiceForReservation`'s idempotent upsert.
    // Voiding an invoice frees the slot for a corrected replacement; a
    // written-off invoice still counts as active (it billed a real stay,
    // just one the business gave up collecting on).
    uniqueIndex("invoices_reservation_active_uq")
      .on(t.reservationId)
      .where(sql`reservation_id is not null and status <> 'void'`),
    check("invoices_currency_iso_ck", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    // Internal consistency of the lifecycle/audit columns — a single row's
    // own values. Only the timestamp half of each audit pair is required;
    // the "_by" actor columns are `ON DELETE SET NULL` FKs, so requiring
    // them NOT NULL here would create a constraint a team-member removal
    // could violate.
    check(
      "invoices_issued_at_ck",
      sql`${t.status} = 'draft' or ${t.issuedAt} is not null`,
    ),
    check(
      "invoices_void_audit_ck",
      sql`${t.status} <> 'void' or ${t.voidedAt} is not null`,
    ),
    check(
      "invoices_written_off_audit_ck",
      sql`${t.status} <> 'written_off' or ${t.writtenOffAt} is not null`,
    ),
    check(
      "invoices_audit_exclusive_ck",
      sql`not (${t.voidedAt} is not null and ${t.writtenOffAt} is not null)`,
    ),
    // Fix (independent review, B4): the total is server-computed from line
    // items and must never go negative — the primary rejection point is the
    // `sync_invoice_amount_from_line_items` trigger; this is the backstop.
    check("invoices_amount_non_negative_ck", sql`${t.amountCents} >= 0`),
  ],
);

/**
 * A payment (or refund) transaction. Supports soft delete so mistaken entries
 * can be corrected without losing the row. Two independent, mutually-exclusive
 * legs share this one table: booking-payments (`bookingId` set, `invoiceId`
 * null — the original, untouched-by-Sprint-14 behavior) and reservation
 * billing (`invoiceId` set, `bookingId` null, added Sprint 14).
 */
export const payments = pgTable(
  "payments",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    bookingId: uuid("booking_id").references(() => bookings.id, {
      onDelete: "set null",
    }),
    invoiceId: uuid("invoice_id").references(() => invoices.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    // ISO 4217, uppercase — see the identical note on `workspaces.currency`.
    currency: text("currency").notNull().default("USD"),
    method: paymentMethodEnum("method").notNull().default("card"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    /** Ledger direction (Sprint 14) — orthogonal to `status`. Every
     *  invoice-linked row (`invoiceId` not null) is immutable once inserted
     *  (see `enforce_payment_immutability` trigger); a refund is always a
     *  new row, never an edit of the original charge. Legacy booking-payments
     *  (`bookingId` set) are unaffected and keep editing `status` directly,
     *  including to `'refunded'`, exactly as before Sprint 14. */
    type: paymentTypeEnum("type").notNull().default("charge"),
    /** Required on every `type = 'refund'` row — which charge it reverses.
     *  The referenced charge must be a `paid` `charge` in the same
     *  workspace/invoice/currency, and this refund is capped by BOTH that
     *  specific charge's remaining refundable amount and the invoice-wide
     *  net-refundable balance (see `enforce_invoice_payment_integrity`
     *  trigger). */
    refundedPaymentId: uuid("refunded_payment_id").references(
      (): AnyPgColumn => payments.id,
      { onDelete: "restrict" },
    ),
    /** Caller-supplied (or generated) idempotency key so retrying the same
     *  payment/refund request returns the original row instead of duplicating
     *  a ledger entry. Scoped per workspace, not per operation type — the
     *  caller is responsible for a sufficiently unique key. Unused/null for
     *  legacy booking-payments. */
    idempotencyKey: text("idempotency_key"),
    /** Who performed this ledger entry — invoice-linked payments/refunds
     *  only (Sprint 14 Phase 2). Mirrors `invoices.voidedBy`/`writtenOffBy`'s
     *  existing actor-attribution pattern, closing the gap where `payments`
     *  had no equivalent at all. Never populated for legacy booking-payments. */
    actorTeamMemberId: uuid("actor_team_member_id").references(
      () => teamMembers.id,
      { onDelete: "set null" },
    ),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("payments_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("payments_workspace_idx").on(t.workspaceId),
    index("payments_customer_idx").on(t.customerId),
    index("payments_booking_idx").on(t.bookingId),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_status_idx").on(t.status),
    index("payments_type_idx").on(t.type),
    index("payments_actor_team_member_idx").on(t.actorTeamMemberId),
    // At most one active "paid" payment per booking (duplicate protection).
    // Unaffected by Sprint 14 — its predicate requires booking_id is not
    // null, so invoice-linked rows never participate in this index.
    uniqueIndex("payments_one_paid_per_booking_uq")
      .on(t.bookingId)
      .where(
        sql`status = 'paid' and deleted_at is null and booking_id is not null`,
      ),
    // Idempotent retry guarantee for payment/refund mutations (Sprint 14):
    // repeating the same (workspace, key) pair is a unique-violation, not a
    // second ledger row.
    uniqueIndex("payments_workspace_idempotency_uq")
      .on(t.workspaceId, t.idempotencyKey)
      .where(sql`idempotency_key is not null`),
    check("payments_currency_iso_ck", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    // Full biconditional: a row references an original charge iff it's a refund.
    check(
      "payments_refund_reference_ck",
      sql`(${t.type} = 'refund') = (${t.refundedPaymentId} is not null)`,
    ),
    // Exactly one of booking/invoice — never both, never neither.
    check(
      "payments_exactly_one_link_ck",
      sql`(${t.bookingId} is not null) <> (${t.invoiceId} is not null)`,
    ),
    // Invoice-linked amounts must be strictly positive; booking-payments keep
    // their existing, unrelated app-level min(0) allowance untouched.
    check(
      "payments_amount_positive_ck",
      sql`${t.invoiceId} is null or ${t.amountCents} > 0`,
    ),
  ],
);

/**
 * A single charge/tax/fee/discount line on an invoice (Sprint 14). `workspaceId`
 * is denormalized from the parent invoice (not derived via join) purely so
 * this table's own RLS policy can filter directly, matching the same
 * denormalization already used by `housekeepingTasks` — a trigger rejects it
 * ever diverging from the parent invoice's actual workspace. Lines may only
 * be added/edited/removed while the parent invoice is `draft` — enforced by
 * the `enforce_invoice_line_items_draft_only` trigger in `0014_billing.sql`,
 * not just app discipline, so issued-invoice history stays auditable at the
 * DB level. `invoices.amountCents` is kept synchronized to the sum of these
 * rows by `sync_invoice_amount_from_line_items`, so it can never drift. No
 * soft delete: rows die with their invoice (`onDelete: cascade`).
 */
export const invoiceLineItems = pgTable(
  "invoice_line_items",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    type: invoiceLineItemTypeEnum("type").notNull(),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    unitAmountCents: integer("unit_amount_cents").notNull(),
    /** `quantity * unitAmountCents`, or an independently-set total for
     *  percentage-computed lines (e.g. tax) — always the authoritative,
     *  final cents value for this line; never re-derived from a stored rate
     *  after the fact. Negative for `discount` lines. */
    amountCents: integer("amount_cents").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: "invoice_line_items_invoice_workspace_fk",
      columns: [t.workspaceId, t.invoiceId],
      foreignColumns: [invoices.workspaceId, invoices.id],
    }).onDelete("cascade"),
    index("invoice_line_items_workspace_idx").on(t.workspaceId),
    index("invoice_line_items_invoice_idx").on(t.invoiceId),
    check("invoice_line_items_quantity_positive_ck", sql`${t.quantity} > 0`),
    check("invoice_line_items_sort_order_ck", sql`${t.sortOrder} >= 0`),
    // Sign rule: a discount reduces the total (negative), everything else
    // adds to it (positive) — a sign-flip bug here is a direct financial-
    // total bug, so it's enforced at the DB level, not left to service discipline.
    check(
      "invoice_line_items_amount_sign_ck",
      sql`(${t.type} = 'discount' and ${t.amountCents} < 0) or (${t.type} <> 'discount' and ${t.amountCents} > 0)`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// AI assistant
// ---------------------------------------------------------------------------

/** A chat thread between a user and the AI assistant. */
export const aiConversations = pgTable(
  "ai_conversations",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index("ai_conversations_workspace_idx").on(t.workspaceId),
    index("ai_conversations_user_idx").on(t.userId),
  ],
);

/** A single message within a conversation. Immutable — created_at only. */
export const aiMessages = pgTable(
  "ai_messages",
  {
    id: primaryId(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => aiConversations.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    tokens: integer("tokens"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ai_messages_conversation_idx").on(t.conversationId)],
);

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

/** An in-app notification addressed to a user. */
export const notifications = pgTable(
  "notifications",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("notifications_workspace_idx").on(t.workspaceId),
    index("notifications_user_idx").on(t.userId),
    index("notifications_is_read_idx").on(t.isRead),
  ],
);

/** A third-party integration connected to a workspace. */
export const integrations = pgTable(
  "integrations",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status").notNull().default("disconnected"),
    config: jsonb("config").$type<Record<string, unknown>>(),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique("integrations_workspace_provider_uq").on(t.workspaceId, t.provider),
    index("integrations_workspace_idx").on(t.workspaceId),
  ],
);

/** An uploaded file/asset (avatar, logo, attachment, …). */
export const files = pgTable(
  "files",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    purpose: filePurposeEnum("purpose").notNull().default("other"),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index("files_workspace_idx").on(t.workspaceId),
    index("files_purpose_idx").on(t.purpose),
  ],
);

/** One row of preferences per workspace (one-to-one). */
export const settings = pgTable("settings", {
  id: primaryId(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),

  // Appearance
  theme: themeEnum("theme").notNull().default("dark"),
  primaryColor: text("primary_color").notNull().default("#6D5EF9"),
  accentColor: text("accent_color").notNull().default("#8B5CF6"),

  // Notifications
  emailNotifications: boolean("email_notifications").notNull().default(true),
  bookingNotifications: boolean("booking_notifications")
    .notNull()
    .default(true),
  paymentNotifications: boolean("payment_notifications")
    .notNull()
    .default(true),
  marketingEmails: boolean("marketing_emails").notNull().default(false),

  // Security
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  sessionTimeoutMinutes: integer("session_timeout_minutes")
    .notNull()
    .default(30),
  loginAlerts: boolean("login_alerts").notNull().default(true),

  // Localization
  dateFormat: text("date_format").notNull().default("MM/DD/YYYY"),
  timeFormat: text("time_format").notNull().default("12h"),
  weekStartsOn: text("week_starts_on").notNull().default("sunday"),

  // Business preferences
  defaultBookingDurationMinutes: integer("default_booking_duration_minutes")
    .notNull()
    .default(30),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  taxPercentBps: integer("tax_percent_bps").notNull().default(0),
  defaultBookingStatus: bookingStatusEnum("default_booking_status")
    .notNull()
    .default("confirmed"),
  defaultPaymentMethod: paymentMethodEnum("default_payment_method")
    .notNull()
    .default("card"),

  ...timestamps(),
});

// ---------------------------------------------------------------------------
// Website builder
// ---------------------------------------------------------------------------

/** A publishable website owned by a workspace. */
export const sites = pgTable(
  "sites",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultLocale: text("default_locale").notNull().default("en-us"),
    status: siteStatusEnum("status").notNull().default("draft"),
    /** Which registry theme this site renders with (null → default theme). */
    themeKey: text("theme_key"),
    /*
     * The live published version (→ site_versions.id). Declared as a plain uuid
     * to break the sites↔site_versions FK cycle at the Drizzle/type level; the
     * database-level FK (ON DELETE SET NULL) is added by the migration once both
     * tables exist.
     */
    publishedVersionId: uuid("published_version_id"),
    /*
     * Site-level SEO defaults (Sprint 8) — frozen into the published snapshot
     * at publish time; the public renderer never reads these columns directly.
     * All nullable/default-safe so existing sites need no backfill.
     */
    seoDefaultTitle: text("seo_default_title"),
    /** `%s` is replaced with the resolved page title, e.g. `"%s | Acme Co"`. */
    seoTitleTemplate: text("seo_title_template"),
    seoDefaultDescription: text("seo_default_description"),
    seoDefaultImageUrl: text("seo_default_image_url"),
    /** Master crawl switch for the whole site (robots.txt / sitemap.xml). */
    seoIndexable: boolean("seo_indexable").notNull().default(true),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("sites_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("sites_workspace_idx").on(t.workspaceId),
  ],
);

/** A page within a site (draft working set). */
export const pages = pgTable(
  "pages",
  {
    id: primaryId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    path: text("path").notNull().default(""),
    title: text("title").notNull(),
    locale: text("locale").notNull().default("en-us"),
    status: pageStatusEnum("status").notNull().default("draft"),
    position: integer("position").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    /*
     * Page-level SEO/social overrides (Sprint 8). All nullable/default-safe
     * so existing pages need no backfill; frozen into the snapshot at publish.
     */
    seoNoIndex: boolean("seo_no_index").notNull().default(false),
    seoNoFollow: boolean("seo_no_follow").notNull().default(false),
    ogTitle: text("og_title"),
    ogDescription: text("og_description"),
    ogImageUrl: text("og_image_url"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("pages_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "pages_site_workspace_fk",
      columns: [t.workspaceId, t.siteId],
      foreignColumns: [sites.workspaceId, sites.id],
    }).onDelete("cascade"),
    // One live page per (site, path, locale); soft-deleted rows don't collide.
    uniqueIndex("pages_site_path_locale_uq")
      .on(t.siteId, t.path, t.locale)
      .where(sql`deleted_at is null`),
    index("pages_site_idx").on(t.siteId),
    index("pages_workspace_idx").on(t.workspaceId),
  ],
);

/** An ordered content block on a page. */
export const pageSections = pgTable(
  "page_sections",
  {
    id: primaryId(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    typeKey: text("type_key").notNull(),
    typeVersion: integer("type_version").notNull().default(1),
    position: integer("position").notNull().default(0),
    props: jsonb("props")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    isVisible: boolean("is_visible").notNull().default(true),
    locale: text("locale").notNull().default("en-us"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    foreignKey({
      name: "page_sections_page_workspace_fk",
      columns: [t.workspaceId, t.pageId],
      foreignColumns: [pages.workspaceId, pages.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "page_sections_site_workspace_fk",
      columns: [t.workspaceId, t.siteId],
      foreignColumns: [sites.workspaceId, sites.id],
    }).onDelete("cascade"),
    index("page_sections_page_idx").on(t.pageId),
    index("page_sections_site_idx").on(t.siteId),
    index("page_sections_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * An immutable, denormalized snapshot of a site at publish time. Public
 * rendering reads only from `snapshot`; draft tables are never touched. Rolling
 * back is a pointer flip (`sites.published_version_id`), never a recompile.
 */
export const siteVersions = pgTable(
  "site_versions",
  {
    id: primaryId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: siteVersionStatusEnum("status").notNull().default("published"),
    label: text("label"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps(),
  },
  (t) => [
    unique("site_versions_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "site_versions_site_workspace_fk",
      columns: [t.workspaceId, t.siteId],
      foreignColumns: [sites.workspaceId, sites.id],
    }).onDelete("cascade"),
    // Monotonic version number per site.
    unique("site_versions_site_number_uq").on(t.siteId, t.versionNumber),
    index("site_versions_site_idx").on(t.siteId),
    index("site_versions_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * A hostname attached to a site (the routing key for a future public host
 * resolver). One site owns many domains, one of which is primary. Hostnames are
 * globally unique among live rows.
 *
 * Sprint 7.2 adds DNS ownership verification and SSL-readiness bookkeeping for
 * custom domains; automatic `<label>.verix.app` subdomains never populate the
 * verification columns. Host routing and real certificate provisioning are not
 * implemented — `ssl_status` only records state, nothing ever requests a cert.
 */
export const siteDomains = pgTable(
  "site_domains",
  {
    id: primaryId(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    type: domainTypeEnum("type").notNull(),
    status: domainStatusEnum("status").notNull().default("pending"),
    isPrimary: boolean("is_primary").notNull().default(false),
    // Ownership verification (custom domains only; null for subdomains).
    verificationToken: text("verification_token"),
    verificationMethod: domainVerificationMethodEnum("verification_method"),
    verificationError: text("verification_error"),
    verificationAttemptedAt: timestamp("verification_attempted_at", {
      withTimezone: true,
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    // SSL readiness bookkeeping only — no certificate provider is wired up.
    sslStatus: sslStatusEnum("ssl_status").notNull().default("not_requested"),
    sslError: text("ssl_error"),
    sslIssuedAt: timestamp("ssl_issued_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    foreignKey({
      name: "site_domains_site_workspace_fk",
      columns: [t.workspaceId, t.siteId],
      foreignColumns: [sites.workspaceId, sites.id],
    }).onDelete("cascade"),
    // Globally unique hostname among live rows; soft-deleted rows don't collide.
    uniqueIndex("site_domains_hostname_uq")
      .on(t.hostname)
      .where(sql`deleted_at is null`),
    index("site_domains_site_idx").on(t.siteId),
    index("site_domains_workspace_idx").on(t.workspaceId),
    // Tokens must be unique when set; many rows have none (subdomains).
    uniqueIndex("site_domains_verification_token_uq")
      .on(t.verificationToken)
      .where(sql`verification_token is not null`),
    index("site_domains_status_idx").on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Leads (Sprint 9)
// ---------------------------------------------------------------------------

/**
 * A lead captured from an unauthenticated public-site form submission (e.g.
 * the Contact section's form). `workspaceId`/`siteId` are resolved
 * server-side from trusted host-routing context at submission time — never
 * from client input. `pagePath` is denormalized (not a `pages` FK) so a lead's
 * origin stays legible even after the source page is edited or deleted.
 * `ipHash` is a salted one-way hash — the raw IP is never stored.
 */
export const leads = pgTable(
  "leads",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    pagePath: text("page_path").notNull().default(""),
    sourceDomain: text("source_domain"),
    formKey: text("form_key").notNull(),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    subject: text("subject"),
    message: text("message"),
    status: leadStatusEnum("status").notNull().default("new"),
    /** Abuse-signal diagnostics only (e.g. `{ fillTimeMs }`) — never form body content. */
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    convertedCustomerId: uuid("converted_customer_id").references(
      () => customers.id,
      { onDelete: "set null" },
    ),
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("leads_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "leads_site_workspace_fk",
      columns: [t.workspaceId, t.siteId],
      foreignColumns: [sites.workspaceId, sites.id],
    }).onDelete("cascade"),
    index("leads_workspace_created_idx").on(t.workspaceId, t.createdAt),
    index("leads_workspace_status_idx").on(t.workspaceId, t.status),
    index("leads_site_created_idx").on(t.siteId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// CRM pipeline (Sprint 10)
// ---------------------------------------------------------------------------

/**
 * A named sales pipeline (e.g. "Sales"). Every workspace gets exactly one
 * `is_default` pipeline auto-provisioned on first use (see
 * `crm-pipeline.service.ts`'s `ensureDefaultPipeline`); additional pipelines
 * are optional. The partial unique index enforces at most one default per
 * workspace at the database level, not just in application code.
 */
export const crmPipelines = pgTable(
  "crm_pipelines",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("crm_pipelines_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("crm_pipelines_workspace_idx").on(t.workspaceId),
    uniqueIndex("crm_pipelines_workspace_default_uq")
      .on(t.workspaceId)
      .where(sql`is_default = true and deleted_at is null`),
  ],
);

/**
 * One column of a pipeline (e.g. "Qualified"). `isWon`/`isLost` mark the
 * (at most one each, per pipeline) terminal stages that `markOpportunityWon`/
 * `markOpportunityLost` move an opportunity into; `isProtected` marks a
 * system-provisioned stage a manager may rename/recolor but not delete or
 * strip of its won/lost role (owner-only).
 */
export const crmStages = pgTable(
  "crm_stages",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    probabilityPercent: integer("probability_percent").notNull().default(0),
    tone: crmStageToneEnum("tone").notNull().default("neutral"),
    isWon: boolean("is_won").notNull().default(false),
    isLost: boolean("is_lost").notNull().default(false),
    isProtected: boolean("is_protected").notNull().default(false),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("crm_stages_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "crm_stages_pipeline_workspace_fk",
      columns: [t.workspaceId, t.pipelineId],
      foreignColumns: [crmPipelines.workspaceId, crmPipelines.id],
    }).onDelete("cascade"),
    index("crm_stages_pipeline_position_idx").on(t.pipelineId, t.position),
    index("crm_stages_workspace_idx").on(t.workspaceId),
    uniqueIndex("crm_stages_pipeline_won_uq")
      .on(t.pipelineId)
      .where(sql`is_won = true and deleted_at is null`),
    uniqueIndex("crm_stages_pipeline_lost_uq")
      .on(t.pipelineId)
      .where(sql`is_lost = true and deleted_at is null`),
  ],
);

/**
 * A deal in progress. Never duplicates Lead/Customer data — `leadId`/
 * `customerId` are references only. `status` is the won/open/lost outcome;
 * `archivedAt` is a separate, orthogonal lifecycle flag so an archived deal
 * keeps the outcome it closed with (metrics filter archived out of the
 * active pipeline view but "won/lost this month" still reflects it).
 */
export const crmOpportunities = pgTable(
  "crm_opportunities",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id")
      .notNull()
      .references(() => crmPipelines.id, { onDelete: "cascade" }),
    stageId: uuid("stage_id")
      .notNull()
      .references(() => crmStages.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    valueCents: integer("value_cents").notNull().default(0),
    // ISO 4217, uppercase — see the identical note on `workspaces.currency`.
    currency: text("currency").notNull().default("USD"),
    status: crmOpportunityStatusEnum("status").notNull().default("open"),
    lossReason: text("loss_reason"),
    expectedCloseDate: timestamp("expected_close_date", {
      withTimezone: true,
    }),
    /** Stamped when `status` moves to `won`/`lost` — the time anchor "won/lost this month" metrics key off. */
    closedAt: timestamp("closed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("crm_opportunities_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "crm_opportunities_pipeline_workspace_fk",
      columns: [t.workspaceId, t.pipelineId],
      foreignColumns: [crmPipelines.workspaceId, crmPipelines.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "crm_opportunities_stage_workspace_fk",
      columns: [t.workspaceId, t.stageId],
      foreignColumns: [crmStages.workspaceId, crmStages.id],
    }).onDelete("restrict"),
    index("crm_opportunities_workspace_stage_idx").on(t.workspaceId, t.stageId),
    index("crm_opportunities_workspace_assigned_idx").on(
      t.workspaceId,
      t.assignedToUserId,
    ),
    index("crm_opportunities_workspace_status_idx").on(t.workspaceId, t.status),
    index("crm_opportunities_workspace_created_idx").on(
      t.workspaceId,
      t.createdAt,
    ),
    index("crm_opportunities_pipeline_idx").on(t.pipelineId),
    index("crm_opportunities_lead_idx").on(t.leadId),
    check(
      "crm_opportunities_currency_iso_ck",
      sql`${t.currency} ~ '^[A-Z]{3}$'`,
    ),
  ],
);

/** A timeline entry (note/call/email/meeting/task, or an auto-logged stage change) on an opportunity. */
export const crmActivities = pgTable(
  "crm_activities",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => crmOpportunities.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    type: crmActivityTypeEnum("type").notNull().default("note"),
    title: text("title").notNull(),
    body: text("body"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    foreignKey({
      name: "crm_activities_opportunity_workspace_fk",
      columns: [t.workspaceId, t.opportunityId],
      foreignColumns: [crmOpportunities.workspaceId, crmOpportunities.id],
    }).onDelete("cascade"),
    index("crm_activities_opportunity_created_idx").on(
      t.opportunityId,
      t.createdAt,
    ),
    index("crm_activities_workspace_due_idx").on(t.workspaceId, t.dueAt),
  ],
);

// ---------------------------------------------------------------------------
// Property management (Sprint 12)
// ---------------------------------------------------------------------------

/**
 * A physical property (a building complex, estate, or single address) owned
 * by a workspace. The top level of the property → building → rental-unit
 * hierarchy. `archivedAt` follows the `crmOpportunities` precedent — a
 * distinct, reversible "hide from active views" flag, separate from
 * `deletedAt`'s harder removal — so an archived property's buildings/units
 * (and their reservation history) are never lost.
 */
export const properties = pgTable(
  "properties",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    addressLine1: text("address_line1"),
    addressLine2: text("address_line2"),
    city: text("city"),
    state: text("state"),
    postalCode: text("postal_code"),
    country: text("country"),
    description: text("description"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("properties_workspace_id_id_uq").on(t.workspaceId, t.id),
    index("properties_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * A building within a property. `position` orders buildings within their
 * property for display (mirrors `crmStages.position`'s pattern). `onDelete:
 * "restrict"` on `propertyId` (like `reservations.unitId`) means the
 * hierarchy is never silently lost to a hard delete — the app only ever
 * archives.
 */
export const buildings = pgTable(
  "buildings",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("buildings_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "buildings_property_workspace_fk",
      columns: [t.workspaceId, t.propertyId],
      foreignColumns: [properties.workspaceId, properties.id],
    }).onDelete("restrict"),
    index("buildings_workspace_idx").on(t.workspaceId),
    index("buildings_property_position_idx").on(t.propertyId, t.position),
  ],
);

// ---------------------------------------------------------------------------
// Reservations (Sprint 11) — rental_units extended by property management
// (Sprint 12) with a property/building home and richer unit detail fields.
// ---------------------------------------------------------------------------

/**
 * A rentable unit of inventory (room, apartment, villa, …) offered by a
 * workspace, homed under a property and building. Distinct from `services` (a
 * bookable appointment type) — a rental unit is physical inventory reserved
 * for a date range, not a time-slot. `capacity` is the unit's guest capacity,
 * used only for display; the occupancy metric divides active stays by active
 * *unit count*, not guest capacity.
 *
 * There is deliberately no persisted "available/occupied/reserved" status
 * column — those three states are *derived* at read time from whether a
 * reservation currently covers today (see `resolveUnitDisplayStatus` in
 * `validators/rental-unit.ts`), so they can never drift out of sync with the
 * reservations table. `statusOverride` only stores the three conditions with
 * no reservation signal to derive from (cleaning/maintenance/out of service);
 * null means "no override, derive from reservations."
 */
export const rentalUnits = pgTable(
  "rental_units",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    unitNumber: text("unit_number"),
    floor: integer("floor"),
    unitType: rentalUnitTypeEnum("unit_type").notNull().default("room"),
    description: text("description"),
    capacity: integer("capacity").notNull().default(1),
    bedrooms: integer("bedrooms").notNull().default(0),
    bathrooms: integer("bathrooms").notNull().default(0),
    sizeSqFt: integer("size_sq_ft"),
    amenities: text("amenities")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    notes: text("notes"),
    priceCents: integer("price_cents").notNull().default(0),
    // ISO 4217, uppercase — see the identical note on `workspaces.currency`.
    currency: text("currency").notNull().default("USD"),
    statusOverride: rentalUnitConditionEnum("status_override"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("rental_units_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "rental_units_property_workspace_fk",
      columns: [t.workspaceId, t.propertyId],
      foreignColumns: [properties.workspaceId, properties.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "rental_units_building_workspace_fk",
      columns: [t.workspaceId, t.buildingId],
      foreignColumns: [buildings.workspaceId, buildings.id],
    }).onDelete("restrict"),
    index("rental_units_workspace_idx").on(t.workspaceId),
    index("rental_units_property_idx").on(t.propertyId),
    index("rental_units_building_idx").on(t.buildingId),
    check("rental_units_currency_iso_ck", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

/**
 * A reservation of a rental unit for a customer over a check-in/check-out
 * date range. `checkInDate`/`checkOutDate` are plain calendar dates (no
 * time-of-day) — a stay occupies the half-open range `[checkInDate,
 * checkOutDate)`, matching a native `<input type="date">` and keeping
 * overlap arithmetic simple.
 *
 * Overlap prevention is enforced at the database level by a partial
 * exclusion constraint (`reservations_no_overlap_excl`, added by hand to the
 * generated migration — see `drizzle/0011_reservations.sql`) covering every
 * row that is not soft-deleted and not `cancelled`/`no_show`. The service
 * layer additionally pre-checks for a friendly error message; the DB
 * constraint is the actual race-safe guarantee.
 */
export const reservations = pgTable(
  "reservations",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => rentalUnits.id, { onDelete: "restrict" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    status: reservationStatusEnum("status").notNull().default("inquiry"),
    checkInDate: date("check_in_date", { mode: "string" }).notNull(),
    checkOutDate: date("check_out_date", { mode: "string" }).notNull(),
    priceCents: integer("price_cents").notNull().default(0),
    // ISO 4217, uppercase — see the identical note on `workspaces.currency`.
    currency: text("currency").notNull().default("USD"),
    source: reservationSourceEnum("source").notNull().default("direct"),
    /** Derived, staff-facing summary of whether this stay's invoice is
     *  settled (Sprint 14) — written by `syncReservationPaymentStatus` from
     *  that invoice's payment ledger, never set directly. */
    paymentStatus: reservationPaymentStatusEnum("payment_status")
      .notNull()
      .default("unpaid"),
    notes: text("notes"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    unique("reservations_workspace_id_id_uq").on(t.workspaceId, t.id),
    foreignKey({
      name: "reservations_unit_workspace_fk",
      columns: [t.workspaceId, t.unitId],
      foreignColumns: [rentalUnits.workspaceId, rentalUnits.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "reservations_customer_workspace_fk",
      columns: [t.workspaceId, t.customerId],
      foreignColumns: [customers.workspaceId, customers.id],
    }).onDelete("cascade"),
    index("reservations_workspace_idx").on(t.workspaceId),
    index("reservations_unit_idx").on(t.unitId),
    index("reservations_customer_idx").on(t.customerId),
    index("reservations_staff_idx").on(t.staffId),
    index("reservations_status_idx").on(t.status),
    index("reservations_payment_status_idx").on(t.paymentStatus),
    index("reservations_workspace_checkin_idx").on(
      t.workspaceId,
      t.checkInDate,
    ),
    index("reservations_workspace_checkout_idx").on(
      t.workspaceId,
      t.checkOutDate,
    ),
    check("reservations_currency_iso_ck", sql`${t.currency} ~ '^[A-Z]{3}$'`),
  ],
);

// ---------------------------------------------------------------------------
// Housekeeping & Unit Operations (Sprint 13)
// ---------------------------------------------------------------------------

/**
 * A cleaning/maintenance/inspection task tied to exactly one rental unit
 * (and, denormalized for query efficiency, the unit's property/building —
 * validated against the unit's actual parents at write time in the service
 * layer, never trusted independently from the client). `reservationId` is
 * set automatically for the cleaning task created when a reservation
 * transitions `checked_in` -> `checked_out` (see
 * `reservation.service.ts`'s `updateReservationStatus`), or may be linked
 * manually; either way it must reference a reservation for the *same*
 * unit and workspace (enforced in the service layer, not by a DB
 * constraint, since that check needs the unit's own id).
 *
 * `assignedTo`/`completedBy`/`createdBy` all reference `teamMembers.id`
 * (not `users.id`) — matching `reservations.staffId`'s convention, since
 * tasks are staff-assignment records like reservations, not CRM-style
 * user-authored records. `onDelete: "set null"` on assignee/completer so a
 * team member's removal never destroys task history.
 *
 * `dueTime` is a plain "HH:MM" string (validated by Zod), not a native
 * Postgres `time` column — nothing in this schema uses one, and the
 * installed drizzle-orm has no `time()` column builder.
 *
 * `housekeeping_checkout_task_uq` (partial unique index, see migration
 * 0013) guarantees at most one non-deleted `cleaning` task per reservation,
 * backing idempotent automatic-checkout-task creation.
 */
export const housekeepingTasks = pgTable(
  "housekeeping_tasks",
  {
    id: primaryId(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "restrict" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => rentalUnits.id, { onDelete: "restrict" }),
    reservationId: uuid("reservation_id").references(() => reservations.id, {
      onDelete: "restrict",
    }),
    taskType: housekeepingTaskTypeEnum("task_type").notNull(),
    status: housekeepingTaskStatusEnum("status").notNull().default("pending"),
    priority: housekeepingTaskPriorityEnum("priority")
      .notNull()
      .default("normal"),
    assignedTo: uuid("assigned_to").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date", { mode: "string" }),
    dueTime: text("due_time"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: uuid("completed_by").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => teamMembers.id, {
      onDelete: "set null",
    }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    foreignKey({
      name: "housekeeping_property_workspace_fk",
      columns: [t.workspaceId, t.propertyId],
      foreignColumns: [properties.workspaceId, properties.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "housekeeping_building_workspace_fk",
      columns: [t.workspaceId, t.buildingId],
      foreignColumns: [buildings.workspaceId, buildings.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "housekeeping_unit_workspace_fk",
      columns: [t.workspaceId, t.unitId],
      foreignColumns: [rentalUnits.workspaceId, rentalUnits.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "housekeeping_reservation_workspace_fk",
      columns: [t.workspaceId, t.reservationId],
      foreignColumns: [reservations.workspaceId, reservations.id],
    }).onDelete("restrict"),
    index("housekeeping_tasks_workspace_idx").on(t.workspaceId),
    index("housekeeping_tasks_unit_idx").on(t.unitId),
    index("housekeeping_tasks_property_idx").on(t.propertyId),
    index("housekeeping_tasks_building_idx").on(t.buildingId),
    index("housekeeping_tasks_assigned_idx").on(t.assignedTo),
    index("housekeeping_tasks_status_idx").on(t.status),
    index("housekeeping_tasks_task_type_idx").on(t.taskType),
    index("housekeeping_tasks_priority_idx").on(t.priority),
    index("housekeeping_tasks_due_date_idx").on(t.dueDate),
    index("housekeeping_tasks_reservation_idx").on(t.reservationId),
    index("housekeeping_tasks_deleted_idx").on(t.deletedAt),
    // At most one non-deleted automatic checkout cleaning task per reservation.
    uniqueIndex("housekeeping_checkout_task_uq")
      .on(t.reservationId, t.taskType)
      .where(
        sql`reservation_id is not null and task_type = 'cleaning' and deleted_at is null`,
      ),
  ],
);

// ---------------------------------------------------------------------------
// Inferred row types (select / insert) for every table.
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Service = typeof services.$inferSelect;
export type NewService = typeof services.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type AiConversation = typeof aiConversations.$inferSelect;
export type NewAiConversation = typeof aiConversations.$inferInsert;
export type AiMessage = typeof aiMessages.$inferSelect;
export type NewAiMessage = typeof aiMessages.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type FileRecord = typeof files.$inferSelect;
export type NewFileRecord = typeof files.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type Site = typeof sites.$inferSelect;
export type NewSite = typeof sites.$inferInsert;
export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageSection = typeof pageSections.$inferSelect;
export type NewPageSection = typeof pageSections.$inferInsert;
export type SiteVersion = typeof siteVersions.$inferSelect;
export type NewSiteVersion = typeof siteVersions.$inferInsert;
export type SiteDomain = typeof siteDomains.$inferSelect;
export type NewSiteDomain = typeof siteDomains.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type CrmPipeline = typeof crmPipelines.$inferSelect;
export type NewCrmPipeline = typeof crmPipelines.$inferInsert;
export type CrmStage = typeof crmStages.$inferSelect;
export type NewCrmStage = typeof crmStages.$inferInsert;
export type CrmOpportunity = typeof crmOpportunities.$inferSelect;
export type NewCrmOpportunity = typeof crmOpportunities.$inferInsert;
export type CrmActivity = typeof crmActivities.$inferSelect;
export type NewCrmActivity = typeof crmActivities.$inferInsert;
export type Property = typeof properties.$inferSelect;
export type NewProperty = typeof properties.$inferInsert;
export type Building = typeof buildings.$inferSelect;
export type NewBuilding = typeof buildings.$inferInsert;
export type RentalUnit = typeof rentalUnits.$inferSelect;
export type NewRentalUnit = typeof rentalUnits.$inferInsert;
export type Reservation = typeof reservations.$inferSelect;
export type NewReservation = typeof reservations.$inferInsert;
export type HousekeepingTask = typeof housekeepingTasks.$inferSelect;
export type NewHousekeepingTask = typeof housekeepingTasks.$inferInsert;
