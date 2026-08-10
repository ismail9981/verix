import type { CatalogManifest } from "./catalog-manifest";
import { normalizeCatalogManifest } from "./catalog-normalize";

export type DifferenceClassification =
  | "exact_match"
  | "compatible_drift"
  | "missing_required_object"
  | "unexpected_object"
  | "unsafe_conflict";

export type AdoptionDecision =
  | "ADOPTABLE"
  | "NOT_ADOPTABLE"
  | "REVIEW_REQUIRED";

export interface CatalogDifference {
  readonly classification: DifferenceClassification;
  readonly objectType: string;
  readonly objectId: string;
  readonly reason: string;
}

export interface CatalogComparison {
  readonly differences: readonly CatalogDifference[];
  readonly counts: Readonly<Record<DifferenceClassification, number>>;
  readonly adoptionDecision: AdoptionDecision;
}

export interface ComparisonOptions {
  /** Object identities explicitly approved for human review, never auto-adoption. */
  readonly compatibleDrift?: ReadonlySet<string>;
}

interface ManifestCollection {
  readonly type: keyof Pick<
    CatalogManifest,
    | "tables"
    | "enums"
    | "indexes"
    | "constraints"
    | "functions"
    | "triggers"
    | "rls"
    | "policies"
    | "grants"
  >;
  readonly id: (value: unknown) => string;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value as Readonly<Record<string, unknown>>;
}

const COLLECTIONS: readonly ManifestCollection[] = [
  { type: "tables", id: (v) => `${record(v).schema}.${record(v).name}` },
  { type: "enums", id: (v) => `${record(v).schema}.${record(v).name}` },
  { type: "indexes", id: (v) => `${record(v).schema}.${record(v).table}.${record(v).name}` },
  { type: "constraints", id: (v) => `${record(v).schema}.${record(v).table}.${record(v).name}` },
  { type: "functions", id: (v) => `${record(v).schema}.${record(v).name}(${record(v).arguments})` },
  { type: "triggers", id: (v) => `${record(v).schema}.${record(v).table}.${record(v).name}` },
  { type: "rls", id: (v) => `${record(v).schema}.${record(v).table}` },
  { type: "policies", id: (v) => `${record(v).schema}.${record(v).table}.${record(v).name}` },
  {
    type: "grants",
    id: (v) =>
      `${record(v).targetKind}.${record(v).schema}.${record(v).object}.${record(v).grantee}.${record(v).privilege}`,
  },
];

function emptyCounts(): Record<DifferenceClassification, number> {
  return {
    exact_match: 0,
    compatible_drift: 0,
    missing_required_object: 0,
    unexpected_object: 0,
    unsafe_conflict: 0,
  };
}

function isCompatibleIndexDrift(
  collection: ManifestCollection,
  expected: unknown,
  actual: unknown,
): boolean {
  return (
    collection.type === "indexes" &&
    record(expected).unique === false &&
    record(actual).unique === false
  );
}

export function compareCatalogManifests(
  canonicalSource: CatalogManifest,
  observedSource: CatalogManifest,
  options: ComparisonOptions = {},
): CatalogComparison {
  const canonical = normalizeCatalogManifest(canonicalSource);
  const observed = normalizeCatalogManifest(observedSource);
  const differences: CatalogDifference[] = [];
  const counts = emptyCounts();

  for (const collection of COLLECTIONS) {
    const canonicalItems = canonical[collection.type] as readonly unknown[];
    const observedItems = observed[collection.type] as readonly unknown[];
    const canonicalById = new Map(
      canonicalItems.map((value) => [collection.id(value), value]),
    );
    const observedById = new Map(
      observedItems.map((value) => [collection.id(value), value]),
    );

    for (const [objectId, expected] of canonicalById) {
      const actual = observedById.get(objectId);
      if (!actual) {
        counts.missing_required_object += 1;
        differences.push({
          classification: "missing_required_object",
          objectType: collection.type,
          objectId,
          reason: "Required canonical object is absent.",
        });
      } else if (JSON.stringify(expected) === JSON.stringify(actual)) {
        counts.exact_match += 1;
      } else if (
        options.compatibleDrift?.has(`${collection.type}:${objectId}`) &&
        isCompatibleIndexDrift(collection, expected, actual)
      ) {
        counts.compatible_drift += 1;
        differences.push({
          classification: "compatible_drift",
          objectType: collection.type,
          objectId,
          reason: "Difference is allowlisted for explicit human review.",
        });
      } else {
        counts.unsafe_conflict += 1;
        differences.push({
          classification: "unsafe_conflict",
          objectType: collection.type,
          objectId,
          reason: "Object exists but its normalized definition differs.",
        });
      }
    }

    for (const objectId of observedById.keys()) {
      if (!canonicalById.has(objectId)) {
        const actual = observedById.get(objectId);
        const unsafePublicExecute =
          collection.type === "grants" &&
          record(actual).targetKind === "function" &&
          record(actual).grantee === "PUBLIC" &&
          record(actual).privilege === "execute";
        const classification = unsafePublicExecute
          ? "unsafe_conflict"
          : "unexpected_object";
        counts[classification] += 1;
        differences.push({
          classification,
          objectType: collection.type,
          objectId,
          reason: unsafePublicExecute
            ? "A Verix function is effectively executable by PUBLIC."
            : "Relevant observed object is absent from the canonical manifest.",
        });
      }
    }
  }

  const adoptionDecision: AdoptionDecision =
    counts.missing_required_object > 0 || counts.unsafe_conflict > 0
      ? "NOT_ADOPTABLE"
      : counts.compatible_drift > 0 ||
          counts.unexpected_object > 0 ||
          canonical.ambiguities.length > 0
        ? "REVIEW_REQUIRED"
        : "ADOPTABLE";

  return { differences, counts, adoptionDecision };
}
