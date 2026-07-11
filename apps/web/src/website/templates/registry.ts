import { hasSection } from "../sections/registry";
import { hasTheme } from "../theme/registry";
import { blankTemplate } from "./templates/blank";
import { businessTemplate } from "./templates/business";
import type { TemplateDefinition } from "./types";

/*
 * The Template Registry — a key→template Map, exactly like the Section and Theme
 * registries. Lookups are O(1) and there are no switch statements. At
 * registration every template is checked to reference only real section types
 * and a real theme, so a broken blueprint fails fast at build time rather than
 * at install time (client-safe: no db/server imports).
 */

const REGISTRY = new Map<string, TemplateDefinition>();

function register(template: TemplateDefinition): void {
  for (const page of template.pages) {
    for (const section of page.sections) {
      if (!hasSection(section.typeKey)) {
        throw new Error(
          `Template "${template.key}" references unknown section "${section.typeKey}".`,
        );
      }
    }
  }
  if (!hasTheme(template.themeKey)) {
    throw new Error(
      `Template "${template.key}" references unknown theme "${template.themeKey}".`,
    );
  }
  REGISTRY.set(template.key, template);
}

register(blankTemplate);
register(businessTemplate);

export function getTemplate(key: string): TemplateDefinition | undefined {
  return REGISTRY.get(key);
}

export function hasTemplate(key: string): boolean {
  return REGISTRY.has(key);
}

export function listTemplates(): TemplateDefinition[] {
  return [...REGISTRY.values()];
}
