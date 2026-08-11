import { describe, expect, it } from "vitest";
import type {
  CatalogDifference,
  CatalogComparison,
} from "./catalog/catalog-compare";
import type { PrerequisiteResult } from "./catalog/supabase-prerequisite-check";
import {
  classifyMigrationLedger,
  evaluateAdoptionEvidence,
  type AdoptionEvidence,
  type CanonicalMigrationIdentity,
  type MigrationLedgerRow,
} from "./canonical-adoption";

const migrations: readonly CanonicalMigrationIdentity[] = [
  { index: 0, tag: "0000_slim_thunderbolts", hash: "hash-0000", createdAt: 1 },
  {
    index: 1,
    tag: "0001_payments_soft_delete",
    hash: "hash-0001",
    createdAt: 2,
  },
  {
    index: 2,
    tag: "0002_canonical_pre_sprint_1",
    hash: "hash-0002",
    createdAt: 3,
  },
];

const baseLedger: readonly MigrationLedgerRow[] = [
  { id: 1, hash: "hash-0000", createdAt: "1" },
  { id: 2, hash: "hash-0001", createdAt: "2" },
];

const presentPrerequisite: PrerequisiteResult = {
  prerequisite: {
    kind: "schema",
    identifier: "auth",
    ownership: "supabase_managed",
    requiredAttributes: {},
    repositoryEvidence: [],
    verixAction: "assert_only",
  },
  status: "PRESENT",
  mismatchedAttributes: [],
};

function comparison(difference?: CatalogDifference): CatalogComparison {
  return {
    differences: difference ? [difference] : [],
    counts: {
      exact_match: difference ? 492 : 493,
      compatible_drift: 0,
      missing_required_object:
        difference?.classification === "missing_required_object" ? 1 : 0,
      unexpected_object:
        difference?.classification === "unexpected_object" ? 1 : 0,
      unsafe_conflict: difference?.classification === "unsafe_conflict" ? 1 : 0,
    },
    adoptionDecision:
      difference?.classification === "unexpected_object"
        ? "REVIEW_REQUIRED"
        : difference
          ? "NOT_ADOPTABLE"
          : "ADOPTABLE",
  };
}

function evidence(overrides: Partial<AdoptionEvidence> = {}): AdoptionEvidence {
  return {
    prerequisites: [presentPrerequisite],
    expectedFingerprint: {
      algorithm: "sha256",
      manifestVersion: 1,
      scope: "pre-sprint-1",
      value: "canonical",
    },
    observedFingerprint: {
      algorithm: "sha256",
      manifestVersion: 1,
      scope: "pre-sprint-1",
      value: "canonical",
    },
    comparison: comparison(),
    ledger: baseLedger,
    ledgerClassification: "READY_FOR_ADOPTION",
    ledgerReason: "exact base ledger",
    migration: migrations[2]!,
    ...overrides,
  };
}

function unsafe(objectType: string, objectId: string): CatalogDifference {
  return {
    classification: "unsafe_conflict",
    objectType,
    objectId,
    reason: "security-sensitive catalog drift",
  };
}

describe("canonical adoption gate", () => {
  it("allows an exact canonical catalog with only exact 0000/0001 ledger rows", () => {
    expect(classifyMigrationLedger(baseLedger, migrations).classification).toBe(
      "READY_FOR_ADOPTION",
    );
    expect(evaluateAdoptionEvidence(evidence())).toBe("ADOPTABLE");
  });

  it("treats an exact canonical adoption row as an idempotent no-op", () => {
    const ledger = [
      ...baseLedger,
      { id: 3, hash: "hash-0002", createdAt: "3" },
    ];
    expect(classifyMigrationLedger(ledger, migrations).classification).toBe(
      "ALREADY_ADOPTED",
    );
    expect(
      evaluateAdoptionEvidence(
        evidence({ ledger, ledgerClassification: "ALREADY_ADOPTED" }),
      ),
    ).toBe("ALREADY_ADOPTED");
  });

  it("refuses a missing canonical object", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          comparison: comparison({
            classification: "missing_required_object",
            objectType: "tables",
            objectId: "public.settings",
            reason: "missing",
          }),
        }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses an unsafe policy difference", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          comparison: comparison(
            unsafe("policies", "public.users.workspace_access"),
          ),
        }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses an effective PUBLIC EXECUTE regression", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          comparison: comparison(
            unsafe(
              "grants",
              "function.public.current_workspace_ids.PUBLIC.execute",
            ),
          ),
        }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses an untrusted SECURITY DEFINER owner", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          comparison: comparison(
            unsafe("functions", "public.current_workspace_ids()"),
          ),
        }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses incorrect or fabricated migration metadata", () => {
    const ledger = [
      { id: 1, hash: "wrong", createdAt: "1" },
      ...baseLedger.slice(1),
    ];
    const result = classifyMigrationLedger(ledger, migrations);
    expect(result.classification).toBe("INVALID");
    expect(
      evaluateAdoptionEvidence(
        evidence({ ledger, ledgerClassification: result.classification }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses a non-canonical legacy fingerprint", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          observedFingerprint: {
            algorithm: "sha256",
            manifestVersion: 1,
            scope: "pre-sprint-1",
            value: "legacy-drift",
          },
        }),
      ),
    ).toBe("REFUSED");
  });

  it("refuses a missing or changed Supabase prerequisite", () => {
    expect(
      evaluateAdoptionEvidence(
        evidence({
          prerequisites: [
            {
              ...presentPrerequisite,
              status: "PRESENT_WITH_DIFFERENT_CHARACTERISTICS",
            },
          ],
        }),
      ),
    ).toBe("REFUSED");
  });
});
