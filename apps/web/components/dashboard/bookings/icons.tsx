import type { IconProps } from "../types";
import { IconBase as Line } from "../ui/icon-base";

export function MoreIcon(p: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={p.className}>
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

export function ClockIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Line>
  );
}

export function MailIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Line>
  );
}

export function PhoneIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 5a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 .76l.9 3.6a1 1 0 0 1-.28.95L8 11a13 13 0 0 0 5 5l1.7-1.7a1 1 0 0 1 .95-.28l3.6.9a1 1 0 0 1 .76 1V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5Z" />
    </Line>
  );
}

export function CalendarIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </Line>
  );
}
