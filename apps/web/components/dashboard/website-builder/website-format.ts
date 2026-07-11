import type { BadgeTone } from "../ui/badge";
import type {
  PageStatus,
  SiteStatus,
} from "../../../src/server/validators/website";

/* Presentation helpers for the Website Builder. */

const SITE_TONES: Record<SiteStatus, BadgeTone> = {
  draft: "neutral",
  published: "success",
  unpublished: "warning",
};
const SITE_LABELS: Record<SiteStatus, string> = {
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
};

export function siteStatusTone(status: SiteStatus): BadgeTone {
  return SITE_TONES[status];
}
export function siteStatusLabel(status: SiteStatus): string {
  return SITE_LABELS[status];
}

const PAGE_TONES: Record<PageStatus, BadgeTone> = {
  draft: "neutral",
  ready: "success",
};
const PAGE_LABELS: Record<PageStatus, string> = {
  draft: "Draft",
  ready: "Ready",
};

export function pageStatusTone(status: PageStatus): BadgeTone {
  return PAGE_TONES[status];
}
export function pageStatusLabel(status: PageStatus): string {
  return PAGE_LABELS[status];
}

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

/** A page's display path: "/" for home, otherwise "/path". */
export function displayPath(path: string): string {
  return path === "" ? "/" : `/${path}`;
}
