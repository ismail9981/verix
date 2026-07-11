/*
 * Fractional indexing over the existing integer `position` column (the DB schema
 * is unchanged). Sections are spaced by a large STEP so a reorder normally
 * rewrites only the moved row's position (the midpoint between its new
 * neighbours). When two neighbours are adjacent (no integer room left), the page
 * is rebalanced back to evenly-spaced positions. This keeps ordering O(1) writes
 * in the common case and never touches the schema.
 */

export const POSITION_STEP = 1000;

/** Evenly-spaced positions for `count` items: STEP, 2·STEP, … */
export function positionsForCount(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}

/** The next position to append after the current maximum. */
export function nextPosition(maxPosition: number | null): number {
  return (maxPosition ?? 0) + POSITION_STEP;
}

/** A position strictly between two neighbours, or null when there is no room. */
export function positionBetween(
  before: number | null,
  after: number | null,
): number | null {
  if (before === null && after === null) return POSITION_STEP;
  if (before === null) {
    const candidate = Math.floor(after! / 2);
    return candidate > 0 && candidate < after! ? candidate : null;
  }
  if (after === null) return before + POSITION_STEP;
  const candidate = Math.floor((before + after) / 2);
  return candidate > before && candidate < after ? candidate : null;
}

export interface Positioned {
  position: number;
}

/**
 * Move the item at `fromIndex` to `toIndex` and return a NEW array with updated
 * positions. Normally only the moved item's `position` changes (fractional
 * insert); if there is no integer gap, every position is rebalanced.
 */
export function reorderWithPositions<T extends Positioned>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items.slice();
  }

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);

  const before = toIndex > 0 ? next[toIndex - 1]!.position : null;
  const after = toIndex < next.length - 1 ? next[toIndex + 1]!.position : null;
  const between = positionBetween(before, after);

  if (between === null) {
    // No room between neighbours — rebalance the whole page.
    return next.map((item, i) => ({ ...item, position: (i + 1) * POSITION_STEP }));
  }

  next[toIndex] = { ...next[toIndex]!, position: between };
  return next;
}
