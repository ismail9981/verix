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
  InvoiceIcon,
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
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: DashboardIcon,
    capability: "reports.operational.read",
  },
  {
    label: "Website Builder",
    href: "/website-builder",
    icon: WebsiteIcon,
    capability: "website.design.manage",
  },
  {
    label: "Business Profile",
    href: "/business-profile",
    icon: BuildingIcon,
    capability: "workspace.settings.read",
  },
  {
    label: "Bookings",
    href: "/bookings",
    icon: BookingIcon,
    capability: "bookings.read",
  },
  {
    label: "Reservations",
    href: "/reservations",
    icon: ReservationIcon,
    capability: "reservations.read",
  },
  {
    label: "Property Management",
    href: "/property-management",
    icon: PropertyManagementIcon,
    capability: "properties.read",
  },
  {
    label: "Housekeeping",
    href: "/housekeeping",
    icon: HousekeepingIcon,
    capability: "housekeeping.read",
  },
  { label: "CRM", href: "/crm", icon: CrmIcon, capability: "customers.read" },
  { label: "Leads", href: "/leads", icon: InboxIcon, capability: "leads.read" },
  {
    label: "AI Assistant",
    href: "/ai",
    icon: AiIcon,
    capability: "workspace.read",
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: AnalyticsIcon,
    capability: "reports.financial.read",
  },
  {
    label: "Payments",
    href: "/payments",
    icon: PaymentsIcon,
    capability: "payments.read",
  },
  {
    label: "Invoices",
    href: "/invoices",
    icon: InvoiceIcon,
    capability: "invoices.read",
  },
  {
    label: "Team",
    href: "/team",
    icon: TeamIcon,
    capability: "workspace.members.read",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
    capability: "workspace.settings.read",
  },
];

/** Where the app sends users after the auth flow / logo click. */
export const HOME_HREF = "/dashboard";

/** Maps a route path to its human label (used by breadcrumbs). */
export const LABEL_BY_HREF: Record<string, string> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.href, item.label]),
);
