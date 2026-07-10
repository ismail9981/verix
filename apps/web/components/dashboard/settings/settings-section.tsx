import type { ReactNode } from "react";
import { ProfileSection } from "../business-profile/profile-section";

/* Wraps the shared ProfileSection and appends a "Reset to defaults" control,
   so every settings section gets a consistent reset affordance. */
export function SettingsSection({
  id,
  title,
  description,
  onReset,
  children,
}: {
  id: string;
  title: string;
  description: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <ProfileSection id={id} title={title} description={description}>
      {children}
      <div className="mt-6 flex justify-end border-t border-hairline pt-4">
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-medium text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Reset to defaults
        </button>
      </div>
    </ProfileSection>
  );
}
