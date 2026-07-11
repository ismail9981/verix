import { IconBase } from "../../../components/dashboard/ui/icon-base";
import type { IconProps } from "../../../components/dashboard/types";

/* Line icons for the section palette, reusing the shared IconBase. */

export function HeroIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h6" />
    </IconBase>
  );
}

export function AboutIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </IconBase>
  );
}

export function ServicesIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </IconBase>
  );
}

export function ContactIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </IconBase>
  );
}
