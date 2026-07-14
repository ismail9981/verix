"use client";

/*
 * Shared SEO preview widgets (Sprint 8) — reused by both the site-level and
 * page-level SEO drawers (`sites-panel.tsx`/`pages-panel.tsx`). Pure display;
 * no validation or persistence logic lives here (that stays in the Server
 * Action → service → compiler pipeline).
 */

const RECOMMENDED_TITLE_MAX = 60;
const RECOMMENDED_DESCRIPTION_MAX = 160;

interface LengthCounterProps {
  value: string;
  recommendedMax: number;
}

/** A soft length hint next to a field — never blocks submission, just informs. */
export function SeoLengthCounter({ value, recommendedMax }: LengthCounterProps) {
  const length = value.trim().length;
  const over = length > recommendedMax;
  return (
    <p className={`text-xs ${over ? "text-amber-400" : "text-muted"}`}>
      {length}/{recommendedMax} recommended{over ? " · may be truncated in search results" : ""}
    </p>
  );
}

export function SeoTitleCounter({ value }: { value: string }) {
  return <SeoLengthCounter value={value} recommendedMax={RECOMMENDED_TITLE_MAX} />;
}

export function SeoDescriptionCounter({ value }: { value: string }) {
  return <SeoLengthCounter value={value} recommendedMax={RECOMMENDED_DESCRIPTION_MAX} />;
}

interface SearchResultPreviewProps {
  title: string;
  description: string;
  /** The page's own path segment (or `""` for home) — not a full URL; see `displayUrl` below. */
  path: string;
  /** The site's connected hostname, if any is already known to the caller. */
  hostname?: string | null;
}

/** A schematic Google-style search result card. */
export function SearchResultPreview({ title, description, path, hostname }: SearchResultPreviewProps) {
  const displayUrl = hostname
    ? `${hostname}${path ? `/${path}` : ""}`
    : `your-domain${path ? `/${path}` : ""} (connect a domain to see the real URL)`;

  return (
    <div className="rounded-lg border border-hairline bg-canvas/40 p-4">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Search result preview</p>
      <p className="truncate text-sm text-[#8ab4f8]">{displayUrl}</p>
      <p className="mt-0.5 truncate text-base text-[#a6c8ff]">{title || "Untitled page"}</p>
      <p className="mt-0.5 line-clamp-2 text-sm text-muted">
        {description || "No description set — search engines may show an excerpt of the page instead."}
      </p>
    </div>
  );
}

interface SocialCardPreviewProps {
  title: string;
  description: string;
  imageUrl?: string;
  hostname?: string | null;
}

/** A schematic social (Open Graph) share-card preview. */
export function SocialCardPreview({ title, description, imageUrl, hostname }: SocialCardPreviewProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas/40">
      <p className="px-4 pt-4 text-xs font-medium uppercase tracking-wide text-muted">Social card preview</p>
      <div className="m-4 mt-2 overflow-hidden rounded-md border border-hairline">
        <div className="flex aspect-[1200/630] items-center justify-center bg-surface text-xs text-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary user-provided URL, not an optimizable local asset
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            "Branded image generated automatically"
          )}
        </div>
        <div className="border-t border-hairline p-3">
          <p className="truncate text-xs uppercase tracking-wide text-muted">{hostname ?? "your-domain"}</p>
          <p className="truncate text-sm font-medium text-white">{title || "Untitled page"}</p>
          <p className="line-clamp-2 text-xs text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
