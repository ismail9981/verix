import {
  templateDefinitionSchema,
  type TemplateDefinition,
  type TemplateInput,
} from "./types";

/*
 * Identity + validation helper, mirroring defineSection / defineTheme. Parsing
 * at definition time applies defaults and fails fast on a malformed template
 * (build-time error), exactly like the Theme Registry validates its tokens.
 */
export function defineTemplate(template: TemplateInput): TemplateDefinition {
  return templateDefinitionSchema.parse(template);
}
