import { eq } from "drizzle-orm";
import { db } from "../db/db";
import {
  settings,
  workspaces,
  type NewSettings,
  type Settings,
  type Workspace,
} from "../db/schema";
import {
  SECTION_FIELDS,
  SETTINGS_DEFAULTS,
  type SettingsSection,
  type SettingsValues,
} from "../validators/settings";

/*
 * Settings service.
 *
 * General identity fields live on `workspaces`; all other preferences on
 * `settings` (one row per workspace, created on first read). `saveSettings`
 * diffs the incoming values against the stored ones and updates only the
 * columns that actually changed — and skips a table entirely if nothing in it
 * changed.
 */

async function ensureSettingsRow(workspaceId: string): Promise<Settings> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.workspaceId, workspaceId))
    .limit(1);
  if (rows[0]) return rows[0];

  const inserted = await db
    .insert(settings)
    .values({ workspaceId })
    .onConflictDoNothing()
    .returning();
  if (inserted[0]) return inserted[0];

  // Lost an insert race — read the row the other writer created.
  const again = await db
    .select()
    .from(settings)
    .where(eq(settings.workspaceId, workspaceId))
    .limit(1);
  return again[0]!;
}

function combine(workspace: Workspace, row: Settings): SettingsValues {
  return {
    businessName: workspace.name,
    language: workspace.language,
    timezone: workspace.timezone,
    currency: workspace.currency,
    logoUrl: workspace.logoUrl ?? "",
    coverImageUrl: workspace.coverImageUrl ?? "",
    theme: row.theme,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    emailNotifications: row.emailNotifications,
    bookingNotifications: row.bookingNotifications,
    paymentNotifications: row.paymentNotifications,
    marketingEmails: row.marketingEmails,
    twoFactorEnabled: row.twoFactorEnabled,
    sessionTimeoutMinutes: row.sessionTimeoutMinutes,
    loginAlerts: row.loginAlerts,
    dateFormat: row.dateFormat as SettingsValues["dateFormat"],
    timeFormat: row.timeFormat as SettingsValues["timeFormat"],
    weekStartsOn: row.weekStartsOn as SettingsValues["weekStartsOn"],
    defaultBookingDurationMinutes: row.defaultBookingDurationMinutes,
    taxEnabled: row.taxEnabled,
    taxPercent: row.taxPercentBps / 100,
    defaultBookingStatus: row.defaultBookingStatus,
    defaultPaymentMethod: row.defaultPaymentMethod,
  };
}

export async function getSettings(
  workspaceId: string,
): Promise<SettingsValues> {
  const [workspaceRows, row] = await Promise.all([
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
    ensureSettingsRow(workspaceId),
  ]);
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("Workspace not found.");
  return combine(workspace, row);
}

export async function saveSettings(
  workspaceId: string,
  input: SettingsValues,
): Promise<SettingsValues> {
  const current = await getSettings(workspaceId);

  // Workspace-owned identity fields (only the changed ones).
  const ws: Partial<typeof workspaces.$inferInsert> = {};
  if (input.businessName !== current.businessName) ws.name = input.businessName;
  if (input.language !== current.language) ws.language = input.language;
  if (input.timezone !== current.timezone) ws.timezone = input.timezone;
  if (input.currency !== current.currency) ws.currency = input.currency;
  if (input.logoUrl !== current.logoUrl) ws.logoUrl = input.logoUrl || null;
  if (input.coverImageUrl !== current.coverImageUrl) {
    ws.coverImageUrl = input.coverImageUrl || null;
  }

  // Settings-owned preference fields (only the changed ones).
  const s: Partial<NewSettings> = {};
  if (input.theme !== current.theme) s.theme = input.theme;
  if (input.primaryColor !== current.primaryColor) s.primaryColor = input.primaryColor;
  if (input.accentColor !== current.accentColor) s.accentColor = input.accentColor;
  if (input.emailNotifications !== current.emailNotifications) s.emailNotifications = input.emailNotifications;
  if (input.bookingNotifications !== current.bookingNotifications) s.bookingNotifications = input.bookingNotifications;
  if (input.paymentNotifications !== current.paymentNotifications) s.paymentNotifications = input.paymentNotifications;
  if (input.marketingEmails !== current.marketingEmails) s.marketingEmails = input.marketingEmails;
  if (input.twoFactorEnabled !== current.twoFactorEnabled) s.twoFactorEnabled = input.twoFactorEnabled;
  if (input.sessionTimeoutMinutes !== current.sessionTimeoutMinutes) s.sessionTimeoutMinutes = input.sessionTimeoutMinutes;
  if (input.loginAlerts !== current.loginAlerts) s.loginAlerts = input.loginAlerts;
  if (input.dateFormat !== current.dateFormat) s.dateFormat = input.dateFormat;
  if (input.timeFormat !== current.timeFormat) s.timeFormat = input.timeFormat;
  if (input.weekStartsOn !== current.weekStartsOn) s.weekStartsOn = input.weekStartsOn;
  if (input.defaultBookingDurationMinutes !== current.defaultBookingDurationMinutes) s.defaultBookingDurationMinutes = input.defaultBookingDurationMinutes;
  if (input.taxEnabled !== current.taxEnabled) s.taxEnabled = input.taxEnabled;
  if (Math.round(input.taxPercent * 100) !== Math.round(current.taxPercent * 100)) {
    s.taxPercentBps = Math.round(input.taxPercent * 100);
  }
  if (input.defaultBookingStatus !== current.defaultBookingStatus) s.defaultBookingStatus = input.defaultBookingStatus;
  if (input.defaultPaymentMethod !== current.defaultPaymentMethod) s.defaultPaymentMethod = input.defaultPaymentMethod;

  if (Object.keys(ws).length > 0) {
    await db.update(workspaces).set(ws).where(eq(workspaces.id, workspaceId));
  }
  if (Object.keys(s).length > 0) {
    await db.update(settings).set(s).where(eq(settings.workspaceId, workspaceId));
  }

  return getSettings(workspaceId);
}

/** Reset one section's fields to their defaults (via the same diff-save path). */
export async function resetSection(
  workspaceId: string,
  section: SettingsSection,
): Promise<SettingsValues> {
  const current = await getSettings(workspaceId);
  const target: SettingsValues = { ...current };
  for (const field of SECTION_FIELDS[section]) {
    // Business name has no default and is not part of any section's reset.
    (target as Record<string, unknown>)[field] = (
      SETTINGS_DEFAULTS as Record<string, unknown>
    )[field];
  }
  return saveSettings(workspaceId, target);
}
