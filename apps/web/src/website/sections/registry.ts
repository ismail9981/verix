import type { UnknownSectionDefinition } from "../render/types";
import { toRegistryEntry } from "./define";
import { heroSection } from "./hero";
import { aboutSection } from "./about";
import { servicesSection } from "./services";
import { contactSection } from "./contact";

/*
 * The Section Registry — a map from section key to its (existentialized)
 * definition. Client-safe: no server-only imports, so editors can consume it.
 * Registry-based lookup avoids switch statements over section types.
 */

// Register each section individually (avoids inferring a props/data union).
const REGISTRY = new Map<string, UnknownSectionDefinition>();
REGISTRY.set(heroSection.key, toRegistryEntry(heroSection));
REGISTRY.set(aboutSection.key, toRegistryEntry(aboutSection));
REGISTRY.set(servicesSection.key, toRegistryEntry(servicesSection));
REGISTRY.set(contactSection.key, toRegistryEntry(contactSection));

export function getSection(
  key: string,
): UnknownSectionDefinition | undefined {
  return REGISTRY.get(key);
}

export function hasSection(key: string): boolean {
  return REGISTRY.has(key);
}

export function listSections(): UnknownSectionDefinition[] {
  return [...REGISTRY.values()];
}
