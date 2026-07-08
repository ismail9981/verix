export type PageStatus = "Published" | "Draft";

export interface SitePage {
  id: string;
  name: string;
  path: string;
  status: PageStatus;
  home?: boolean;
}

export interface BuilderSection {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export interface ThemeOption {
  id: string;
  name: string;
  /** Two-stop gradient for the theme swatch. */
  colors: [string, string];
}

export interface RadiusOption {
  id: string;
  label: string;
  /** Preview radius, in px. */
  value: number;
}

export interface StatusLine {
  label: string;
  value: string;
  ok: boolean;
}

export interface HeroContent {
  title: string;
  subtitle: string;
  primaryCta: string;
  secondaryCta: string;
}

export interface SeoContent {
  metaTitle: string;
  metaDescription: string;
}
