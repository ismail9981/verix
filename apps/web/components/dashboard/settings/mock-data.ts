import { AiIcon, PaymentsIcon } from "../../landing/icons";
import { HashIcon } from "../ai/icons";
import { CalendarIcon } from "../bookings/icons";
import {
  BRAND_COLORS,
  CURRENCIES,
  LANGUAGES,
  TIMEZONES,
} from "../business-profile/mock-data";
import type {
  ApiKey,
  Integration,
  NotificationSetting,
  Session,
  ThemeOption,
} from "./types";

/* All settings content is mock (Bloom Studio, a salon). Kept here so a real
   settings API can be dropped in without touching any component. Regional
   option lists are reused from the Business Profile module. */

export { BRAND_COLORS, CURRENCIES, LANGUAGES, TIMEZONES };

export const WORKSPACE_NAME = "Bloom Studio";

export const DEFAULT_GENERAL = {
  timezone: "america-los_angeles",
  language: "en-us",
  currency: "usd",
};

export const NOTIFICATIONS: NotificationSetting[] = [
  { id: "email", label: "Email notifications", description: "Receive account and activity updates by email.", defaultOn: true },
  { id: "push", label: "Push notifications", description: "Get real-time alerts in your browser and mobile app.", defaultOn: true },
  { id: "bookings", label: "Booking alerts", description: "Be notified when a booking is made, changed, or cancelled.", defaultOn: true },
  { id: "reports", label: "Weekly reports", description: "A weekly summary of revenue, bookings, and growth.", defaultOn: false },
];

export const SESSIONS: Session[] = [
  { id: "s1", device: "MacBook Pro · Chrome", location: "San Francisco, US", lastActive: "Active now", current: true },
  { id: "s2", device: "iPhone 15 · Safari", location: "San Francisco, US", lastActive: "2 hours ago", current: false },
  { id: "s3", device: "iPad · Safari", location: "Oakland, US", lastActive: "Yesterday", current: false },
];

export const API_KEYS: ApiKey[] = [
  { id: "k1", name: "Production", masked: "vx_live_••••••••4a2f", created: "Created Mar 4, 2026" },
  { id: "k2", name: "Website widget", masked: "vx_live_••••••••9c1d", created: "Created May 22, 2026" },
];

export const INTEGRATIONS: Integration[] = [
  { id: "stripe", name: "Stripe", description: "Accept card payments and manage payouts.", icon: PaymentsIcon, connected: true },
  { id: "gcal", name: "Google Calendar", description: "Sync bookings with your team's calendars.", icon: CalendarIcon, connected: true },
  { id: "openai", name: "OpenAI", description: "Power the AI assistant with GPT models.", icon: AiIcon, connected: true },
  { id: "slack", name: "Slack", description: "Send booking and payment alerts to a channel.", icon: HashIcon, connected: false },
];

export const THEMES: ThemeOption[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

export const DEFAULT_APPEARANCE = {
  theme: "dark",
  accent: BRAND_COLORS[0]!,
  compact: false,
};
