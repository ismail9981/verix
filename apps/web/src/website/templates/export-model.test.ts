import { describe, it, expect } from "vitest";
import {
  TemplateExportError,
  buildExportedTemplate,
  type ExportPage,
  type ExportSection,
} from "./export-model";
import { templateDefinitionSchema } from "./types";
import { getSection } from "../sections/registry";

const heroProps = getSection("hero")!.defaultProps as Record<string, unknown>;
const aboutProps = getSection("about")!.defaultProps as Record<string, unknown>;

const site = { name: "Bloom Studio", themeKey: "elegant" };
// Deliberately out of order to prove sorting by position.
const pages: ExportPage[] = [
  { id: "p2", path: "about", title: "About", position: 2000, seoTitle: "About us", seoDescription: "Our story" },
  { id: "p1", path: "", title: "Home", position: 1000, seoTitle: null, seoDescription: null },
];
const sections: ExportSection[] = [
  { pageId: "p1", typeKey: "about", position: 2000, props: aboutProps, isVisible: true },
  { pageId: "p1", typeKey: "hero", position: 1000, props: heroProps, isVisible: false },
];

describe("buildExportedTemplate", () => {
  const tpl = buildExportedTemplate(site, pages, sections);

  it("produces a schema-valid, re-installable template", () => {
    expect(templateDefinitionSchema.safeParse(tpl).success).toBe(true);
    expect(tpl.pages.length).toBe(2);
  });

  it("preserves the theme", () => {
    expect(tpl.themeKey).toBe("elegant");
  });

  it("orders pages and sections by position", () => {
    expect(tpl.pages.map((p) => p.path)).toEqual(["", "about"]);
    expect(tpl.pages[0]!.sections.map((s) => s.typeKey)).toEqual([
      "hero",
      "about",
    ]);
  });

  it("preserves SEO", () => {
    const about = tpl.pages.find((p) => p.path === "about")!;
    expect(about.seoTitle).toBe("About us");
    expect(about.seoDescription).toBe("Our story");
  });

  it("preserves section visibility", () => {
    const hero = tpl.pages[0]!.sections.find((s) => s.typeKey === "hero")!;
    expect(hero.isVisible).toBe(false);
  });

  it("excludes ids, positions and db metadata (blueprint fields only)", () => {
    const page = tpl.pages[0]! as Record<string, unknown>;
    expect(page.id).toBeUndefined();
    expect(page.position).toBeUndefined();
    const section = tpl.pages[0]!.sections[0]! as Record<string, unknown>;
    expect(section.pageId).toBeUndefined();
    expect(section.position).toBeUndefined();
  });
});

describe("export validation", () => {
  const homePage: ExportPage[] = [
    { id: "p1", path: "", title: "Home", position: 1, seoTitle: null, seoDescription: null },
  ];

  it("rejects an unknown section type", () => {
    expect(() =>
      buildExportedTemplate(site, homePage, [
        { pageId: "p1", typeKey: "ghost", position: 1, props: {}, isVisible: true },
      ]),
    ).toThrow(TemplateExportError);
  });

  it("rejects a section with invalid content", () => {
    expect(() =>
      buildExportedTemplate(site, homePage, [
        { pageId: "p1", typeKey: "hero", position: 1, props: { heading: "" }, isVisible: true },
      ]),
    ).toThrow(TemplateExportError);
  });
});
