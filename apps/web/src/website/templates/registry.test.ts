import { describe, it, expect } from "vitest";
import { getTemplate, hasTemplate, listTemplates } from "./registry";
import { templateDefinitionSchema } from "./types";
import { hasSection } from "../sections/registry";
import { hasTheme } from "../theme/registry";

describe("template registry", () => {
  it("registers the blank and business templates", () => {
    const keys = listTemplates()
      .map((t) => t.key)
      .sort();
    expect(keys).toEqual(["blank", "business"]);
  });

  it("getTemplate / hasTemplate behave like the other registries", () => {
    expect(hasTemplate("blank")).toBe(true);
    expect(hasTemplate("nope")).toBe(false);
    expect(getTemplate("business")?.name).toBe("Business");
    expect(getTemplate("nope")).toBeUndefined();
  });

  it("every template validates against the schema", () => {
    for (const t of listTemplates()) {
      expect(templateDefinitionSchema.safeParse(t).success).toBe(true);
    }
  });

  it("every referenced section type and theme is registered", () => {
    for (const t of listTemplates()) {
      expect(hasTheme(t.themeKey)).toBe(true);
      for (const page of t.pages) {
        for (const section of page.sections) {
          expect(hasSection(section.typeKey)).toBe(true);
        }
      }
    }
  });
});

describe("blank template", () => {
  it("is a single empty Home page", () => {
    const t = getTemplate("blank")!;
    expect(t.pages).toHaveLength(1);
    expect(t.pages[0]!.path).toBe("");
    expect(t.pages[0]!.title).toBe("Home");
    expect(t.pages[0]!.sections).toHaveLength(0);
    expect(t.themeKey).toBe("modern");
  });
});

describe("business template", () => {
  const t = getTemplate("business")!;

  it("has Home, About, Services and Contact pages", () => {
    expect(t.pages.map((p) => p.path)).toEqual(["", "about", "services", "contact"]);
    expect(t.pages.map((p) => p.title)).toEqual([
      "Home",
      "About",
      "Services",
      "Contact",
    ]);
  });

  it("places the expected section types per page", () => {
    const byPath = Object.fromEntries(
      t.pages.map((p) => [p.path, p.sections.map((s) => s.typeKey)]),
    );
    expect(byPath[""]).toEqual(["hero", "services", "contact"]);
    expect(byPath["about"]).toEqual(["about"]);
    expect(byPath["services"]).toEqual(["services"]);
    expect(byPath["contact"]).toEqual(["contact"]);
  });

  it("assigns a theme and applies section defaults (isVisible, props)", () => {
    expect(t.themeKey).toBe("minimal");
    const hero = t.pages[0]!.sections[0]!;
    expect(hero.isVisible).toBe(true); // schema default
    expect(hero.props.heading).toContain("Grow your business");
  });
});
