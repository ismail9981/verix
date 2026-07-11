import { describe, it, expect } from "vitest";
import {
  SNAPSHOT_FORMAT_VERSION,
  normalizePath,
  selectSnapshotPage,
  siteSnapshotSchema,
  type SiteSnapshot,
  type SnapshotPage,
} from "./snapshot";
import { modernTheme } from "../theme/themes/modern";

function page(id: string, path: string, locale = "en-us"): SnapshotPage {
  return {
    id,
    path,
    title: id,
    locale,
    position: 0,
    seo: { title: null, description: null },
    sections: [],
  };
}

function snapshotWith(pages: SnapshotPage[]): SiteSnapshot {
  return {
    format: SNAPSHOT_FORMAT_VERSION,
    site: { id: "s", name: "S", defaultLocale: "en-us", themeKey: "modern" },
    // Clone tokens so per-test mutation can't leak into the shared theme.
    theme: { key: "modern", tokens: structuredClone(modernTheme.tokens) },
    pages,
    publishedAt: new Date().toISOString(),
  };
}

describe("siteSnapshotSchema (read-time guard)", () => {
  it("accepts a well-formed snapshot", () => {
    expect(siteSnapshotSchema.safeParse(snapshotWith([page("home", "")])).success).toBe(
      true,
    );
  });

  it("rejects a wrong snapshot format version", () => {
    const bad: unknown = { ...snapshotWith([]), format: 999 };
    expect(siteSnapshotSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects invalid theme tokens", () => {
    const snap = snapshotWith([]);
    snap.theme.tokens.colors.primary = "red"; // not a 6-digit hex
    expect(siteSnapshotSchema.safeParse(snap).success).toBe(false);
  });
});

describe("selectSnapshotPage / normalizePath", () => {
  const snap = snapshotWith([page("home", ""), page("about", "about")]);

  it("selects the home page for an empty path", () => {
    expect(selectSnapshotPage(snap, "")?.id).toBe("home");
  });
  it("selects by normalized path (leading/trailing slashes)", () => {
    expect(selectSnapshotPage(snap, "/about/")?.id).toBe("about");
  });
  it("returns undefined for an unknown path", () => {
    expect(selectSnapshotPage(snap, "missing")).toBeUndefined();
  });
  it("falls back to the default locale when the requested one is absent", () => {
    expect(selectSnapshotPage(snap, "about", "fr-fr")?.id).toBe("about");
  });
  it("normalizePath strips slashes and lowercases", () => {
    expect(normalizePath("/About/")).toBe("about");
    expect(normalizePath("")).toBe("");
  });
});
