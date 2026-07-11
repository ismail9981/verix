import type { ComponentType } from "react";
import type { ZodType } from "zod";

/*
 * Section Registry types. A section type is a strongly-typed definition; the
 * registry stores them existentially (unknown props/data) and the renderer
 * re-narrows via the section's own Zod schema.
 */

export interface SectionContext {
  workspaceId: string;
}

export type IconComponent = ComponentType<{ className?: string }>;

export interface SectionEditorProps<P> {
  value: P;
  onChange: (next: P) => void;
  errors?: Partial<Record<string, string[]>>;
}

export interface SectionPreviewProps<P, D> {
  props: P;
  data: D;
}

export interface SectionDefinition<P, D = undefined> {
  key: string;
  version: number;
  displayName: string;
  description: string;
  icon: IconComponent;
  category: string;
  schema: ZodType<P>;
  defaultProps: P;
  Editor: ComponentType<SectionEditorProps<P>>;
  Preview: ComponentType<SectionPreviewProps<P, D>>;
  /**
   * Prop keys that hold plain single-line text and are safe to edit inline on
   * the canvas (e.g. a heading or button label). The visual builder renders a
   * quick-edit field per key; the drawer remains the full editor. Optional.
   */
  inlineText?: readonly InlineTextField[];
}

/** An inline-editable text prop: which prop key, and how to label it. */
export interface InlineTextField {
  key: string;
  label: string;
}

/*
 * Live section data (e.g. the Services grid) is resolved by a server-only
 * resolver keyed by section key — never on the definition — so the definition
 * (and the registry) stays client-safe and can be imported by editors.
 */

/** Existential registry entry — concrete props/data are recovered at render. */
export type UnknownSectionDefinition = SectionDefinition<unknown, unknown>;
