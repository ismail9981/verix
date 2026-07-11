import { describe, it, expect } from "vitest";
import { buildServicesData, type ServiceSource } from "./data";

const sources: ServiceSource[] = [
  { id: "1", name: "Cut", description: "A tidy trim", priceCents: 4000, durationMinutes: 30 },
  { id: "2", name: "Color", description: null, priceCents: 9000, durationMinutes: 90 },
  { id: "3", name: "Style", description: "Blow-dry", priceCents: 3000, durationMinutes: 45 },
];

describe("buildServicesData", () => {
  it("limits the number of services and maps to the frozen shape", () => {
    const data = buildServicesData(sources, 2);
    expect(data.services).toHaveLength(2);
    expect(data.services[0]).toEqual({
      id: "1",
      name: "Cut",
      description: "A tidy trim",
      priceCents: 4000,
      durationMinutes: 30,
    });
  });

  it("returns all services when the limit exceeds the count", () => {
    expect(buildServicesData(sources, 10).services).toHaveLength(3);
  });

  it("preserves null descriptions", () => {
    expect(buildServicesData(sources, 3).services[1]!.description).toBeNull();
  });

  it("returns an empty list for a zero limit", () => {
    expect(buildServicesData(sources, 0).services).toHaveLength(0);
  });
});
