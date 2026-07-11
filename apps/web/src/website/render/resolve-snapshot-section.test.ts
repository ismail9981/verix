import { describe, it, expect } from "vitest";
import { z } from "zod";
import { resolveSnapshotSection } from "./resolve-snapshot-section";
import { getSection } from "../sections/registry";
import type { UnknownSectionDefinition } from "./types";

// A minimal registry entry — resolveSnapshotSection only reads version + schema.
function fakeDef(version: number, schema: z.ZodType): UnknownSectionDefinition {
  return { version, schema } as unknown as UnknownSectionDefinition;
}
const lookupOf =
  (defs: Record<string, UnknownSectionDefinition>) => (key: string) =>
    defs[key];

const headingSchema = z.object({ heading: z.string() });

describe("resolveSnapshotSection (version-aware)", () => {
  it("returns unknown for an unregistered type", () => {
    const r = resolveSnapshotSection(
      { typeKey: "nope", typeVersion: 1, props: {} },
      () => undefined,
    );
    expect(r.status).toBe("unknown");
  });

  it("returns ok for valid props at the same version", () => {
    const r = resolveSnapshotSection(
      { typeKey: "x", typeVersion: 1, props: { heading: "Hi" } },
      lookupOf({ x: fakeDef(1, headingSchema) }),
    );
    expect(r.status).toBe("ok");
  });

  it("returns invalid for bad props at the same version", () => {
    const r = resolveSnapshotSection(
      { typeKey: "x", typeVersion: 1, props: { heading: 123 } },
      lookupOf({ x: fakeDef(1, headingSchema) }),
    );
    expect(r.status).toBe("invalid");
  });

  it("returns version when the snapshot pins a newer version than the code", () => {
    const r = resolveSnapshotSection(
      { typeKey: "x", typeVersion: 2, props: { heading: "Hi" } },
      lookupOf({ x: fakeDef(1, headingSchema) }),
    );
    expect(r.status).toBe("version");
  });

  it("returns version when older frozen props no longer satisfy the schema", () => {
    const schemaV2 = z.object({ heading: z.string(), subheading: z.string() });
    const r = resolveSnapshotSection(
      { typeKey: "x", typeVersion: 1, props: { heading: "Hi" } },
      lookupOf({ x: fakeDef(2, schemaV2) }),
    );
    expect(r.status).toBe("version");
  });

  it("still renders older props that satisfy the current schema", () => {
    const r = resolveSnapshotSection(
      { typeKey: "x", typeVersion: 1, props: { heading: "Hi" } },
      lookupOf({ x: fakeDef(2, headingSchema) }),
    );
    expect(r.status).toBe("ok");
  });

  it("works against the real registry", () => {
    const hero = getSection("hero")!;
    const r = resolveSnapshotSection(
      {
        typeKey: "hero",
        typeVersion: hero.version,
        props: hero.defaultProps as Record<string, unknown>,
      },
      getSection,
    );
    expect(r.status).toBe("ok");
  });
});
