import { describe, it, expect } from "vitest";
import {
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildPageMetadata,
  buildServiceJsonLd,
  buildStructuredData,
  buildWebPageJsonLd,
  buildWebsiteJsonLd,
  findLocaleVariants,
  nonIndexableMetadata,
  resolveSiteIndexable,
  serializeJsonLd,
} from "./site-metadata";
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

  it("falls back to the site default title/description when the page has none", () => {
    const snap: SiteSnapshot = {
      ...snapshot,
      site: { ...snapshot.site, seo: { defaultTitle: "Default Title", defaultDescription: "Default desc" } },
    };
    const meta = buildPageMetadata(snap, { ...page, title: "", seo: { title: null, description: null } }, "/x");
    expect(meta.title).toBe("Default Title · Bloom Studio");
    expect(meta.description).toBe("Default desc");
  });

  it("applies the site's title template with %s substitution", () => {
    const snap: SiteSnapshot = {
      ...snapshot,
      site: { ...snapshot.site, seo: { titleTemplate: "%s | Bloom" } },
    };
    const meta = buildPageMetadata(snap, page, "/x");
    expect(meta.title).toBe("About | Bloom");
  });

  it("uses the template verbatim when it has no %s placeholder", () => {
    const snap: SiteSnapshot = {
      ...snapshot,
      site: { ...snapshot.site, seo: { titleTemplate: "Fixed Title" } },
    };
    const meta = buildPageMetadata(snap, page, "/x");
    expect(meta.title).toBe("Fixed Title");
  });

  it("defaults robots to index+follow when nothing is configured", () => {
    const meta = buildPageMetadata(snapshot, page, "/x");
    expect(meta.robots).toEqual({ index: true, follow: true });
  });

  it("respects page-level noindex/nofollow", () => {
    const meta = buildPageMetadata(
      snapshot,
      { ...page, seo: { title: null, description: null, noIndex: true, noFollow: true } },
      "/x",
    );
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("site-level indexable=false forces noindex even if the page doesn't set it", () => {
    const snap: SiteSnapshot = {
      ...snapshot,
      site: { ...snapshot.site, seo: { indexable: false } },
    };
    const meta = buildPageMetadata(snap, page, "/x");
    expect(meta.robots).toEqual({ index: false, follow: true });
  });

  it("OG title/description fall back to the composed title/description when unset", () => {
    const meta = buildPageMetadata(snapshot, page, "/x");
    expect(meta.openGraph?.title).toBe(meta.title);
    expect(meta.openGraph?.description).toBe("We cut hair.");
  });

  it("prefers explicit ogTitle/ogDescription over the composed fallback", () => {
    const meta = buildPageMetadata(
      snapshot,
      { ...page, seo: { title: null, description: "desc", ogTitle: "Social Title", ogDescription: "Social desc" } },
      "/x",
    );
    expect(meta.openGraph?.title).toBe("Social Title");
    expect(meta.openGraph?.description).toBe("Social desc");
  });

  describe("social image fallback order", () => {
    it("prefers the page's own OG image", () => {
      const snap: SiteSnapshot = { ...snapshot, site: { ...snapshot.site, seo: { defaultImageUrl: "https://x.test/site.png" } } };
      const meta = buildPageMetadata(
        snap,
        { ...page, seo: { title: null, description: null, ogImageUrl: "https://x.test/page.png" } },
        "/x",
        "https://bloom.verix.app",
      );
      expect(meta.openGraph?.images).toEqual([{ url: "https://x.test/page.png", width: 1200, height: 630 }]);
    });

    it("falls back to the site default image when the page has none", () => {
      const snap: SiteSnapshot = { ...snapshot, site: { ...snapshot.site, seo: { defaultImageUrl: "https://x.test/site.png" } } };
      const meta = buildPageMetadata(snap, page, "/x", "https://bloom.verix.app");
      expect(meta.openGraph?.images).toEqual([{ url: "https://x.test/site.png", width: 1200, height: 630 }]);
    });

    it("falls back to the generated social-image route when neither is set and an origin exists", () => {
      const meta = buildPageMetadata(snapshot, page, "/x", "https://bloom.verix.app");
      const images = meta.openGraph?.images as { url: string }[];
      expect(images[0]!.url).toBe(
        "https://bloom.verix.app/site/s/social-image?p=about&l=en-us",
      );
    });

    it("omits the image entirely when there is no origin and no configured image", () => {
      const meta = buildPageMetadata(snapshot, page, "/site/s/about", null);
      expect(meta.openGraph?.images).toBeUndefined();
      expect((meta.twitter as { card?: string })?.card).toBe("summary");
    });
  });

  it("includes alternate language links only when provided and non-empty", () => {
    const withAlt = buildPageMetadata(snapshot, page, "/x", null, { "fr-fr": "/x?locale=fr-fr" });
    expect((withAlt.alternates as { languages?: unknown }).languages).toEqual({ "fr-fr": "/x?locale=fr-fr" });

    const withoutAlt = buildPageMetadata(snapshot, page, "/x", null, {});
    expect((withoutAlt.alternates as { languages?: unknown }).languages).toBeUndefined();
  });
});

describe("nonIndexableMetadata", () => {
  it("always returns explicit noindex/nofollow, never an empty default-indexable object", () => {
    expect(nonIndexableMetadata()).toEqual({ robots: { index: false, follow: false } });
  });
});

describe("resolveSiteIndexable", () => {
  it("defaults to true when unset (pre-Sprint-8 snapshot)", () => {
    expect(resolveSiteIndexable(snapshot)).toBe(true);
  });
  it("respects an explicit false", () => {
    expect(resolveSiteIndexable({ ...snapshot, site: { ...snapshot.site, seo: { indexable: false } } })).toBe(false);
  });
});

