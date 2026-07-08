import { LinkedInIcon, XIcon } from "../../landing/icons";
import { FieldInput } from "./field-input";
import { FacebookIcon, InstagramIcon } from "./icons";
import { SOCIAL } from "./mock-data";
import { ProfileSection } from "./profile-section";

const LINKS = [
  { label: "Facebook", name: "facebook", icon: FacebookIcon, value: SOCIAL.facebook },
  { label: "Instagram", name: "instagram", icon: InstagramIcon, value: SOCIAL.instagram },
  { label: "LinkedIn", name: "linkedin", icon: LinkedInIcon, value: SOCIAL.linkedin },
  { label: "X", name: "x", icon: XIcon, value: SOCIAL.x },
];

export function SocialLinks() {
  return (
    <ProfileSection
      id="social"
      title="Social links"
      description="Connect your profiles. These appear on your website and booking pages."
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {LINKS.map(({ label, name, icon: Icon, value }) => (
          <FieldInput
            key={name}
            label={label}
            name={name}
            type="url"
            defaultValue={value}
            leftIcon={<Icon className="h-4 w-4" />}
          />
        ))}
      </div>
    </ProfileSection>
  );
}
