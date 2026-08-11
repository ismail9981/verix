import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { assertCanonicalRlsDatabase } from "../rls/rls-harness";
import {
  withLocalRlsDatabase,
  withRollbackTransaction,
  type RlsTransaction,
} from "../rls/rls-harness";
import {
  assertRelationshipPreflightSafe,
  runRelationshipPreflight,
} from "./relationship-preflight";
import {
  PARENT_WORKSPACE_UNIQUE_CONSTRAINTS,
  WORKSPACE_RELATIONSHIPS,
  type WorkspaceRelationship,
} from "./relationship-inventory";
import { seedRelationshipFixtures } from "./relationship-fixtures";

function quoteIdentifier(value: string): string {
  if (!/^[a-z][a-z0-9_]*$/.test(value)) {
    throw new Error("Unsafe relationship-test SQL identifier.");
  }
  return `"${value}"`;
}

function cloneOverrides(
  relationship: WorkspaceRelationship,
  index: number,
): readonly [string, string][] {
  switch (relationship.childTable) {
    case "site_domains":
      return [["hostname", `b32-${index}-${crypto.randomUUID()}.local`]];
    case "pages":
      return [["path", `/b32-${index}-${crypto.randomUUID()}`]];
    case "site_versions":
      return [["version_number", String(1000 + index)]];
    case "invoices":
      return [
        ["number", `B32-${index}-${crypto.randomUUID()}`],
        ["status", "void"],
        ["voided_at", "now()"],
      ];
    case "reservations":
      return [["status", "cancelled"]];
    case "housekeeping_tasks":
      return [["deleted_at", "now()"]];
    default:
      return [];
  }
}

async function cloneChild(
  sql: RlsTransaction,
  relationship: WorkspaceRelationship,
  childId: string,
  parentId: string,
  index: number,
): Promise<readonly unknown[]> {
  const child = quoteIdentifier(relationship.childTable);
  const foreign = quoteIdentifier(relationship.childForeignColumn);
  if (relationship.childTable === "reservations") {
    const value = (column: string) =>
      relationship.childForeignColumn === column
        ? "$1::uuid"
        : quoteIdentifier(column);
    return sql.unsafe(
      `insert into reservations
        (workspace_id, unit_id, customer_id, staff_id, status, check_in_date, check_out_date)
       select workspace_id, ${value("unit_id")}, ${value("customer_id")},
         ${value("staff_id")}, 'cancelled', check_in_date, check_out_date
       from reservations where id = $2::uuid returning id, ${foreign}`,
      [parentId, childId],
    );
  }
  const values: Array<string | number> = [parentId];
  const jsonPairs = [
    `'id', gen_random_uuid()`,
    `'${relationship.childForeignColumn}', $1::uuid`,
  ];
  for (const [column, value] of cloneOverrides(relationship, index)) {
    quoteIdentifier(column);
    if (value === "now()") {
      jsonPairs.push(`'${column}', now()`);
    } else if (column === "version_number") {
      values.push(Number(value));
      jsonPairs.push(`'${column}', $${values.length}::int`);
    } else {
      values.push(value);
      jsonPairs.push(`'${column}', $${values.length}::text`);
    }
  }
  values.push(childId);
  return sql.unsafe(
    `insert into ${child}
     select (jsonb_populate_record(
       null::${child}, to_jsonb(source) || jsonb_build_object(${jsonPairs.join(", ")})
     )).* from ${child} source where source.id = $${values.length}::uuid
     returning id, ${foreign}`,
    values,
  );
}

async function updateChild(
  sql: RlsTransaction,
  relationship: WorkspaceRelationship,
  childId: string,
  parentId: string | null,
): Promise<readonly unknown[]> {
  const child = quoteIdentifier(relationship.childTable);
  const foreign = quoteIdentifier(relationship.childForeignColumn);
  const avoidHousekeepingCheckoutConflict =
    relationship.key === "housekeeping_tasks.reservation_id->reservations.id"
      ? ", deleted_at = now()"
      : "";
  const avoidInvoiceReservationConflict =
    relationship.key === "invoices.reservation_id->reservations.id"
      ? ", status = 'void', voided_at = now()"
      : "";
  const avoidSiteVersionConflict =
    relationship.key === "site_versions.site_id->sites.id"
      ? ", version_number = 2147483647"
      : "";
  return sql.unsafe(
    `update ${child} set ${foreign} = $1::uuid${avoidHousekeepingCheckoutConflict}${avoidInvoiceReservationConflict}${avoidSiteVersionConflict} where id = $2::uuid returning id`,
    [parentId, childId],
  );
}

