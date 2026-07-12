import { describe, it, expect } from "vitest";
import { templatePreviewPages } from "./template-preview-model";
import { getTemplate } from "./registry";
import { getSection } from "../sections/registry";

describe("templatePreviewPages (blank)", () => {
  it("mirrors the blank template — one empty Home page", () => {
    const pages = templatePreviewPages(getTemplate("blank")!);
    expect(pages).toHaveLength(1);
    expect(pages[0]!.title).toBe("Home");
    expect(pages[0]!.sections).toHaveLength(0);
  });
});

describe("templatePreviewPages (business)", () => {
  const pages = templatePreviewPages(getTemplate("business")!);

  it("produces all four pages with their section types", () => {
    expect(pages.map((p) => p.title)).toEqual([
      "Home",
      "About",
      "Services",
      "Contact",
    ]);
    expect(pages[0]!.sections.map((s) => s.typeKey)).toEqual([
      "hero",
      "services",
      "contact",
    ]);
  });

  it("merges overrides onto section defaults (exactly what installs)", () => {
    const hero = pages[0]!.sections[0]!;
    expect((hero.props as { heading: string }).heading).toContain(
      "Grow your business",
    );
    // Overridden field...
    expect((hero.props as { ctaHref: string }).ctaHref).toBe("contact");
    // ...and a default that was NOT overridden is still present.
    expect((hero.props as { align: string }).align).toBe("center");
    expect(hero.typeVersion).toBe(getSection("hero")!.version);
  });

  it("gives the services section its (empty) live-data shape", () => {
    const services = pages[0]!.sections[1]!;
    expect(services.data).toEqual({ services: [] });
  });

  it("every previewed section validates against its section schema", () => {
    for (const page of pages) {
      for (const section of page.sections) {
        const def = getSection(section.typeKey)!;
        expect(def.schema.safeParse(section.props).success).toBe(true);
      }
    }
  });
});
