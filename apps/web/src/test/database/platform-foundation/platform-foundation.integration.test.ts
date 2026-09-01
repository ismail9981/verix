import { beforeAll, describe, expect, it } from "vitest";
import {
  assertCanonicalRlsDatabase,
  type RlsTransaction,
  withLocalRlsDatabase,
  withRollbackTransaction,
} from "../rls/rls-harness";

const ids = {
  admin: "82000000-0000-4000-8000-000000000001",
  otherAdmin: "82000000-0000-4000-8000-000000000002",
  auth: "82100000-0000-4000-8000-000000000001",
  otherAuth: "82100000-0000-4000-8000-000000000002",
  event: "82200000-0000-4000-8000-000000000001",
  target: "82300000-0000-4000-8000-000000000001",
  idempotency: "82400000-0000-4000-8000-000000000001",
} as const;

async function seedAdmin(
  sql: RlsTransaction,
  options: {
    id?: string;
    authUserId?: string;
    status?: "active" | "suspended";
  } = {},
): Promise<void> {
  await sql`
    insert into platform_admins (id, auth_user_id, role, status)
    values (
      ${options.id ?? ids.admin},
      ${options.authUserId ?? ids.auth},
      'super_admin',
      ${options.status ?? "active"}
    )
  `;
}

describe("B2 Platform Admin identity constraints", () => {
  beforeAll(async () => {
    await withLocalRlsDatabase(async (client) => {
      const gate = await assertCanonicalRlsDatabase(client);
      expect(gate.adoptionDecision).toBe("ADOPTABLE");
      expect(gate.observedFingerprint).toBe(gate.expectedFingerprint);
    });
  });

  it("persists both valid roles and suspension without a tenant dependency", async () => {
    const rows = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedAdmin(sql, { status: "suspended" });
        await sql`
          insert into platform_admins (id, auth_user_id, role)
          values (${ids.otherAdmin}, ${ids.otherAuth}, 'support_admin')
        `;
        return sql`
          select role::text, status::text from platform_admins
          where id in (${ids.admin}, ${ids.otherAdmin}) order by id
        `;
      }),
    );
    expect(rows).toEqual([
      { role: "super_admin", status: "suspended" },
      { role: "support_admin", status: "active" },
    ]);
  });

  it("rejects a null or duplicate Auth UUID", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(
          client,
          (sql) => sql`
          insert into platform_admins (auth_user_id, role)
          values (null, 'super_admin')
        `,
        ),
      ),
    ).rejects.toMatchObject({ code: "23502" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_admins (auth_user_id, role)
            values (${ids.auth}, 'support_admin')
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("rejects invalid enum values", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, (sql) =>
          sql.unsafe(`
          insert into platform_admins (auth_user_id, role)
          values ('${ids.auth}', 'workspace_owner')
        `),
        ),
      ),
    ).rejects.toMatchObject({ code: "22P02" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, (sql) =>
          sql.unsafe(`
          insert into platform_admins (auth_user_id, role, status)
          values ('${ids.auth}', 'super_admin', 'deleted')
        `),
        ),
      ),
    ).rejects.toMatchObject({ code: "22P02" });
  });

  it("enforces Auth UUID immutability", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            update platform_admins set auth_user_id = ${ids.otherAuth}
            where id = ${ids.admin}
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("has no tenant identity or membership foreign-key dependency", async () => {
    const evidence = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(
        client,
        (sql) => sql<Array<{ columns: string[]; referenced_table: string }>>`
        select array_agg(a.attname order by key.ordinality) as columns,
          referenced.relname as referenced_table
        from pg_constraint c
        join pg_class owned on owned.oid = c.conrelid
        join pg_class referenced on referenced.oid = c.confrelid
        join unnest(c.conkey) with ordinality as key(attnum, ordinality) on true
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key.attnum
        where owned.relname = 'platform_admins' and c.contype = 'f'
        group by referenced.relname
      `,
      ),
    );
    expect(evidence).toEqual([]);
  });
});

