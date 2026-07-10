"use client";

import { SettingsSection } from "./settings-section";
import { ToggleRow } from "./toggle-row";
import type { SectionProps } from "./types";

export function NotificationSettings({ values, set, onReset }: SectionProps) {
  return (
    <SettingsSection
      id="notifications"
      title="Notifications"
      description="Choose how and when Verix keeps you informed."
      onReset={onReset}
    >
      <div className="flex flex-col divide-y divide-hairline">
        <ToggleRow
          label="Email notifications"
          description="Receive general account emails from Verix."
          checked={values.emailNotifications}
          onChange={(v) => set("emailNotifications", v)}
        />
        <ToggleRow
          label="Booking notifications"
          description="Get notified about new and updated bookings."
          checked={values.bookingNotifications}
          onChange={(v) => set("bookingNotifications", v)}
        />
        <ToggleRow
          label="Payment notifications"
          description="Get notified about payments and refunds."
          checked={values.paymentNotifications}
          onChange={(v) => set("paymentNotifications", v)}
        />
        <ToggleRow
          label="Marketing emails"
          description="Product updates, tips, and offers."
          checked={values.marketingEmails}
          onChange={(v) => set("marketingEmails", v)}
        />
      </div>
    </SettingsSection>
  );
}
