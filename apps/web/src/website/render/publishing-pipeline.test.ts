import { describe, it, expect } from "vitest";
import { getSection } from "../sections/registry";
import { buildServicesData } from "../sections/services/data";
import { modernTheme } from "../theme/themes/modern";
import { resolveSnapshotSection } from "./resolve-snapshot-section";
import {
  SNAPSHOT_FORMAT_VERSION,
  siteSnapshotSchema,
  type SiteSnapshot,
} from "./snapshot";

/*
 * Integration-style coverage that threads the real publishing-pipeline units:
 * a compile-shaped snapshot (registry defaults + frozen theme + frozen data) is
 * validated by the read-time schema and every section resolves through the same
 * renderer core the public site uses. No database — pure modules only.
 */
describe("publishing pipeline", () => {
  const hero = getSection("hero")!;
  const services = getSection("services")!;

  const snapshot: SiteSnapshot = {
    format: SNAPSHOT_FORMAT_VERSION,
    site: { id: "s", name: "Bloom", defaultLocale: "en-us", themeKey: "modern" },
    theme: { key: "modern", tokens: modernTheme.tokens },
    pages: [
      {
        id: "home",
        path: "",
        title: "Home",
        locale: "en-us",
        position: 0,
        seo: { title: null, description: null },
        sections: [
          {
            id: "h",
            typeKey: "hero",
            typeVersion: hero.version,
            props: hero.defaultProps as Record<string, unknown>,
            data: null,
          },
          {
            id: "sv",
            typeKey: "services",
            typeVersion: services.version,
            props: services.defaultProps as Record<string, unknown>,
            data: buildServicesData(
              [
                {
                  id: "1",
                  name: "Haircut",
                  description: null,
                  priceCents: 4000,
                  durationMinutes: 30,
                },
              ],
              6,
            ),
          },
        ],
      },
    ],
    publishedAt: new Date().toISOString(),
  };

  it("produces a snapshot that validates against the read-time schema", () => {
    expect(siteSnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  it("resolves every published section to ok via the shared renderer core", () => {
    for (const section of snapshot.pages[0]!.sections) {
      expect(resolveSnapshotSection(section, getSection).status).toBe("ok");
    }
  });

  it("degrades an unknown section type to a fallback (never crashes)", () => {
    const r = resolveSnapshotSection(
      { typeKey: "ghost", typeVersion: 1, props: {} },
      getSection,
    );
    expect(r.status).toBe("unknown");
  });

  it("degrades a future section version to a version fallback", () => {
    const section = snapshot.pages[0]!.sections[0]!;
    const r = resolveSnapshotSection(
      { ...section, typeVersion: section.typeVersion + 1 },
      getSection,
    );
    expect(r.status).toBe("version");
  });
});
