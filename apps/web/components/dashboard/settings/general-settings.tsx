import { FieldInput } from "../business-profile/field-input";
import { FieldSelect } from "../business-profile/field-select";
import { ProfileSection } from "../business-profile/profile-section";
import {
  CURRENCIES,
  DEFAULT_GENERAL,
  LANGUAGES,
  TIMEZONES,
  WORKSPACE_NAME,
} from "./mock-data";

export function GeneralSettings() {
  return (
    <ProfileSection
      id="general"
      title="General"
      description="Basic workspace details and regional preferences."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FieldInput
            label="Workspace name"
            name="workspaceName"
            defaultValue={WORKSPACE_NAME}
          />
        </div>
        <FieldSelect
          label="Timezone"
          name="timezone"
          options={TIMEZONES}
          defaultValue={DEFAULT_GENERAL.timezone}
        />
        <FieldSelect
          label="Language"
          name="language"
          options={LANGUAGES}
          defaultValue={DEFAULT_GENERAL.language}
        />
        <FieldSelect
          label="Currency"
          name="currency"
          options={CURRENCIES}
          defaultValue={DEFAULT_GENERAL.currency}
        />
      </div>
    </ProfileSection>
  );
}
