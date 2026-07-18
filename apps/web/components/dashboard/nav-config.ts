import {
  AiIcon,
  AnalyticsIcon,
  BookingIcon,
  CrmIcon,
  PaymentsIcon,
  WebsiteIcon,
} from "../landing/icons";
import {
  BuildingIcon,
  DashboardIcon,
  HousekeepingIcon,
  PropertyManagementIcon,
  ReservationIcon,
  SettingsIcon,
  TeamIcon,
} from "./icons";
import { InboxIcon } from "./leads/icons";
import type { NavItem } from "./types";

/* Single source of truth for the sidebar, mobile drawer, and breadcrumb
   labels. Add an authenticated section here and it appears everywhere. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { label: "Website Builder", href: "/website-builder", icon: WebsiteIcon },
  { label: "Business Profile", href: "/business-profile", icon: BuildingIcon },
  { label: "Bookings", href: "/bookings", icon: BookingIcon },
  { label: "Reservations", href: "/reservations", icon: ReservationIcon },
  { label: "Property Management", href: "/property-management", icon: PropertyManagementIcon },
  { label: "Housekeeping", href: "/housekeeping", icon: HousekeepingIcon },
  { label: "CRM", href: "/crm", icon: CrmIcon },
  { label: "Leads", href: "/leads", icon: InboxIcon },
  { label: "AI Assistant", href: "/ai", icon: AiIcon },
  { label: "Analytics", href: "/analytics", icon: AnalyticsIcon },
  { label: "Payments", href: "/payments", icon: PaymentsIcon },
  { label: "Team", href: "/team", icon: TeamIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

/** Where the app sends users after the auth flow / logo click. */
export const HOME_HREF = "/dashboard";

/** Maps a route path to its human label (used by breadcrumbs). */
export const LABEL_BY_HREF: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.href, item.label]),
);