describe("B2 Platform Audit integrity", () => {
  it("creates the first admin and system bootstrap event atomically", async () => {
    const evidence = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedAdmin(sql);
        await sql`
          insert into platform_audit_events (
            id, actor_kind, action, target_type, target_id,
            outcome, request_id, metadata
          ) values (
            ${ids.event}, 'system_bootstrap',
            'platform_admin.bootstrap_completed', 'platform_admin', ${ids.admin},
            'success', 'b2-bootstrap', '{"environment":"local"}'::jsonb
          )
        `;
        const [row] = await sql<
          Array<{ admins: number; events: number; actor_id: string | null }>
        >`
          select
            (select count(*)::int from platform_admins where id = ${ids.admin}) as admins,
            (select count(*)::int from platform_audit_events where id = ${ids.event}) as events,
            (select actor_platform_admin_id::text from platform_audit_events
              where id = ${ids.event}) as actor_id
        `;
        return row;
      }),
    );
    expect(evidence).toEqual({ admins: 1, events: 1, actor_id: null });
  });

  it("accepts a matching Platform actor snapshot and rejects a mismatched pair", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, target_id, outcome, request_id
            ) values (
              'platform_admin', ${ids.admin}, ${ids.otherAuth},
              'workspace.created', 'workspace', ${ids.target},
              'success', 'b2-mismatch'
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23503" });

    const count = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedAdmin(sql);
        await sql`
          insert into platform_audit_events (
            actor_kind, actor_platform_admin_id, actor_auth_user_id,
            action, target_type, target_id, outcome, request_id
          ) values (
            'platform_admin', ${ids.admin}, ${ids.auth},
            'workspace.created', 'workspace', ${ids.target},
            'success', 'b2-valid-actor'
          )
        `;
        const [row] = await sql<Array<{ count: number }>>`
          select count(*)::int as count from platform_audit_events
          where actor_platform_admin_id = ${ids.admin}
        `;
        return row?.count;
      }),
    );
    expect(count).toBe(1);
  });

  it("rejects invalid bootstrap/system and success-target shapes", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(
          client,
          (sql) => sql`
          insert into platform_audit_events (
            actor_kind, action, target_type, target_id, outcome, request_id
          ) values (
            'system_bootstrap', 'workspace.created', 'workspace', ${ids.target},
            'success', 'b2-invalid-system'
          )
        `,
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, outcome, request_id
            ) values (
              'platform_admin', ${ids.admin}, ${ids.auth},
              'workspace.created', 'workspace', 'success', 'b2-no-target'
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("enforces paired idempotency, lowercase SHA-256, and success uniqueness", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, target_id, outcome, request_id,
              idempotency_key
            ) values (
              'platform_admin', ${ids.admin}, ${ids.auth},
              'workspace.created', 'workspace', ${ids.target}, 'success',
              'b2-half-pair', ${ids.idempotency}
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, target_id, outcome, request_id,
              idempotency_key, request_fingerprint
            ) values (
              'platform_admin', ${ids.admin}, ${ids.auth},
              'workspace.created', 'workspace', ${ids.target}, 'success',
              'b2-bad-hash', ${ids.idempotency}, ${"A".repeat(64)}
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          for (let attempt = 0; attempt < 2; attempt += 1) {
            await sql`
              insert into platform_audit_events (
                actor_kind, actor_platform_admin_id, actor_auth_user_id,
                action, target_type, target_id, outcome, request_id,
                idempotency_key, request_fingerprint
              ) values (
                'platform_admin', ${ids.admin}, ${ids.auth},
                'workspace.created', 'workspace', ${ids.target}, 'success',
                ${`b2-duplicate-${attempt}`}, ${ids.idempotency}, ${"a".repeat(64)}
              )
            `;
          }
        }),
      ),
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("limits metadata to a 16 KiB JSON object", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, outcome, request_id, metadata
            ) values (
              'platform_admin', ${ids.admin}, ${ids.auth},
              'workspace.created', 'workspace', 'failure',
              'b2-array-metadata', '[]'::jsonb
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedAdmin(sql);
          await sql`
            insert into platform_audit_events (
              actor_kind, actor_platform_admin_id, actor_auth_user_id,
              action, target_type, outcome, request_id, metadata
            ) values (
              'platform_admin', ${ids.admin}, ${ids.auth},
              'workspace.created', 'workspace', 'failure',
              'b2-large-metadata', ${JSON.stringify({ value: "x".repeat(17_000) })}::jsonb
            )
          `;
        }),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("rejects every UPDATE and DELETE while preserving INSERT", async () => {
    for (const statement of ["update", "delete"] as const) {
      await expect(
        withLocalRlsDatabase((client) =>
          withRollbackTransaction(client, async (sql) => {
            await seedAdmin(sql);
            await sql`
              insert into platform_audit_events (
                id, actor_kind, actor_platform_admin_id, actor_auth_user_id,
                action, target_type, outcome, request_id
              ) values (
                ${ids.event}, 'platform_admin', ${ids.admin}, ${ids.auth},
                'workspace.created', 'workspace', 'failure', 'b2-append-only'
              )
            `;
            if (statement === "update") {
              await sql`
                update platform_audit_events set request_id = 'changed'
                where id = ${ids.event}
              `;
            } else {
              await sql`delete from platform_audit_events where id = ${ids.event}`;
            }
          }),
        ),
      ).rejects.toMatchObject({ code: "55000" });
    }
  });
});
