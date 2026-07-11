import type { ServicesData } from "./index";

/*
 * Single source of truth for shaping the Services section's frozen data from a
 * workspace's active services. Used by the server-side resolver (publish/render)
 * and the client editor preview, so both produce identical data.
 */

/** Minimal shape both the service DTO and the editor's list satisfy. */
export interface ServiceSource {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMinutes: number;
}

export function buildServicesData(
  services: ServiceSource[],
  limit: number,
): ServicesData {
  return {
    services: services.slice(0, limit).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      priceCents: s.priceCents,
      durationMinutes: s.durationMinutes,
    })),
  };
}
