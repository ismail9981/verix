import { FieldSelect } from "./field-select";
import {
  CURRENCIES,
  DEFAULT_DETAILS,
  INDUSTRIES,
  LANGUAGES,
  TIMEZONES,
} from "./mock-data";
import { ProfileSection } from "./profile-section";

export function BusinessDetails() {
  return (
    <ProfileSection
      id="details"
      title="Business details"
      description="Regional and categorization settings used across scheduling, pricing, and reports."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldSelect
          label="Industry"
          name="industry"
          options={INDUSTRIES}
          defaultValue={DEFAULT_DETAILS.industry}
        />
        <FieldSelect
          label="Timezone"
          name="timezone"
          options={TIMEZONES}
          defaultValue={DEFAULT_DETAILS.timezone}
        />
        <FieldSelect
          label="Currency"
          name="currency"
          options={CURRENCIES}
          defaultValue={DEFAULT_DETAILS.currency}
        />
        <FieldSelect
          label="Language"
          name="language"
          options={LANGUAGES}
          defaultValue={DEFAULT_DETAILS.language}
        />
      </div>
    </ProfileSection>
  );
}
