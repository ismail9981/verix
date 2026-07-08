import type {
  CompanyInfo,
  DayHours,
  LocationRow,
  SelectOption,
  ServiceRow,
  SocialLinksData,
} from "./types";

/* All content is mock data for Bloom Studio (a salon). No backend — these
   values seed the uncontrolled form as defaults. */

export const COMPANY: CompanyInfo = {
  name: "Bloom Studio",
  legalName: "Bloom Studio LLC",
  email: "hello@bloomstudio.com",
  phone: "+1 (415) 555-0142",
  website: "https://bloomstudio.com",
  description:
    "A modern hair and beauty studio in San Francisco offering premium styling, color, and nail services for a loyal, growing clientele.",
};

export const BRAND_COLORS = ["#6D5EF9", "#2DD4BF", "#F59E0B", "#EC4899", "#38BDF8"];
export const PRIMARY_BRAND_COLOR = BRAND_COLORS[0]!;

export const INDUSTRIES: SelectOption[] = [
  { value: "beauty", label: "Beauty & Wellness" },
  { value: "health", label: "Health & Medical" },
  { value: "fitness", label: "Fitness" },
  { value: "hospitality", label: "Hospitality" },
  { value: "real-estate", label: "Real Estate" },
  { value: "professional", label: "Professional Services" },
  { value: "other", label: "Other" },
];

export const TIMEZONES: SelectOption[] = [
  { value: "america-los_angeles", label: "(GMT-8) Pacific Time — Los Angeles" },
  { value: "america-denver", label: "(GMT-7) Mountain Time — Denver" },
  { value: "america-chicago", label: "(GMT-6) Central Time — Chicago" },
  { value: "america-new_york", label: "(GMT-5) Eastern Time — New York" },
  { value: "europe-london", label: "(GMT+0) London" },
  { value: "europe-paris", label: "(GMT+1) Paris" },
];

export const CURRENCIES: SelectOption[] = [
  { value: "usd", label: "USD — US Dollar ($)" },
  { value: "eur", label: "EUR — Euro (€)" },
  { value: "gbp", label: "GBP — British Pound (£)" },
  { value: "cad", label: "CAD — Canadian Dollar ($)" },
  { value: "aud", label: "AUD — Australian Dollar ($)" },
];

export const LANGUAGES: SelectOption[] = [
  { value: "en-us", label: "English (US)" },
  { value: "en-gb", label: "English (UK)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
];

export const DEFAULT_DETAILS = {
  industry: "beauty",
  timezone: "america-los_angeles",
  currency: "usd",
  language: "en-us",
};

export const BUSINESS_HOURS: DayHours[] = [
  { day: "Monday", open: true, from: "09:00", to: "18:00" },
  { day: "Tuesday", open: true, from: "09:00", to: "18:00" },
  { day: "Wednesday", open: true, from: "09:00", to: "18:00" },
  { day: "Thursday", open: true, from: "09:00", to: "20:00" },
  { day: "Friday", open: true, from: "09:00", to: "20:00" },
  { day: "Saturday", open: true, from: "10:00", to: "16:00" },
  { day: "Sunday", open: false, from: "10:00", to: "16:00" },
];

export const LOCATIONS: LocationRow[] = [
  { id: "1", name: "Downtown Studio", address: "120 Market St", city: "San Francisco, CA", status: "Active" },
  { id: "2", name: "Marina Salon", address: "88 Chestnut St", city: "San Francisco, CA", status: "Active" },
  { id: "3", name: "Oakland Studio", address: "45 Broadway", city: "Oakland, CA", status: "Draft" },
];

export const SERVICES: ServiceRow[] = [
  { id: "1", name: "Balayage & Cut", duration: "2h 30m", price: "$180", status: "Active" },
  { id: "2", name: "Beard Trim", duration: "30m", price: "$35", status: "Active" },
  { id: "3", name: "Gel Manicure", duration: "45m", price: "$45", status: "Active" },
  { id: "4", name: "Blowout", duration: "45m", price: "$55", status: "Draft" },
  { id: "5", name: "Scalp Treatment", duration: "1h", price: "$90", status: "Inactive" },
];

export const TAX = {
  enabled: true,
  percentage: "8.5",
};

export const SOCIAL: SocialLinksData = {
  facebook: "https://facebook.com/bloomstudio",
  instagram: "https://instagram.com/bloomstudio",
  linkedin: "https://linkedin.com/company/bloomstudio",
  x: "https://x.com/bloomstudio",
};
