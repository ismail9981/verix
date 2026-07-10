import { z } from "zod";

/*
 * Validation + shared types for the Settings module.
 *
 * General identity fields (business name, language, timezone, currency, logo,
 * cover) live on `workspaces`; everything else lives on `settings`. The client
 * works with `SettingsValues` (a flat combined view); `taxPercent` is a percent
 * here and stored as basis points.
 */

export const SETTINGS_SECTIONS = [
  "general",
  "appearance",
  "notifications",
  "security",
  "localization",
  "business",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const HEX = /^#[0-9a-fA-F]{6}$/;

export const settingsInputSchema = z.object({
  // General (workspaces)
  businessName: z.string().trim().min(1, "Business name is required").max(120),
  language: z.string().trim().min(1).max(20),
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().min(1).max(8),

  // Appearance
  theme: z.enum(["dark", "light", "system"]),
  primaryColor: z.string().trim().regex(HEX, "Enter a hex color"),
  accentColor: z.string().trim().regex(HEX, "Enter a hex color"),
  logoUrl: z.string().trim().max(500),
  coverImageUrl: z.string().trim().max(500),

  // Notifications
  emailNotifications: z.boolean(),
  bookingNotifications: z.boolean(),
  paymentNotifications: z.boolean(),
  marketingEmails: z.boolean(),

  // Security
  twoFactorEnabled: z.boolean(),
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(1440),
  loginAlerts: z.boolean(),

  // Localization
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.enum(["12h", "24h"]),
  weekStartsOn: z.enum(["sunday", "monday"]),

  // Business preferences
  defaultBookingDurationMinutes: z.coerce.number().int().min(5).max(1440),
  taxEnabled: z.boolean(),
  taxPercent: z.coerce.number().min(0).max(100),
  defaultBookingStatus: z.enum([
    "pending",
    "confirmed",
    "completed",
    "cancelled",
  ]),
  defaultPaymentMethod: z.enum(["card", "cash", "paypal", "bank_transfer"]),
});

export type SettingsValues = z.infer<typeof settingsInputSchema>;

/** Which fields belong to which section (used for reset-to-defaults). */
export const SECTION_FIELDS: Record<
  SettingsSection,
  (keyof SettingsValues)[]
> = {
  general: ["language", "timezone", "currency"],
  appearance: ["theme", "primaryColor", "accentColor", "logoUrl", "coverImageUrl"],
  notifications: [
    "emailNotifications",
    "bookingNotifications",
    "paymentNotifications",
    "marketingEmails",
  ],
  security: ["twoFactorEnabled", "sessionTimeoutMinutes", "loginAlerts"],
  localization: ["dateFormat", "timeFormat", "weekStartsOn"],
  business: [
    "defaultBookingDurationMinutes",
    "taxEnabled",
    "taxPercent",
    "defaultBookingStatus",
    "defaultPaymentMethod",
  ],
};

/** Defaults matching the DB column defaults (business name excluded). */
export const SETTINGS_DEFAULTS: Omit<SettingsValues, "businessName"> = {
  language: "en-us",
  timezone: "america-los_angeles",
  currency: "usd",
  theme: "dark",
  primaryColor: "#6D5EF9",
  accentColor: "#8B5CF6",
  logoUrl: "",
  coverImageUrl: "",
  emailNotifications: true,
  bookingNotifications: true,
  paymentNotifications: true,
  marketingEmails: false,
  twoFactorEnabled: false,
  sessionTimeoutMinutes: 30,
  loginAlerts: true,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
  weekStartsOn: "sunday",
  defaultBookingDurationMinutes: 30,
  taxEnabled: false,
  taxPercent: 0,
  defaultBookingStatus: "confirmed",
  defaultPaymentMethod: "card",
};

// Option lists for the UI selects.
export const THEME_OPTIONS = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];
export const DATE_FORMAT_OPTIONS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];
export const TIME_FORMAT_OPTIONS = [
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" },
];
export const WEEK_START_OPTIONS = [
  { value: "sunday", label: "Sunday" },
  { value: "monday", label: "Monday" },
];
export const SESSION_TIMEOUT_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "60", label: "1 hour" },
  { value: "120", label: "2 hours" },
];
export const BOOKING_DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "1 hour" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "2 hours" },
];
export const BOOKING_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
export const PAYMENT_METHOD_OPTIONS = [
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "paypal", label: "PayPal" },
  { value: "bank_transfer", label: "Bank transfer" },
];
