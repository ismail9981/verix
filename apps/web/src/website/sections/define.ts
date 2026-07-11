import type {
  SectionDefinition,
  UnknownSectionDefinition,
} from "../render/types";

/** Identity helper that pins a section's Props/Data generics at definition. */
export function defineSection<P, D = undefined>(
  def: SectionDefinition<P, D>,
): SectionDefinition<P, D> {
  return def;
}

/** Erase a section's generics for storage in the registry map. */
export function toRegistryEntry<P, D>(
  def: SectionDefinition<P, D>,
): UnknownSectionDefinition {
  return def as unknown as UnknownSectionDefinition;
}
