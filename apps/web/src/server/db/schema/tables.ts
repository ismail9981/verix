import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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
  customerStatusEnum,
  filePurposeEnum,
  integrationProviderEnum,
  integrationStatusEnum,
  invoiceStatusEnum,
  memberRoleEnum,
  memberStatusEnum,
  messageRoleEnum,
  notificationTypeEnum,
  paymentMethodEnum,
  paymentStatusEnum,
  planEnum,
  serviceStatusEnum,
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
    currency: text("currency").notNull().default("usd"),
    language: text("language").notNull().default("en-us"),
    logoUrl: text("logo_url"),
    coverImageUrl: text("cover_image_url"),
    accentColor: text("accent_color").notNull().default("#6D5EF9"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [index("workspaces_owner_idx").on(t.ownerId)],
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
  (t) => [index("services_workspace_idx").on(t.workspaceId)],
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

/** An invoice issued to a customer. Financial record — no soft delete. */
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
    number: text("number").notNull(),
    status: invoiceStatusEnum("status").notNull().default("draft"),
    amountCents: integer("amount_cents").notNull().default(0),
    currency: text("currency").notNull().default("USD"),
    issuedAt: timestamp("issued_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique("invoices_workspace_number_uq").on(t.workspaceId, t.number),
    index("invoices_workspace_idx").on(t.workspaceId),
    index("invoices_customer_idx").on(t.customerId),
    index("invoices_status_idx").on(t.status),
  ],
);

/** A payment transaction. Supports soft delete so records can be voided. */
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
    currency: text("currency").notNull().default("USD"),
    method: paymentMethodEnum("method").notNull().default("card"),
    status: paymentStatusEnum("status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    provider: text("provider"),
    providerRef: text("provider_ref"),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index("payments_workspace_idx").on(t.workspaceId),
    index("payments_customer_idx").on(t.customerId),
    index("payments_booking_idx").on(t.bookingId),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_status_idx").on(t.status),
    // At most one active "paid" payment per booking (duplicate protection).
    uniqueIndex("payments_one_paid_per_booking_uq")
      .on(t.bookingId)
      .where(
        sql`status = 'paid' and deleted_at is null and booking_id is not null`,
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
