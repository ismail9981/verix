import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { compareCatalogManifests } from "./catalog-compare";
import type {
  CatalogConstraint,
  CatalogFunction,
  CatalogManifest,
  CatalogPolicy,
  CatalogTable,
} from "./catalog-manifest";
import {
  fingerprintCatalogManifest,
  normalizeCatalogExpression,
  normalizeCatalogManifest,
  normalizeSql,
} from "./catalog-normalize";
import {
  buildRepositoryCanonicalManifest,
  buildSupabasePrerequisiteManifest,
} from "./repository-canonical-manifest";
import { classifySupabasePrerequisites } from "./supabase-prerequisite-check";
import { classifyFunctionOwnerTrust } from "./function-owner-trust";

const MANIFEST_PATH = fileURLToPath(
  new URL("./manifests/canonical-pre-sprint-1.json", import.meta.url),
);
const FINGERPRINT_PATH = fileURLToPath(
  new URL("./manifests/canonical-pre-sprint-1.fingerprint.json", import.meta.url),
);
const APP_DIR = fileURLToPath(new URL("../../../../", import.meta.url));

function table(name: string): CatalogTable {
  return {
    schema: "public",
    name,
    ownership: "verix_owned",
    columns: [
      {
        name: "id",
        type: "uuid",
        nullable: false,
        default: "gen_random_uuid()",
        identity: null,
        generated: null,
      },
    ],
  };
}

function foreignKey(referencedTable = "workspaces"): CatalogConstraint {
  return {
    schema: "public",
    table: "customers",
    name: "customers_workspace_id_workspaces_id_fk",
    ownership: "verix_owned",
    type: "foreign_key",
    columns: ["workspace_id"],
    referencedSchema: "public",
    referencedTable,
    referencedColumns: ["id"],
    onUpdate: "no action",
    onDelete: "cascade",
    definition: null,
    deferrable: false,
    initiallyDeferred: false,
    validated: true,
  };
}

function policy(using = "workspace_id in (select public.current_workspace_ids())"): CatalogPolicy {
  return {
    schema: "public",
    table: "customers",
    name: "workspace_access",
    ownership: "verix_owned",
    permissive: true,
    command: "all",
    roles: ["authenticated"],
    using,
    withCheck: using,
  };
}

function securityDefiner(
  ownerTrust: CatalogFunction["ownerTrust"] = "trusted_privileged_owner",
): CatalogFunction {
  return {
    schema: "public",
    name: "current_workspace_ids",
    ownership: "verix_owned",
    arguments: "",
    returnType: "setof uuid",
    language: "sql",
    volatility: "stable",
    securityDefiner: true,
    ownerTrust,
    configuration: ["search_path=public"],
    body: "select workspace_id from team_members",
  };
}

function manifest(overrides: Partial<CatalogManifest> = {}): CatalogManifest {
  return {
    manifestVersion: 1,
    scope: "pre-sprint-1",
    tables: [table("customers"), table("workspaces")],
    enums: [
      {
        schema: "public",
        name: "member_role",
        ownership: "verix_owned",
        values: ["owner", "manager", "employee"],
      },
    ],
    indexes: [],
    constraints: [foreignKey()],
    functions: [],
    triggers: [],
    rls: [
      {
        schema: "public",
        table: "customers",
        ownership: "verix_owned",
        enabled: true,
        forced: false,
      },
    ],
    policies: [policy()],
    grants: [],
    ambiguities: [],
    legacyObjects: [],
    ...overrides,
  };
}

