import { describe, it, expect } from "vitest";
import {
  POSITION_STEP,
  nextPosition,
  positionBetween,
  positionsForCount,
  reorderWithPositions,
} from "./position";

describe("positionsForCount / nextPosition", () => {
  it("spaces positions by STEP", () => {
    expect(positionsForCount(3)).toEqual([1000, 2000, 3000]);
    expect(POSITION_STEP).toBe(1000);
  });
  it("appends after the current max", () => {
    expect(nextPosition(3000)).toBe(4000);
    expect(nextPosition(null)).toBe(1000);
  });
});

describe("positionBetween", () => {
  it("returns STEP between two empties", () => {
    expect(positionBetween(null, null)).toBe(1000);
  });
  it("appends after a lone left neighbour", () => {
    expect(positionBetween(2000, null)).toBe(3000);
  });
  it("halves before a lone right neighbour", () => {
    expect(positionBetween(null, 2000)).toBe(1000);
  });
  it("takes the midpoint between two neighbours", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
  it("returns null when there is no integer gap", () => {
    expect(positionBetween(1000, 1001)).toBeNull();
    expect(positionBetween(null, 1)).toBeNull();
  });
});

interface Item {
  id: string;
  position: number;
}
const items = (): Item[] => [
  { id: "a", position: 1000 },
  { id: "b", position: 2000 },
  { id: "c", position: 3000 },
];

describe("reorderWithPositions", () => {
  it("moves an item to the end, changing only its position", () => {
    const r = reorderWithPositions(items(), 0, 2);
    expect(r.map((x) => x.id)).toEqual(["b", "c", "a"]);
    expect(r).toEqual([
      { id: "b", position: 2000 },
      { id: "c", position: 3000 },
      { id: "a", position: 4000 },
    ]);
  });

  it("inserts at the midpoint when moving into the middle", () => {
    const r = reorderWithPositions(items(), 2, 1);
    expect(r.map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(r[1]).toEqual({ id: "c", position: 1500 });
    expect(r[0]!.position).toBe(1000); // neighbours untouched
    expect(r[2]!.position).toBe(2000);
  });

  it("rebalances the whole page when neighbours are adjacent", () => {
    const tight: Item[] = [
      { id: "a", position: 1000 },
      { id: "b", position: 1001 },
      { id: "c", position: 1002 },
    ];
    const r = reorderWithPositions(tight, 2, 1);
    expect(r.map((x) => x.id)).toEqual(["a", "c", "b"]);
    expect(r.map((x) => x.position)).toEqual([1000, 2000, 3000]);
  });

  it("is a no-op for same/out-of-range indices", () => {
    expect(reorderWithPositions(items(), 1, 1).map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(reorderWithPositions(items(), 5, 0).map((x) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
