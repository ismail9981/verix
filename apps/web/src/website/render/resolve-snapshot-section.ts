import type { SnapshotSection } from "./snapshot";
import type { UnknownSectionDefinition } from "./types";

/*
 * Version-aware resolution of a snapshot section against the code registry.
 * Pure and React-free so it is unit-testable and shared by every render path
 * (published, preview, and the editor's section preview).
 *
 * Snapshots pin `type_version`. A section is only rendered when the registry can
 * satisfy its pinned version; otherwise it degrades to a typed fallback rather
 * than silently mis-rendering frozen props against a drifted schema.
 */

export type SnapshotSectionResolution =
  | { status: "ok"; def: UnknownSectionDefinition; props: unknown }
  | { status: "unknown" }
  | { status: "invalid" }
  | { status: "version" };

export function resolveSnapshotSection(
  section: Pick<SnapshotSection, "typeKey" | "typeVersion" | "props">,
  lookup: (key: string) => UnknownSectionDefinition | undefined,
): SnapshotSectionResolution {
  const def = lookup(section.typeKey);
  if (!def) return { status: "unknown" };

  // Snapshot built by a newer app than this deploy knows about → can't render.
  if (section.typeVersion > def.version) return { status: "version" };

  // (A future migrate-on-read hook for older versions would run here.)
  const parsed = def.schema.safeParse(section.props);
  if (!parsed.success) {
    // Frozen props that no longer satisfy the current schema: an older pinned
    // version is a version-drift problem; an equal version is genuinely invalid.
    return section.typeVersion < def.version
      ? { status: "version" }
      : { status: "invalid" };
  }

  return { status: "ok", def, props: parsed.data };
}
