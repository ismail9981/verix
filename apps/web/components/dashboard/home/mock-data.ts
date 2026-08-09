import { BookingIcon, CrmIcon, WebsiteIcon } from "../../landing/icons";
import { UserPlusIcon } from "./icons";
import type { Insight, QuickAction } from "./types";

/* Remaining mock content on the dashboard — the AI Insights and Quick
   Actions sections are deliberately static/non-analytics (out of scope for
   Sprint 18's real-data dashboard analytics; see that sprint's design
   proposal). Everything else formerly here (stats, revenue, appointments,
   activity) was replaced by real data — see `dashboard-analytics-manager.tsx`
   and `dashboard-analytics.service.ts`. */

export const BUSINESS_NAME = "Bloom Studio";
export const USER_FIRST_NAME = "Jordan";

export const INSIGHTS: Insight[] = [
  {
    id: "1",
    kind: "suggestion",
    title: "Fill your Tuesday gaps",
    description: "Tuesdays run 30% below capacity. A midweek promo could recover ~$1,200/month.",
  },
  {
    id: "2",
    kind: "marketing",
    title: "Launch a summer color campaign",
    description: "Color services trend up in July. Email 480 lapsed clients with a seasonal offer.",
  },
  {
    id: "3",
    kind: "alert",
    title: "3 appointments unconfirmed",
    description: "Three clients haven't confirmed tomorrow. Send a reminder to cut no-shows.",
  },
];

export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Create booking", description: "Schedule a new appointment", href: "/bookings", icon: BookingIcon },
  { label: "Add customer", description: "Add a profile to your CRM", href: "/crm", icon: UserPlusIcon },
  { label: "Generate website", description: "Build a page with AI", href: "/website-builder", icon: WebsiteIcon },
  { label: "Open CRM", description: "View customer relationships", href: "/crm", icon: CrmIcon },
];
