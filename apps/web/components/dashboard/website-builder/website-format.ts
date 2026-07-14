import type { BadgeTone } from "../ui/badge";
import type {
  PageStatus,
  SiteStatus,
} from "../../../src/server/validators/website";
import type { DomainListItem } from "../../../src/server/validators/domain";

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

/*
 * Best-guess hostname for the SEO preview cards only — display, not routing.
 * The real canonical-URL/eligibility rule lives server-side in
 * `hosting/site-resolver.ts` (`selectCanonicalHostname`); this mirrors its
 * intent (primary first, else the oldest other live domain) loosely enough
 * for a preview label, without importing server-only routing code into a
 * client bundle.
 */
export function previewHostname(domains: DomainListItem[]): string | null {
  const live = domains.filter((d) => d.status === "active" || d.status === "verified");
  if (live.length === 0) return null;
  const sorted = [...live].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  return sorted[0]!.hostname;
}