async function disableBusinessTriggers(sql: RlsTransaction): Promise<void> {
  await sql.unsafe(
    "alter table invoice_line_items disable trigger enforce_invoice_line_items_draft_only_trg",
  );
  await sql.unsafe(
    "alter table invoices disable trigger enforce_invoice_reservation_consistency_trg",
  );
  await sql.unsafe(
    "alter table invoices disable trigger enforce_invoice_status_transitions_trg",
  );
  await sql.unsafe(
    "alter table payments disable trigger enforce_invoice_payment_integrity_trg",
  );
  await sql.unsafe(
    "alter table payments disable trigger enforce_payment_immutability_trg",
  );
}

describe("B3.2 workspace relationship hardening", () => {
  beforeAll(async () => {
    await withLocalRlsDatabase(async (client) => {
      const gate = await assertCanonicalRlsDatabase(client);
      expect(gate.observedFingerprint).toBe(gate.expectedFingerprint);
    });
  });

  it("installs and validates all 40 composite FKs and 17 parent keys with exact actions", async () => {
    const evidence = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const constraints = await sql<
          Array<{
            name: string;
            child_table: string;
            parent_table: string;
            columns: string[];
            referenced_columns: string[];
            on_delete: string;
            on_update: string;
            validated: boolean;
            set_null_columns: string[];
          }>
        >`
          select con.conname as name,
            child.relname as child_table,
            parent.relname as parent_table,
            array(select att.attname from unnest(con.conkey) with ordinality key(attnum, ord)
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum order by key.ord) as columns,
            array(select att.attname from unnest(con.confkey) with ordinality key(attnum, ord)
              join pg_attribute att on att.attrelid = con.confrelid and att.attnum = key.attnum order by key.ord) as referenced_columns,
            case con.confdeltype when 'a' then 'no action' when 'r' then 'restrict' when 'c' then 'cascade' when 'n' then 'set null' end as on_delete,
            case con.confupdtype when 'a' then 'no action' when 'r' then 'restrict' when 'c' then 'cascade' when 'n' then 'set null' end as on_update,
            con.convalidated as validated,
            coalesce(array(select att.attname from unnest(con.confdelsetcols) with ordinality key(attnum, ord)
              join pg_attribute att on att.attrelid = con.conrelid and att.attnum = key.attnum order by key.ord), '{}'::text[]) as set_null_columns
          from pg_constraint con
          join pg_class child on child.oid = con.conrelid
          join pg_class parent on parent.oid = con.confrelid
          where con.contype = 'f' and con.conname = any(${WORKSPACE_RELATIONSHIPS.map(({ compositeForeignKeyName }) => compositeForeignKeyName)})
        `;
        const uniqueCount = await sql<Array<{ count: number }>>`
          select count(*)::int as count from pg_constraint
          where contype = 'u'
            and conname = any(${PARENT_WORKSPACE_UNIQUE_CONSTRAINTS.map((table) => `${table}_workspace_id_id_uq`)})
        `;
        return { constraints, uniqueCount: uniqueCount[0]?.count };
      }),
    );

    expect(evidence.constraints).toHaveLength(40);
    expect(evidence.uniqueCount).toBe(17);
    for (const relationship of WORKSPACE_RELATIONSHIPS) {
      const constraint = evidence.constraints.find(
        ({ name }) => name === relationship.compositeForeignKeyName,
      );
      expect(constraint, relationship.key).toMatchObject({
        child_table: relationship.childTable,
        parent_table: relationship.parentTable,
        columns: ["workspace_id", relationship.childForeignColumn],
        referenced_columns: ["workspace_id", "id"],
        on_delete: relationship.onDelete,
        on_update: relationship.onUpdate,
        validated: true,
        set_null_columns:
          relationship.onDelete === "set null"
            ? [relationship.childForeignColumn]
            : [],
      });
    }
  });

  it("allows same-workspace inserts and rejects cross-workspace inserts and updates for all 40", async () => {
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const fixtures = await seedRelationshipFixtures(sql);
        await disableBusinessTriggers(sql);

        for (const [index, relationship] of WORKSPACE_RELATIONSHIPS.entries()) {
          const fixture = fixtures[relationship.key];
          expect(fixture, relationship.key).toBeDefined();
          await expect(
            cloneChild(
              sql,
              relationship,
              fixture!.childId,
              fixture!.parentAId,
              index,
            ),
            `${relationship.key} same-workspace insert`,
          ).resolves.toHaveLength(1);
          await expect(
            sql.savepoint((savepoint) =>
              cloneChild(
                savepoint,
                relationship,
                fixture!.childId,
                fixture!.parentBId,
                index + 100,
              ),
            ),
            `${relationship.key} cross-workspace insert`,
          ).rejects.toMatchObject({ code: "23503" });
          await expect(
            sql.savepoint((savepoint) =>
              updateChild(
                savepoint,
                relationship,
                fixture!.childId,
                fixture!.parentBId,
              ),
            ),
            `${relationship.key} cross-workspace update`,
          ).rejects.toMatchObject({ code: "23503" });
        }
      }),
    );
  });

  it("preserves nullable behavior, including existing payment CHECK semantics", async () => {
    const nullRejectedByExistingChecks = new Set([
      "payments.booking_id->bookings.id",
      "payments.invoice_id->invoices.id",
      "payments.refunded_payment_id->payments.id",
    ]);
    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const fixtures = await seedRelationshipFixtures(sql);
        await disableBusinessTriggers(sql);
        for (const relationship of WORKSPACE_RELATIONSHIPS.filter(
          ({ nullable }) => nullable,
        )) {
          const fixture = fixtures[relationship.key]!;
          const operation = sql.savepoint((savepoint) =>
            updateChild(savepoint, relationship, fixture.childId, null),
          );
          if (nullRejectedByExistingChecks.has(relationship.key)) {
            await expect(operation, relationship.key).rejects.toMatchObject({
              code: "23514",
            });
          } else {
            await expect(operation, relationship.key).resolves.toHaveLength(1);
          }
        }
      }),
    );
  });

  it("refuses inconsistent data before DDL and never repairs or deletes it", async () => {
    const keys = new Set([
      "bookings.customer_id->customers.id",
      "site_domains.site_id->sites.id",
      "buildings.property_id->properties.id",
      "reservations.unit_id->rental_units.id",
      "bookings.staff_id->team_members.id",
      "crm_activities.opportunity_id->crm_opportunities.id",
    ]);
    const migration = await readFile(
      resolve(
        process.cwd(),
        "drizzle/0003_workspace_relationship_hardening.sql",
      ),
      "utf8",
    );
    const preflightSql = migration.match(/DO \$\$[\s\S]*?\$\$;/)?.[0];
    expect(preflightSql).toBeDefined();

    await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const fixtures = await seedRelationshipFixtures(sql);
        const targets = WORKSPACE_RELATIONSHIPS.filter(({ key }) =>
          keys.has(key),
        );
        for (const relationship of targets) {
          await sql.unsafe(
            `alter table ${quoteIdentifier(relationship.childTable)} drop constraint ${quoteIdentifier(relationship.compositeForeignKeyName)}`,
          );
          await updateChild(
            sql,
            relationship,
            fixtures[relationship.key]!.childId,
            fixtures[relationship.key]!.parentBId,
          );
        }

        const report = await runRelationshipPreflight(sql);
        expect(report.crossWorkspaceCount).toBe(6);
        expect(() => assertRelationshipPreflightSafe(report)).toThrow(
          "cross_workspace=6",
        );
        await expect(
          sql.savepoint((savepoint) => savepoint.unsafe(preflightSql!)),
        ).rejects.toMatchObject({ code: "P0001" });

        const [rows] = await sql<Array<{ count: number }>>`
          select (
            (select count(*) from bookings where workspace_id is distinct from
              (select workspace_id from customers where id = bookings.customer_id)) +
            (select count(*) from site_domains where workspace_id is distinct from
              (select workspace_id from sites where id = site_domains.site_id)) +
            (select count(*) from buildings where workspace_id is distinct from
              (select workspace_id from properties where id = buildings.property_id)) +
            (select count(*) from reservations where workspace_id is distinct from
              (select workspace_id from rental_units where id = reservations.unit_id)) +
            (select count(*) from bookings where staff_id is not null and workspace_id is distinct from
              (select workspace_id from team_members where id = bookings.staff_id)) +
            (select count(*) from crm_activities where workspace_id is distinct from
              (select workspace_id from crm_opportunities where id = crm_activities.opportunity_id))
          )::int as count
        `;
        expect(rows?.count).toBe(6);
      }),
    );
  });
});