describe("catalog normalization and fingerprints", () => {
  it("matches a fresh repository-derived manifest and fingerprint", async () => {
    const generated = await buildRepositoryCanonicalManifest(APP_DIR);
    const storedManifest = JSON.parse(
      await readFile(MANIFEST_PATH, "utf8"),
    ) as CatalogManifest;
    const storedFingerprint = JSON.parse(
      await readFile(FINGERPRINT_PATH, "utf8"),
    ) as ReturnType<typeof fingerprintCatalogManifest>;

    expect(storedManifest).toEqual(generated);
    expect(storedFingerprint).toEqual(fingerprintCatalogManifest(generated));
  });

  it("uses deterministic ordering", () => {
    const first = manifest();
    const second = manifest({
      tables: [...first.tables].reverse(),
      policies: [...first.policies].reverse(),
    });

    expect(normalizeCatalogManifest(second)).toEqual(
      normalizeCatalogManifest(first),
    );
    expect(fingerprintCatalogManifest(second)).toEqual(
      fingerprintCatalogManifest(first),
    );
  });

  it("normalizes PostgreSQL keyword case and ordinary quoted identifiers", () => {
    expect(normalizeSql('"payments"."amount_cents" IS NOT NULL')).toBe(
      "payments.amount_cents is not null",
    );
    expect(normalizeSql("'Case Sensitive'::TEXT")).toBe(
      "'Case Sensitive'::text",
    );
  });

  it("renders repository JSON defaults like PostgreSQL catalog defaults", async () => {
    const generated = await buildRepositoryCanonicalManifest(APP_DIR);
    const leads = generated.tables.find((value) => value.name === "leads");
    expect(leads?.columns.find((value) => value.name === "metadata")?.default).toBe(
      "'{}'::jsonb",
    );
  });

  it("normalizes calibrated RLS deparse aliases and trigger row qualifiers", () => {
    expect(
      normalizeCatalogExpression(
        "(workspace_id IN ( SELECT current_workspace_ids() AS current_workspace_ids))",
        "customers",
      ),
    ).toBe("workspace_id in(select current_workspace_ids())");
    expect(
      normalizeCatalogExpression("(OLD.invoice_id IS NOT NULL)", "payments"),
    ).toBe("invoice_id is not null");
  });

  it("normalizes authoritative partial-index casts and redundant grouping", () => {
    const repository =
      "reservation_id is not null and status <> 'void'";
    const observed =
      "((reservation_id IS NOT NULL) AND (status <> 'void'::invoice_status))";
    expect(normalizeCatalogExpression(observed, "invoices")).toBe(
      normalizeCatalogExpression(repository, "invoices"),
    );
  });

  it("normalizes the authoritative exclusion constraint representation", () => {
    const repository =
      "exclude using gist (unit_id with =, daterange(check_in_date, check_out_date, '[)') with &&) where (status not in ('cancelled', 'no_show') and deleted_at is null)";
    const observed =
      "EXCLUDE USING gist (unit_id WITH =, daterange(check_in_date, check_out_date, '[)'::text) WITH &&) WHERE ((status <> ALL (ARRAY['cancelled'::reservation_status, 'no_show'::reservation_status])) AND deleted_at IS NULL)";
    expect(normalizeCatalogExpression(observed, "reservations")).toBe(
      normalizeCatalogExpression(repository, "reservations"),
    );
  });

  it("excludes PostgreSQL check dependency columns from semantic comparison", () => {
    const canonical = manifest({
      constraints: [
        {
          ...foreignKey(),
          name: "amount_positive_ck",
          type: "check",
          columns: [],
          referencedSchema: null,
          referencedTable: null,
          referencedColumns: [],
          onDelete: null,
          onUpdate: null,
          definition: "amount_cents > 0",
        },
      ],
    });
    const observed = manifest({
      constraints: [
        {
          ...canonical.constraints[0]!,
          columns: ["amount_cents"],
        },
      ],
    });
    expect(compareCatalogManifests(canonical, observed).adoptionDecision).toBe(
      "ADOPTABLE",
    );
  });

  it("preserves meaningful boolean grouping", () => {
    expect(normalizeCatalogExpression("(a or b) and c")).not.toBe(
      normalizeCatalogExpression("a or b and c"),
    );
  });

  it("treats physical column and foreign-key names as non-semantic", () => {
    const canonical = manifest({
      tables: [
        { ...table("customers"), columns: [...table("customers").columns, {
          name: "workspace_id",
          type: "uuid",
          nullable: false,
          default: null,
          identity: null,
          generated: null,
        }] },
      ],
    });
    const observed = manifest({
      tables: [{ ...canonical.tables[0]!, columns: [...canonical.tables[0]!.columns].reverse() }],
      constraints: [{ ...foreignKey(), name: "customers_workspace_id_fkey" }],
    });

    expect(fingerprintCatalogManifest(observed)).toEqual(
      fingerprintCatalogManifest(canonical),
    );
  });

  it("changes the fingerprint when an ordered enum value changes", () => {
    const changed = manifest({
      enums: [
        {
          schema: "public",
          name: "member_role",
          ownership: "verix_owned",
          values: ["owner", "employee", "manager"],
        },
      ],
    });

    expect(fingerprintCatalogManifest(changed).value).not.toBe(
      fingerprintCatalogManifest(manifest()).value,
    );
  });

  it("ignores volatile or unknown metadata", () => {
    const withVolatileMetadata = {
      ...manifest(),
      generatedAt: "2099-01-01T00:00:00Z",
      tables: manifest().tables.map((value) => ({ ...value, oid: 99999 })),
    } as CatalogManifest;

    expect(fingerprintCatalogManifest(withVolatileMetadata)).toEqual(
      fingerprintCatalogManifest(manifest()),
    );
  });

  it("excludes separately modeled Supabase prerequisites", () => {
    const withPrerequisites = {
      ...manifest(),
      supabasePrerequisites: [{ identifier: "auth.users" }],
    } as CatalogManifest;

    expect(fingerprintCatalogManifest(withPrerequisites)).toEqual(
      fingerprintCatalogManifest(manifest()),
    );
  });

  it("contains no credential material in the generated canonical manifest", async () => {
    const content = await readFile(MANIFEST_PATH, "utf8");
    expect(content).not.toMatch(/DATABASE_URL|password|service[_-]?role[_-]?key|postgres(?:ql)?:\/\//i);
  });
});

describe("catalog difference and adoption gate", () => {
  it("returns ADOPTABLE only for an exact catalog", () => {
    const comparison = compareCatalogManifests(manifest(), manifest());
    expect(comparison.adoptionDecision).toBe("ADOPTABLE");
    expect(comparison.differences).toEqual([]);
    expect(comparison.counts.exact_match).toBeGreaterThan(0);
  });

  it("classifies a changed foreign key as an unsafe conflict", () => {
    const observed = manifest({ constraints: [foreignKey("users")] });
    const comparison = compareCatalogManifests(manifest(), observed);

    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "unsafe_conflict",
        objectType: "constraints",
      }),
    );
  });

  it("classifies a missing policy as a missing required object", () => {
    const comparison = compareCatalogManifests(
      manifest(),
      manifest({ policies: [] }),
    );
    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "missing_required_object",
        objectType: "policies",
      }),
    );
  });

  it("classifies a changed RLS expression as an unsafe conflict", () => {
    const comparison = compareCatalogManifests(
      manifest(),
      manifest({ policies: [policy("true")] }),
    );
    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "unsafe_conflict",
        objectType: "policies",
      }),
    );
  });

  it("classifies an unexpected relevant table", () => {
    const comparison = compareCatalogManifests(
      manifest(),
      manifest({ tables: [...manifest().tables, table("unexpected_table")] }),
    );
    expect(comparison.adoptionDecision).toBe("REVIEW_REQUIRED");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "unexpected_object",
        objectId: "public.unexpected_table",
      }),
    );
  });

  it("returns REVIEW_REQUIRED for explicitly allowlisted compatible drift", () => {
    const canonical = manifest({
      indexes: [
        {
          schema: "public",
          table: "customers",
          name: "customers_name_idx",
          ownership: "verix_owned",
          unique: false,
          method: "btree",
          keys: ["name"],
          predicate: null,
        },
      ],
    });
    const observed = manifest({
      indexes: [
        {
          ...canonical.indexes[0]!,
          method: "hash",
        },
      ],
    });
    const comparison = compareCatalogManifests(canonical, observed, {
      compatibleDrift: new Set([
        "indexes:public.customers.customers_name_idx",
      ]),
    });

    expect(comparison.adoptionDecision).toBe("REVIEW_REQUIRED");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({ classification: "compatible_drift" }),
    );
  });

  it("does not allowlist security-sensitive policy drift as compatible", () => {
    const comparison = compareCatalogManifests(
      manifest(),
      manifest({ policies: [policy("true")] }),
      {
        compatibleDrift: new Set([
          "policies:public.customers.workspace_access",
        ]),
      },
    );

    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({ classification: "unsafe_conflict" }),
    );
  });

  it("classifies effective PUBLIC function execution as unsafe", () => {
    const observed = manifest({
      grants: [
        {
          targetKind: "function",
          schema: "public",
          object: "current_workspace_ids",
          ownership: "verix_owned",
          grantee: "PUBLIC",
          privilege: "execute",
        },
      ],
    });
    const comparison = compareCatalogManifests(manifest(), observed);

    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "unsafe_conflict",
        objectType: "grants",
      }),
    );
  });

  it("classifies SECURITY DEFINER owner drift as unsafe", () => {
    const canonical = manifest({ functions: [securityDefiner()] });
    const observed = manifest({
      functions: [securityDefiner("untrusted_application_owner")],
    });
    const comparison = compareCatalogManifests(canonical, observed);

    expect(comparison.adoptionDecision).toBe("NOT_ADOPTABLE");
    expect(comparison.differences).toContainEqual(
      expect.objectContaining({
        classification: "unsafe_conflict",
        objectType: "functions",
      }),
    );
  });

  it("returns REVIEW_REQUIRED while repository evidence is ambiguous", () => {
    const canonical = manifest({
      ambiguities: [
        {
          id: "uncertain.object",
          ownership: "uncertain",
          evidence: ["Conflicting repository sources."],
          adoptionImpact: "Requires approval.",
        },
      ],
    });
    expect(compareCatalogManifests(canonical, manifest()).adoptionDecision).toBe(
      "REVIEW_REQUIRED",
    );
  });
});

