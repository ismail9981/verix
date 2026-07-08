import type {
  BuilderSection,
  HeroContent,
  RadiusOption,
  SeoContent,
  SitePage,
  StatusLine,
  ThemeOption,
} from "./types";

/* Mock content for Bloom Studio's website. No backend — this seeds the
   builder's local state and can be swapped for a real site payload later. */

export const OVERVIEW = {
  status: "Published",
  theme: "Aurora",
  version: "v14",
  lastUpdated: "2 hours ago",
  unpublishedChanges: 3,
};

export const PAGES: SitePage[] = [
  { id: "home", name: "Home", path: "/", status: "Published", home: true },
  { id: "about", name: "About", path: "/about", status: "Published" },
  { id: "services", name: "Services", path: "/services", status: "Published" },
  { id: "contact", name: "Contact", path: "/contact", status: "Published" },
  { id: "blog", name: "Blog", path: "/blog", status: "Draft" },
];

export const THEMES: ThemeOption[] = [
  { id: "aurora", name: "Aurora", colors: ["#6d5ef9", "#2dd4bf"] },
  { id: "minimal", name: "Minimal", colors: ["#27272a", "#a1a1aa"] },
  { id: "bold", name: "Bold", colors: ["#ec4899", "#f59e0b"] },
  { id: "editorial", name: "Editorial", colors: ["#0ea5e9", "#6366f1"] },
];

export const ACCENT_COLORS = ["#6D5EF9", "#2DD4BF", "#F59E0B", "#EC4899", "#38BDF8"];

export const FONTS = [
  { value: "inter", label: "Inter" },
  { value: "geist", label: "Geist" },
  { value: "manrope", label: "Manrope" },
  { value: "playfair", label: "Playfair Display" },
  { value: "sohne", label: "Söhne" },
];

export const RADII: RadiusOption[] = [
  { id: "none", label: "None", value: 0 },
  { id: "sm", label: "Small", value: 6 },
  { id: "md", label: "Medium", value: 12 },
  { id: "lg", label: "Large", value: 20 },
  { id: "full", label: "Full", value: 999 },
];

export const DEFAULT_THEME = "aurora";
export const DEFAULT_ACCENT = ACCENT_COLORS[0]!;
export const DEFAULT_FONT = "inter";
export const DEFAULT_RADIUS = "md";

export const HERO: HeroContent = {
  title: "Look your best at Bloom Studio",
  subtitle:
    "Premium hair, color, and nail services in the heart of San Francisco. Book your appointment in seconds.",
  primaryCta: "Book now",
  secondaryCta: "View services",
};

export const SECTIONS: BuilderSection[] = [
  { id: "features", name: "Features", description: "Highlight what makes your studio special", enabled: true },
  { id: "gallery", name: "Gallery", description: "Showcase your work in a photo grid", enabled: true },
  { id: "testimonials", name: "Testimonials", description: "Reviews from happy customers", enabled: true },
  { id: "faq", name: "FAQ", description: "Answer common questions", enabled: false },
  { id: "contact", name: "Contact", description: "Map, hours, and a contact form", enabled: true },
];

export const SEO: SeoContent = {
  metaTitle: "Bloom Studio — Hair, Color & Nails in San Francisco",
  metaDescription:
    "Book premium hair, color, and nail services at Bloom Studio in San Francisco. Expert stylists, easy online booking, and a beautiful space.",
};

export const DOMAIN = {
  domain: "bloomstudio.com",
  lines: [
    { label: "SSL certificate", value: "Active", ok: true },
    { label: "DNS", value: "Verified", ok: true },
    { label: "Nameservers", value: "Verix DNS", ok: true },
  ] satisfies StatusLine[],
};
