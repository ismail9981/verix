import type { IconProps } from "./types";
import { IconBase as Line } from "./ui/icon-base";

/* Dashboard chrome icons. Same 24px grid / stroke weight as the shared
   landing icon set. Nav-item glyphs that already exist (Website, Booking,
   CRM, AI, Analytics, Payments) are reused from ../landing/icons. */
/* -- Nav glyphs not in the landing set -- */

export function DashboardIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Line>
  );
}

export function TeamIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3 3 0 0 1 0 5.6" />
      <path d="M17.5 13.5a5.5 5.5 0 0 1 3 5.5" />
    </Line>
  );
}

export function SettingsIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8 6 18M18 6l1.8-1.8" />
    </Line>
  );
}

export function BuildingIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M3 21h18" />
      <path d="M6 21V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v17" />
      <path d="M14 21V9h4a1 1 0 0 1 1 1v11" />
      <path d="M9 7h2M9 11h2M9 15h2" />
    </Line>
  );
}

/* -- Header / chrome -- */

export function SearchIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Line>
  );
}

export function BellIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
      <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
    </Line>
  );
}

export function HelpIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.5" />
      <path d="M12 17h.01" />
    </Line>
  );
}

export function MenuIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Line>
  );
}

export function CloseIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Line>
  );
}

/* Collapse / expand the sidebar (panel with a divider). */
export function PanelLeftIcon(p: IconProps) {
  return (
    <Line {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Line>
  );
}

export function ChevronRightIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="m9 6 6 6-6 6" />
    </Line>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  );
}

export function UserIcon(p: IconProps) {
  return (
    <Line {...p}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </Line>
  );
}

export function LogOutIcon(p: IconProps) {
  return (
    <Line {...p}>
      <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
      <path d="M10 8 6 12l4 4M6 12h11" />
    </Line>
  );
}
