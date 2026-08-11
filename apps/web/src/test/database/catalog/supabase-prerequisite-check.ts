import type {
  SupabasePrerequisite,
  SupabasePrerequisiteManifest,
} from "./catalog-manifest";

export type PrerequisiteStatus =
  | "PRESENT"
  | "ABSENT"
  | "PRESENT_WITH_DIFFERENT_CHARACTERISTICS";

export interface PrerequisiteObservation {
  readonly identifier: string;
  readonly present: boolean;
  readonly attributes: Readonly<Record<string, boolean | string | readonly string[]>>;
}

export interface PrerequisiteResult {
  readonly prerequisite: SupabasePrerequisite;
  readonly status: PrerequisiteStatus;
  readonly mismatchedAttributes: readonly string[];
}

function equalAttribute(
  expected: boolean | string | readonly string[],
  actual: boolean | string | readonly string[] | undefined,
): boolean {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.every((value) => actual.includes(value))
    );
  }
  return expected === actual;
}

/** Pure classification used after a read-only environment inspector runs. */
export function classifySupabasePrerequisites(
  manifest: SupabasePrerequisiteManifest,
  observations: readonly PrerequisiteObservation[],
): PrerequisiteResult[] {
  const observedById = new Map(
    observations.map((observation) => [observation.identifier, observation]),
  );

  return manifest.prerequisites.map((prerequisite) => {
    const observation = observedById.get(prerequisite.identifier);
    if (!observation?.present) {
      return { prerequisite, status: "ABSENT", mismatchedAttributes: [] };
    }
    const mismatchedAttributes = Object.entries(
      prerequisite.requiredAttributes,
    )
      .filter(
        ([key, expected]) =>
          !equalAttribute(expected, observation.attributes[key]),
      )
      .map(([key]) => key)
      .sort();
    return {
      prerequisite,
      status:
        mismatchedAttributes.length === 0
          ? "PRESENT"
          : "PRESENT_WITH_DIFFERENT_CHARACTERISTICS",
      mismatchedAttributes,
    };
  });
}
