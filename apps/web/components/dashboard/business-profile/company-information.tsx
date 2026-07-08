import { FieldInput } from "./field-input";
import { FieldTextarea } from "./field-textarea";
import { COMPANY } from "./mock-data";
import { ProfileSection } from "./profile-section";

export function CompanyInformation() {
  return (
    <ProfileSection
      id="company"
      title="Company information"
      description="Basic details about your business, shown to customers and on invoices."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FieldInput label="Business name" name="businessName" defaultValue={COMPANY.name} required />
        <FieldInput label="Legal name" name="legalName" defaultValue={COMPANY.legalName} />
        <FieldInput label="Email" name="email" type="email" defaultValue={COMPANY.email} />
        <FieldInput label="Phone" name="phone" type="tel" defaultValue={COMPANY.phone} />
        <div className="sm:col-span-2">
          <FieldInput label="Website" name="website" type="url" defaultValue={COMPANY.website} />
        </div>
        <div className="sm:col-span-2">
          <FieldTextarea
            label="Description"
            name="description"
            defaultValue={COMPANY.description}
            helperText="A short summary of your business. Appears on your public profile."
          />
        </div>
      </div>
    </ProfileSection>
  );
}
