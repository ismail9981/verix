import { describe, it, expect } from "vitest";
import { buildPageMetadata, buildWebsiteJsonLd } from "./site-metadata";
import {
  SNAPSHOT_FORMAT_VERSION,
  type SiteSnapshot,
  type SnapshotPage,
} from "./snapshot";
import { modernTheme } from "../theme/themes/modern";

const snapshot: SiteSnapshot = {
  format: SNAPSHOT_FORMAT_VERSION,
  site: { id: "s", name: "Bloom Studio", defaultLocale: "en-us", themeKey: "modern" },
  theme: { key: "modern", tokens: modernTheme.tokens },
  pages: [],
  publishedAt: new Date().toISOString(),
};

const page: SnapshotPage = {
  id: "p",
  path: "about",
  title: "About",
  locale: "en-us",
  position: 1,
  seo: { title: null, description: "We cut hair." },
  sections: [],
};

describe("buildPageMetadata", () => {
  it("composes the title with the site name and sets the canonical + description", () => {
    const meta = buildPageMetadata(snapshot, page, "/site/s/about");
    expect(meta.title).toBe("About · Bloom Studio");
    expect(meta.description).toBe("We cut hair.");
    expect((meta.alternates as { canonical?: string }).canonical).toBe(
      "/site/s/about",
    );
  });

  it("sets the Open Graph url to the same canonical value", () => {
    const meta = buildPageMetadata(
      snapshot,
      page,
      "https://bloom.verix.app/about",
    );
    expect(meta.openGraph?.url).toBe("https://bloom.verix.app/about");
  });

  it("prefers seo.title over the page title", () => {
    const meta = buildPageMetadata(
      snapshot,
      { ...page, seo: { title: "Custom Title", description: null } },
      "/x",
    );
    expect(meta.title).toBe("Custom Title · Bloom Studio");
  });

  it("does not duplicate the site name when the title equals it", () => {
    const meta = buildPageMetadata(
      snapshot,
      { ...page, title: "Bloom Studio", seo: { title: null, description: null } },
      "/x",
    );
    expect(meta.title).toBe("Bloom Studio");
  });
});

describe("buildWebsiteJsonLd", () => {
  it("emits WebSite JSON-LD carrying the site name", () => {
    const ld = buildWebsiteJsonLd(snapshot);
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.name).toBe("Bloom Studio");
  });
});
