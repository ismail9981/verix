import { ProfileSection } from "../business-profile/profile-section";
import { NOTIFICATIONS } from "./mock-data";
import { ToggleRow } from "./toggle-row";

export function NotificationSettings() {
  return (
    <ProfileSection
      id="notifications"
      title="Notifications"
      description="Choose how and when Verix keeps you informed."
    >
      <div className="flex flex-col divide-y divide-hairline">
        {NOTIFICATIONS.map((item) => (
          <ToggleRow
            key={item.id}
            label={item.label}
            description={item.description}
            defaultChecked={item.defaultOn}
          />
        ))}
      </div>
    </ProfileSection>
  );
}