describe("findLocaleVariants", () => {
  it("finds other-locale pages sharing the same normalized path", () => {
    const fr: SnapshotPage = { ...page, id: "p-fr", locale: "fr-fr" };
    const variants = findLocaleVariants({ ...snapshot, pages: [page, fr] }, page);
    expect(variants.map((v) => v.id)).toEqual(["p-fr"]);
  });
  it("returns empty when there are no other-locale variants", () => {
    expect(findLocaleVariants({ ...snapshot, pages: [page] }, page)).toEqual([]);
  });
});

describe("buildWebsiteJsonLd", () => {
  it("emits WebSite JSON-LD carrying the site name", () => {
    const ld = buildWebsiteJsonLd(snapshot);
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.name).toBe("Bloom Studio");
    expect(ld.url).toBeUndefined();
  });
  it("includes the url when an origin is given", () => {
    expect(buildWebsiteJsonLd(snapshot, "https://bloom.verix.app").url).toBe("https://bloom.verix.app");
  });
});

describe("buildOrganizationJsonLd", () => {
  it("omits contactPoint/logo when no contact section or image exists", () => {
    const ld = buildOrganizationJsonLd(snapshot);
    expect(ld["@type"]).toBe("Organization");
    expect(ld.contactPoint).toBeUndefined();
    expect(ld.logo).toBeUndefined();
  });

  it("sources contactPoint only from a frozen Contact section's props (never workspace/account data)", () => {
    const withContact: SiteSnapshot = {
      ...snapshot,
      pages: [
        {
          ...page,
          sections: [
            {
              id: "c1",
              typeKey: "contact",
              typeVersion: 1,
              props: { heading: "Get in touch", email: "hi@bloom.test", phone: "555-0100", address: "" },
              data: null,
            },
          ],
        },
      ],
    };
    const ld = buildOrganizationJsonLd(withContact);
    expect(ld.contactPoint).toEqual({
      "@type": "ContactPoint",
      email: "hi@bloom.test",
      telephone: "555-0100",
      contactType: "customer service",
    });
  });

  it("never fabricates values for properties that don't exist", () => {
    const ld = buildOrganizationJsonLd(snapshot);
    expect(Object.prototype.hasOwnProperty.call(ld, "address")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(ld, "aggregateRating")).toBe(false);
  });
});

describe("buildWebPageJsonLd", () => {
  it("uses the resolved title/description and canonical url", () => {
    const ld = buildWebPageJsonLd(page, snapshot, "https://bloom.verix.app/about");
    expect(ld["@type"]).toBe("WebPage");
    expect(ld.name).toBe("About");
    expect(ld.description).toBe("We cut hair.");
    expect(ld.url).toBe("https://bloom.verix.app/about");
  });
});

describe("buildBreadcrumbJsonLd", () => {
  it("omits breadcrumbs for a top-level page (home or single segment)", () => {
    expect(buildBreadcrumbJsonLd(page)).toBeUndefined();
    expect(buildBreadcrumbJsonLd({ ...page, path: "" })).toBeUndefined();
  });

  it("builds a breadcrumb for a nested path", () => {
    const nested: SnapshotPage = { ...page, path: "services/hair-cuts", title: "Hair Cuts" };
    const ld = buildBreadcrumbJsonLd(nested, "https://bloom.verix.app");
    expect(ld?.["@type"]).toBe("BreadcrumbList");
    const items = ld?.itemListElement as { name: string; position: number; item?: string }[];
    expect(items.map((i) => i.name)).toEqual(["Home", "Services", "Hair Cuts"]);
    expect(items[0]!.item).toBe("https://bloom.verix.app");
    expect(items[2]!.item).toBe("https://bloom.verix.app/services/hair-cuts");
  });
});

describe("buildServiceJsonLd", () => {
  it("omits Service entries when no services section exists", () => {
    expect(buildServiceJsonLd(page, snapshot)).toEqual([]);
  });

  it("emits one Service per frozen services-section item, never inventing price/rating", () => {
    const withServices: SnapshotPage = {
      ...page,
      sections: [
        {
          id: "sv1",
          typeKey: "services",
          typeVersion: 1,
          props: {},
          data: {
            services: [
              { id: "1", name: "Haircut", description: "A trim.", priceCents: 2000, durationMinutes: 30 },
              { id: "2", name: "", description: null, priceCents: 0, durationMinutes: 10 },
            ],
          },
        },
      ],
    };
    const services = buildServiceJsonLd(withServices, snapshot);
    expect(services).toHaveLength(1);
    expect(services[0]).toEqual({
      "@type": "Service",
      name: "Haircut",
      description: "A trim.",
      provider: { "@type": "Organization", name: "Bloom Studio" },
    });
    expect(services[0]).not.toHaveProperty("offers");
    expect(services[0]).not.toHaveProperty("aggregateRating");
  });
});

describe("buildStructuredData / serializeJsonLd", () => {
  it("combines WebSite + Organization + WebPage into one @graph", () => {
    const data = buildStructuredData(snapshot, page, "https://bloom.verix.app/about", "https://bloom.verix.app");
    expect(data["@context"]).toBe("https://schema.org");
    const graph = data["@graph"] as Record<string, unknown>[];
    expect(graph.map((n) => n["@type"])).toEqual(["WebSite", "Organization", "WebPage"]);
  });

  it("escapes `<` so a malicious site/page name can't break out of the script tag", () => {
    const evil: SiteSnapshot = { ...snapshot, site: { ...snapshot.site, name: "</script><script>alert(1)</script>" } };
    const json = serializeJsonLd(buildStructuredData(evil, page, "/x", null));
    expect(json).not.toContain("</script>");
    expect(json).toContain("\\u003c/script>");
  });
});
