import { z } from "zod";

/*
 * Validation + shared types for buildings (Sprint 12) — the middle level of
 * the property -> building -> rental-unit hierarchy. Dependency-free.
 */

export interface BuildingListItem {
  id: string;
  propertyId: string;
  name: string;
  position: number;
  archivedAt: Date | null;
  unitCount: number;
  createdAt: Date;
}

/** id/name pair for a rental unit form's building selector. */
export interface BuildingOption {
  id: string;
  name: string;
}

export const buildingInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type BuildingInput = z.infer<typeof buildingInputSchema>;

/**
 * New buildings are appended after the current highest position within
 * their property — mirrors `crmStages.position`'s "append at the end" rule.
 * Pure so the append-at-end invariant is unit-testable without a DB.
 */
export function nextBuildingPosition(existingPositions: readonly number[]): number {
  return existingPositions.length === 0 ? 0 : Math.max(...existingPositions) + 1;
}

/** A drag-reordered list of a property's building ids, in their new display order. */
export const buildingReorderSchema = z.object({
  orderedIds: z.array(z.uuid()).min(1),
});
export type BuildingReorderInput = z.infer<typeof buildingReorderSchema>;
