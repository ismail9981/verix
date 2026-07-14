import { describe, it, expect } from "vitest";
import {
  DISALLOW_ALL_ROBOTS_TXT,
  buildRobotsTxt,
  buildSitemapEntries,
  buildSitemapXml,
} from "./seo-output";
import { SNAPSHOT_FORMAT_VERSION, type SiteSnapshot, type SnapshotPage } from "./snapshot";
import { modernTheme } from "../theme/themes/modern";

function page(overrides: Partial<SnapshotPage> = {}): SnapshotPage {
  return {
    id: overrides.id ?? "home",
    path: "",
    title: "Home",
    locale: "en-us",
    position: 0,
    seo: { title: null, description: null },
    sections: [],
    ...overrides,
  };
}

function snapshotWith(pages: SnapshotPage[], siteSeo?: SiteSnapshot["site"]["seo"]): SiteSnapshot {
  return {
    format: SNAPSHOT_FORMAT_VERSION,
    site: { id: "s", name: "Bloom", defaultLocale: "en-us", themeKey: "modern", seo: siteSeo },
    theme: { key: "modern", tokens: structuredClone(modernTheme.tokens) },
    pages,
    publishedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("buildRobotsTxt", () => {
  it("disallows all when not indexable", () => {
    expect(buildRobotsTxt({ indexable: false })).toBe(DISALLOW_ALL_ROBOTS_TXT);
  });

  it("allows all and includes the sitemap when indexable", () => {
    const txt = buildRobotsTxt({ indexable: true, sitemapUrl: "https://bloom.verix.app/sitemap.xml" });
    expect(txt).toContain("Allow: /");
    expect(txt).toContain("Sitemap: https://bloom.verix.app/sitemap.xml");
    expect(txt).not.toContain("Disallow: /");
  });

  it("omits the Sitemap line when no url is given", () => {
    expect(buildRobotsTxt({ indexable: true })).not.toContain("Sitemap:");
  });
});

describe("buildSitemapEntries", () => {
  it("returns no entries for a non-indexable site", () => {
    const snap = snapshotWith([page()], { indexable: false });
    expect(buildSitemapEntries(snap, "https://bloom.verix.app")).toEqual([]);
  });

  it("includes published pages and excludes noindex pages", () => {
    const snap = snapshotWith([
      page({ id: "home", path: "" }),
      page({ id: "hidden", path: "hidden", seo: { title: null, description: null, noIndex: true } }),
      page({ id: "about", path: "about" }),
    ]);
    const entries = buildSitemapEntries(snap, "https://bloom.verix.app");
    expect(entries.map((e) => e.loc)).toEqual([
      "https://bloom.verix.app",
      "https://bloom.verix.app/about",
    ]);
  });

  it("sets lastmod from the snapshot's publishedAt", () => {
    const snap = snapshotWith([page()]);
    expect(buildSitemapEntries(snap, "https://bloom.verix.app")[0]!.lastmod).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });

  it("handles the home page path correctly (no trailing segment)", () => {
    const snap = snapshotWith([page({ path: "" })]);
    expect(buildSitemapEntries(snap, "https://bloom.verix.app")[0]!.loc).toBe(
      "https://bloom.verix.app",
    );
  });

  it("handles nested page paths", () => {
    const snap = snapshotWith([page({ path: "services/hair" })]);
    expect(buildSitemapEntries(snap, "https://bloom.verix.app")[0]!.loc).toBe(
      "https://bloom.verix.app/services/hair",
    );
  });

  it("folds locale variants of the same path into one entry as alternates", () => {
    const snap = snapshotWith([
      page({ id: "en", path: "about", locale: "en-us" }),
      page({ id: "fr", path: "about", locale: "fr-fr" }),
    ]);
    const entries = buildSitemapEntries(snap, "https://bloom.verix.app");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.alternates).toEqual({
      "fr-fr": "https://bloom.verix.app/about?locale=fr-fr",
    });
  });
});

describe("buildSitemapXml", () => {
  it("produces valid, escaped XML with the sitemap namespace", () => {
    const xml = buildSitemapXml([{ loc: "https://bloom.verix.app/a&b", lastmod: "2026-01-01T00:00:00.000Z" }]);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    expect(xml).toContain("<loc>https://bloom.verix.app/a&amp;b</loc>");
    expect(xml).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
  });

  it("produces a valid empty urlset for zero entries", () => {
    const xml = buildSitemapXml([]);
    expect(xml).toContain("<urlset");
    expect(xml).toContain("</urlset>");
    expect(xml).not.toContain("<url>");
  });

  it("emits xhtml:link alternates when present", () => {
    const xml = buildSitemapXml([
      { loc: "https://bloom.verix.app/about", alternates: { "fr-fr": "https://bloom.verix.app/about?locale=fr-fr" } },
    ]);
    expect(xml).toContain('<xhtml:link rel="alternate" hreflang="fr-fr" href="https://bloom.verix.app/about?locale=fr-fr" />');
  });
});
