import type { ReactNode } from "react";

export interface IconProps {
  className?: string;
}

/* One shared line-icon system: 24px grid, currentColor stroke, consistent
   weight and caps. Keeps every section's iconography visually uniform. */
function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

/* -- Features -- */

export function WebsiteIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
      <path d="M6 6.5h.01M8.5 6.5h.01" />
    </Icon>
  );
}

export function BookingIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
      <path d="m9 14 2 2 4-4" />
    </Icon>
  );
}

export function CrmIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20a5 5 0 0 1 10 0" />
      <path d="M16.5 5.3a3 3 0 0 1 0 5.4" />
      <path d="M15.5 15.2A5 5 0 0 1 20 20" />
    </Icon>
  );
}

export function AiIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M12 3.5 13.4 8 18 9.4 13.4 10.8 12 15.3 10.6 10.8 6 9.4 10.6 8 12 3.5Z" />
      <path d="M18 15.5 18.7 17.3 20.5 18 18.7 18.7 18 20.5 17.3 18.7 15.5 18 17.3 17.3 18 15.5Z" />
    </Icon>
  );
}

export function AnalyticsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 4v16h16" />
      <path d="M8 16v-3M12 16V9M16 16v-6" />
    </Icon>
  );
}

export function PaymentsIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
    </Icon>
  );
}

/* -- Industries -- */

export function TourismIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 4.8L8.5 15.5l2.2-4.8 4.8-2.2Z" />
    </Icon>
  );
}

export function RealEstateIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M4 11 12 5l8 6" />
      <path d="M6 10v9h12v-9" />
      <path d="M10 19v-4h4v4" />
    </Icon>
  );
}

export function ClinicIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  );
}

export function RestaurantIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M6 3v6a2 2 0 0 0 4 0V3M8 9v12" />
      <path d="M17 3c-1.6 0-2.5 2-2.5 4.5S15.4 11 17 11v10" />
    </Icon>
  );
}

export function SalonIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <path d="M8 7.6 20 18M8 16.4 20 6M8.3 8.3 13 12" />
    </Icon>
  );
}

export function GymIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" />
    </Icon>
  );
}

/* -- UI -- */

export function CheckIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m5 13 4 4L19 7" />
    </Icon>
  );
}

export function ChevronDownIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  );
}

export function ArrowRightIcon(p: IconProps) {
  return (
    <Icon {...p}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Icon>
  );
}

/* -- Social (filled brand glyphs) -- */

function SocialGlyph({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function GitHubIcon(p: IconProps) {
  return (
    <SocialGlyph {...p}>
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.6 18 4.9 18 4.9c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5Z" />
    </SocialGlyph>
  );
}

export function LinkedInIcon(p: IconProps) {
  return (
    <SocialGlyph {...p}>
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14ZM7.12 20.45H3.55V9h3.57v11.45ZM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.2.8 24 1.77 24h20.45c.98 0 1.78-.8 1.78-1.75V1.75C24 .78 23.2 0 22.22 0Z" />
    </SocialGlyph>
  );
}

export function XIcon(p: IconProps) {
  return (
    <SocialGlyph {...p}>
      <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.6l5.24 6.93 6.06-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.29L17.61 20.65Z" />
    </SocialGlyph>
  );
}