describe("Supabase prerequisite classification", () => {
  it("classifies presence, absence, and characteristic drift", () => {
    const prerequisites = buildSupabasePrerequisiteManifest();
    const results = classifySupabasePrerequisites(prerequisites, [
      { identifier: "auth", present: true, attributes: {} },
      {
        identifier: "auth.uid()",
        present: true,
        attributes: { returnType: "text" },
      },
    ]);

    expect(results.find((result) => result.prerequisite.identifier === "auth")?.status).toBe(
      "PRESENT",
    );
    expect(results.find((result) => result.prerequisite.identifier === "auth.uid()")?.status).toBe(
      "PRESENT_WITH_DIFFERENT_CHARACTERISTICS",
    );
    expect(results.find((result) => result.prerequisite.identifier === "auth.users")?.status).toBe(
      "ABSENT",
    );
  });

  it("treats required relation columns as a subset contract", () => {
    const prerequisites = buildSupabasePrerequisiteManifest();
    const results = classifySupabasePrerequisites(prerequisites, [
      {
        identifier: "auth.users",
        present: true,
        attributes: { requiredColumns: ["email", "id", "created_at"] },
      },
    ]);
    expect(
      results.find(
        (result) => result.prerequisite.identifier === "auth.users",
      )?.status,
    ).toBe("PRESENT");
  });

  it("classifies btree_gist as a Verix-required extension", () => {
    const prerequisite = buildSupabasePrerequisiteManifest().prerequisites.find(
      (value) => value.identifier === "btree_gist",
    );
    expect(prerequisite).toMatchObject({
      ownership: "verix_required_extension",
      verixAction: "create_if_absent",
    });
  });
});

describe("SECURITY DEFINER owner trust", () => {
  it("trusts the authoritative Supabase postgres owner by portable classification", () => {
    expect(
      classifyFunctionOwnerTrust({
        securityDefiner: true,
        roleName: "postgres",
        canLogin: true,
        superuser: false,
        bypassRls: true,
      }),
    ).toBe("trusted_privileged_owner");
  });

  it("rejects application and ordinary login owners and preserves unknown owners", () => {
    expect(
      classifyFunctionOwnerTrust({
        securityDefiner: true,
        roleName: "service_role",
        canLogin: false,
        superuser: false,
        bypassRls: true,
      }),
    ).toBe("untrusted_application_owner");
    expect(
      classifyFunctionOwnerTrust({
        securityDefiner: true,
        roleName: "tenant_user",
        canLogin: true,
        superuser: false,
        bypassRls: false,
      }),
    ).toBe("untrusted_application_owner");
    expect(
      classifyFunctionOwnerTrust({
        securityDefiner: true,
        roleName: "custom_owner",
        canLogin: false,
        superuser: false,
        bypassRls: false,
      }),
    ).toBe("unknown_owner");
  });
});
