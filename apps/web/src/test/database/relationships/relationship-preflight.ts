import type { TestDatabaseClient } from "../test-database";
import {
  WORKSPACE_RELATIONSHIPS,
  type WorkspaceRelationship,
} from "./relationship-inventory";

export interface RelationshipPreflightResult {
  readonly key: string;
  readonly missingParentCount: number;
  readonly crossWorkspaceCount: number;
  readonly ownershipPathAnomalyCount: number;
  readonly safe: boolean;
}

export interface RelationshipPreflightReport {
  readonly relationshipCount: number;
  readonly missingParentCount: number;
  readonly crossWorkspaceCount: number;
  readonly ownershipPathAnomalyCount: number;
  readonly safe: boolean;
  readonly relationships: readonly RelationshipPreflightResult[];
}

type RelationshipPreflightClient = Pick<TestDatabaseClient, "unsafe">;

const OWNERSHIP_PATH_ANOMALIES: Readonly<Record<string, string>> = {
  "crm_opportunities.stage_id->crm_stages.id": `
    select count(*)::int as count
    from crm_opportunities child
    join crm_stages parent on parent.id = child.stage_id
    where parent.pipeline_id is distinct from child.pipeline_id
  `,
  "housekeeping_tasks.building_id->buildings.id": `
    select count(*)::int as count
    from housekeeping_tasks child
    join rental_units unit_parent on unit_parent.id = child.unit_id
    where child.building_id is distinct from unit_parent.building_id
  `,
  "housekeeping_tasks.property_id->properties.id": `
    select count(*)::int as count
    from housekeeping_tasks child
    join rental_units unit_parent on unit_parent.id = child.unit_id
    where child.property_id is distinct from unit_parent.property_id
  `,
  "housekeeping_tasks.reservation_id->reservations.id": `
    select count(*)::int as count
    from housekeeping_tasks child
    join reservations parent on parent.id = child.reservation_id
    where child.reservation_id is not null
      and parent.unit_id is distinct from child.unit_id
  `,
  "page_sections.page_id->pages.id": `
    select count(*)::int as count
    from page_sections child
    join pages parent on parent.id = child.page_id
    where child.site_id is distinct from parent.site_id
  `,
  "rental_units.building_id->buildings.id": `
    select count(*)::int as count
    from rental_units child
    join buildings parent on parent.id = child.building_id
    where child.property_id is distinct from parent.property_id
  `,
  "sites.published_version_id->site_versions.id": `
    select count(*)::int as count
    from sites child
    join site_versions parent on parent.id = child.published_version_id
    where child.published_version_id is not null
      and child.id is distinct from parent.site_id
  `,
};

function assertSafeIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error(
      "Relationship inventory contains an unsafe SQL identifier.",
    );
  }
  return `"${value}"`;
}

async function readCount(
  client: RelationshipPreflightClient,
  query: string,
): Promise<number> {
  const [row] = await client.unsafe<Array<{ count: number }>>(query);
  if (!row || !Number.isInteger(row.count) || row.count < 0) {
    throw new Error("Relationship preflight returned an invalid count.");
  }
  return row.count;
}

async function auditRelationship(
  client: RelationshipPreflightClient,
  relationship: WorkspaceRelationship,
): Promise<RelationshipPreflightResult> {
  const child = assertSafeIdentifier(relationship.childTable);
  const parent = assertSafeIdentifier(relationship.parentTable);
  const foreign = assertSafeIdentifier(relationship.childForeignColumn);
  const childWorkspace = assertSafeIdentifier(
    relationship.childWorkspaceColumn,
  );
  const parentId = assertSafeIdentifier(relationship.parentIdColumn);
  const parentWorkspace = assertSafeIdentifier(
    relationship.parentWorkspaceColumn,
  );

  const [missingParentCount, crossWorkspaceCount, ownershipPathAnomalyCount] =
    await Promise.all([
      readCount(
        client,
        `select count(*)::int as count from ${child} child
         left join ${parent} parent on parent.${parentId} = child.${foreign}
         where child.${foreign} is not null and parent.${parentId} is null`,
      ),
      readCount(
        client,
        `select count(*)::int as count from ${child} child
         join ${parent} parent on parent.${parentId} = child.${foreign}
         where child.${foreign} is not null
           and child.${childWorkspace} is distinct from parent.${parentWorkspace}`,
      ),
      OWNERSHIP_PATH_ANOMALIES[relationship.key]
        ? readCount(client, OWNERSHIP_PATH_ANOMALIES[relationship.key]!)
        : Promise.resolve(0),
    ]);
  const safe =
    missingParentCount === 0 &&
    crossWorkspaceCount === 0 &&
    ownershipPathAnomalyCount === 0;

  return {
    key: relationship.key,
    missingParentCount,
    crossWorkspaceCount,
    ownershipPathAnomalyCount,
    safe,
  };
}

/** Read-only, deterministic, and intentionally returns counts rather than rows. */
export async function runRelationshipPreflight(
  client: RelationshipPreflightClient,
): Promise<RelationshipPreflightReport> {
  const relationships = [];
  for (const relationship of WORKSPACE_RELATIONSHIPS) {
    relationships.push(await auditRelationship(client, relationship));
  }
  const missingParentCount = relationships.reduce(
    (total, result) => total + result.missingParentCount,
    0,
  );
  const crossWorkspaceCount = relationships.reduce(
    (total, result) => total + result.crossWorkspaceCount,
    0,
  );
  const ownershipPathAnomalyCount = relationships.reduce(
    (total, result) => total + result.ownershipPathAnomalyCount,
    0,
  );

  return {
    relationshipCount: relationships.length,
    missingParentCount,
    crossWorkspaceCount,
    ownershipPathAnomalyCount,
    safe:
      missingParentCount === 0 &&
      crossWorkspaceCount === 0 &&
      ownershipPathAnomalyCount === 0,
    relationships,
  };
}

export function assertRelationshipPreflightSafe(
  report: RelationshipPreflightReport,
): void {
  if (!report.safe) {
    throw new Error(
      `Workspace relationship preflight refused migration: missing_parent=${report.missingParentCount}, cross_workspace=${report.crossWorkspaceCount}, ownership_path_anomaly=${report.ownershipPathAnomalyCount}.`,
    );
  }
}
