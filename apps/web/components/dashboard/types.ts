import type { ComponentType } from "react";
import type { Capability } from "../../src/server/auth/capabilities";

export interface IconProps {
  className?: string;
}

export type IconComponent = ComponentType<IconProps>;

export interface NavItem {
  label: string;
  href: string;
  icon: IconComponent;
  capability: Capability;
}

export interface Workspace {
  id: string;
  name: string;
  plan: string;
  /** Single-letter avatar fallback. */
  initial: string;
  /** Avatar background color (hex). */
  color: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
}

export interface UserProfile {
  name: string;
  email: string;
  initials: string;
}

export interface Crumb {
  label: string;
  href: string;
  /** True for the final segment (the current page). */
  current: boolean;
}
