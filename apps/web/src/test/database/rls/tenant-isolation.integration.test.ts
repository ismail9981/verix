import { beforeAll, describe, expect, it } from "vitest";
import { RLS_IDS, seedRlsFixtures } from "./rls-fixtures";
import {
  assertCanonicalRlsDatabase,
  grantAuthenticatedRlsTestPrivileges,
  inspectCurrentRole,
  setAuthenticatedContext,
  withLocalRlsDatabase,
  withRollbackTransaction,
  type RlsTransaction,
} from "./rls-harness";

async function asAuthenticated<T>(
  authUserId: string,
  operation: (sql: RlsTransaction) => Promise<T>,
): Promise<T> {
  return withLocalRlsDatabase((client) =>
    withRollbackTransaction(client, async (sql) => {
      await seedRlsFixtures(sql);
      await grantAuthenticatedRlsTestPrivileges(sql);
      await setAuthenticatedContext(sql, authUserId);
      return operation(sql);
    }),
  );
}

async function visibleDomainCounts(sql: RlsTransaction) {
  const [row] = await sql<
    Array<{
      workspaces: number;
      team_members: number;
      sites: number;
      site_domains: number;
      customers: number;
      leads: number;
      opportunities: number;
      services: number;
      bookings: number;
      properties: number;
      buildings: number;
      units: number;
      reservations: number;
      housekeeping: number;
      invoices: number;
      payments: number;
    }>
  >`
    select
      (select count(*)::int from workspaces) as workspaces,
      (select count(*)::int from team_members) as team_members,
      (select count(*)::int from sites) as sites,
      (select count(*)::int from site_domains) as site_domains,
      (select count(*)::int from customers) as customers,
      (select count(*)::int from leads) as leads,
      (select count(*)::int from crm_opportunities) as opportunities,
      (select count(*)::int from services) as services,
      (select count(*)::int from bookings) as bookings,
      (select count(*)::int from properties) as properties,
      (select count(*)::int from buildings) as buildings,
      (select count(*)::int from rental_units) as units,
      (select count(*)::int from reservations) as reservations,
      (select count(*)::int from housekeeping_tasks) as housekeeping,
      (select count(*)::int from invoices) as invoices,
      (select count(*)::int from payments) as payments
  `;
  if (!row) throw new Error("Domain visibility query returned no evidence.");
  return row;
}

describe("B3 canonical and role gates", () => {
  beforeAll(async () => {
    await withLocalRlsDatabase(async (client) => {
      const gate = await assertCanonicalRlsDatabase(client);
      expect(gate).toMatchObject({
        adoptionDecision: "ADOPTABLE",
        prerequisitesPresent: 8,
      });
      expect(gate.observedFingerprint).toBe(gate.expectedFingerprint);
    });
  });

  it("runs authenticated cases as a non-superuser, non-BYPASSRLS role", async () => {
    const evidence = await asAuthenticated(
      RLS_IDS.authUserA,
      inspectCurrentRole,
    );
    expect(evidence).toMatchObject({
      currentUser: "authenticated",
      superuser: false,
      bypassRls: false,
    });
  });

  it("confirms all 32 tables enable RLS and only tenant tables carry authenticated policies", async () => {
    const evidence = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const [rls] = await sql<
          Array<{ enabled: number; forced: number; owned_by_session: number }>
        >`
          select
            count(*) filter (where c.relrowsecurity)::int as enabled,
            count(*) filter (where c.relforcerowsecurity)::int as forced,
            count(*) filter (where pg_get_userbyid(c.relowner) = session_user)::int
              as owned_by_session
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
        `;
        const [policies] = await sql<Array<{ count: number }>>`
          select count(*)::int as count from pg_policies
          where schemaname = 'public' and cmd = 'ALL'
            and roles = array['authenticated']::name[]
        `;
        return { rls, policies: policies?.count };
      }),
    );
    expect(evidence).toEqual({
      rls: { enabled: 32, forced: 0, owned_by_session: 32 },
      policies: 30,
    });
  });
});

describe("B3 positive access and workspace isolation", () => {
  it("allows a member to see one record in every representative own domain", async () => {
    const counts = await asAuthenticated(
      RLS_IDS.authUserA,
      visibleDomainCounts,
    );
    expect(counts).toMatchObject({
      workspaces: 1,
      sites: 1,
      site_domains: 1,
      customers: 1,
      leads: 1,
      opportunities: 1,
      services: 1,
      bookings: 1,
      properties: 1,
      buildings: 1,
      units: 1,
      reservations: 1,
      housekeeping: 1,
      invoices: 1,
      payments: 1,
    });
  });

  it("hides every representative Workspace B domain from User A", async () => {
    const rows = await asAuthenticated(
      RLS_IDS.authUserA,
      (sql) => sql`
      select id from customers where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from services where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from bookings where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from sites where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from properties where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from rental_units where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from reservations where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from invoices where workspace_id = ${RLS_IDS.workspaceB}
      union all select id from payments where workspace_id = ${RLS_IDS.workspaceB}
    `,
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects an INSERT targeting another workspace", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        insert into customers (workspace_id, name)
        values (${RLS_IDS.workspaceB}, 'Blocked insert')
      `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("cannot UPDATE another workspace row", async () => {
    const rows = await asAuthenticated(
      RLS_IDS.authUserA,
      (sql) => sql`
      update customers set name = 'Blocked update'
      where id = ${RLS_IDS.customerB} returning id
    `,
    );
    expect(rows).toHaveLength(0);
  });

  it("cannot DELETE another workspace row", async () => {
    const rows = await asAuthenticated(
      RLS_IDS.authUserA,
      (sql) => sql`
      delete from customers where id = ${RLS_IDS.customerB} returning id
    `,
    );
    expect(rows).toHaveLength(0);
  });

  it("rejects moving an owned row into another workspace", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        update customers set workspace_id = ${RLS_IDS.workspaceB}
        where id = ${RLS_IDS.customerA}
      `,
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("B3 membership and current role behavior", () => {
  it.each([
    ["owner", RLS_IDS.authUserA],
    ["manager", RLS_IDS.authManager],
    ["employee", RLS_IDS.authEmployee],
  ])(
    "gives the current membership-only policy the same CRUD access to %s",
    async (_role, userId) => {
      const result = await asAuthenticated(userId, async (sql) => {
        const inserted = await sql`
        insert into customers (workspace_id, name)
        values (${RLS_IDS.workspaceA}, 'Role write') returning id
      `;
        const updated = await sql`
        update customers set notes = 'updated'
        where id = ${RLS_IDS.customerA} returning id
      `;
        const deleted = await sql`
        delete from customers where name = 'Role write' returning id
      `;
        return [inserted.length, updated.length, deleted.length];
      });
      expect(result).toEqual([1, 1, 1]);
    },
  );

  it("allows a multi-workspace user to see both authorized workspaces", async () => {
    const counts = await asAuthenticated(
      RLS_IDS.authMulti,
      visibleDomainCounts,
    );
    expect(counts.workspaces).toBe(2);
    expect(counts.customers).toBe(2);
    expect(counts.invoices).toBe(2);
  });

  it.each([
    ["absent", RLS_IDS.authNonMember],
    ["inactive", RLS_IDS.authInactive],
  ])("gives an %s membership no workspace access", async (_state, userId) => {
    const counts = await asAuthenticated(userId, visibleDomainCounts);
    expect(counts.workspaces).toBe(0);
    expect(counts.customers).toBe(0);
  });
});

describe("B3 ownership dual-source behavior", () => {
  it("does not grant access from workspaces.owner_id without active membership", async () => {
    const count = await asAuthenticated(RLS_IDS.authNonMember, async (sql) => {
      await sql.unsafe("reset role");
      await sql`
        insert into workspaces (owner_id, name, slug)
        values (${RLS_IDS.authNonMember}, 'Owner ID only', 'b3-owner-id-only')
      `;
      await setAuthenticatedContext(sql, RLS_IDS.authNonMember);
      const [row] = await sql<Array<{ count: number }>>`
        select count(*)::int as count from workspaces
      `;
      return row?.count;
    });
    expect(count).toBe(0);
  });

  it("grants access from owner membership even when owner_id identifies another user", async () => {
    const count = await asAuthenticated(RLS_IDS.authUserA, async (sql) => {
      await sql.unsafe("reset role");
      const [workspace] = await sql<Array<{ id: string }>>`
        insert into workspaces (owner_id, name, slug)
        values (${RLS_IDS.authUserB}, 'Membership owner', 'b3-membership-owner')
        returning id
      `;
      if (!workspace) throw new Error("Ownership fixture was not created.");
      await sql`
        insert into team_members (workspace_id, user_id, role, status)
        values (${workspace.id}, ${RLS_IDS.authUserA}, 'owner', 'active')
      `;
      await setAuthenticatedContext(sql, RLS_IDS.authUserA);
      const [row] = await sql<Array<{ count: number }>>`
        select count(*)::int as count from workspaces where id = ${workspace.id}
      `;
      return row?.count;
    });
    expect(count).toBe(1);
  });

  it("permits multiple owner-role memberships and grants each membership access", async () => {
    const visible = await asAuthenticated(RLS_IDS.authUserB, async (sql) => {
      await sql.unsafe("reset role");
      await sql`
        insert into team_members (workspace_id, user_id, role, status)
        values (${RLS_IDS.workspaceA}, ${RLS_IDS.authUserB}, 'owner', 'active')
      `;
      await setAuthenticatedContext(sql, RLS_IDS.authUserB);
      return sql`select id from workspaces order by id`;
    });
    expect(visible).toHaveLength(2);
  });
});

describe("B3 specialized helpers", () => {
  it("returns only active memberships from current_workspace_ids", async () => {
    const active = await asAuthenticated(
      RLS_IDS.authUserA,
      (sql) => sql`select public.current_workspace_ids()::text as id`,
    );
    const inactive = await asAuthenticated(
      RLS_IDS.authInactive,
      (sql) => sql`select public.current_workspace_ids()::text as id`,
    );
    expect(active.map(({ id }) => id)).toEqual([RLS_IDS.workspaceA]);
    expect(inactive).toHaveLength(0);
  });

  it("removes a suspended Workspace from RLS despite a retained membership and stale target", async () => {
    const evidence = await asAuthenticated(RLS_IDS.authUserA, async (sql) => {
      const activeScope = await sql`
        select public.current_workspace_ids()::text as id
      `;
      const activeRows = await sql`
        select id from customers where workspace_id = ${RLS_IDS.workspaceA}
      `;

      await sql.unsafe("reset role");
      await sql`
        update workspaces set status = 'suspended'
        where id = ${RLS_IDS.workspaceA}
      `;
      const [retainedMembership] = await sql<Array<{ count: number }>>`
        select count(*)::int as count from team_members
        where workspace_id = ${RLS_IDS.workspaceA}
          and user_id = ${RLS_IDS.authUserA}
          and status = 'active' and deleted_at is null
      `;
      await setAuthenticatedContext(sql, RLS_IDS.authUserA);
      const suspendedScope = await sql`
        select public.current_workspace_ids()::text as id
      `;
      const staleTargetRows = await sql`
        select id from customers
        where workspace_id = ${RLS_IDS.workspaceA}
          and id = ${RLS_IDS.customerA}
      `;

      await sql.unsafe("reset role");
      await sql`
        update workspaces set status = 'active'
        where id = ${RLS_IDS.workspaceA}
      `;
      await setAuthenticatedContext(sql, RLS_IDS.authUserA);
      const reactivatedScope = await sql`
        select public.current_workspace_ids()::text as id
      `;
      const reactivatedRows = await sql`
        select id from customers where workspace_id = ${RLS_IDS.workspaceA}
      `;

      return {
        activeScope,
        activeRows,
        retainedMembership: retainedMembership?.count,
        suspendedScope,
        staleTargetRows,
        reactivatedScope,
        reactivatedRows,
      };
    });

    expect(evidence.activeScope).toHaveLength(1);
    expect(evidence.activeRows).toHaveLength(1);
    expect(evidence.retainedMembership).toBe(1);
    expect(evidence.suspendedScope).toHaveLength(0);
    expect(evidence.staleTargetRows).toHaveLength(0);
    expect(evidence.reactivatedScope).toHaveLength(1);
    expect(evidence.reactivatedRows).toHaveLength(1);
  });

  it("does not expose another workspace user or AI conversation/message", async () => {
    const result = await asAuthenticated(RLS_IDS.authUserA, async (sql) => ({
      users: await sql`select id from users where id = ${RLS_IDS.authUserB}`,
      conversations:
        await sql`select id from ai_conversations where id = ${RLS_IDS.conversationB}`,
      messages: await sql`
        select id from ai_messages where conversation_id = ${RLS_IDS.conversationB}
      `,
    }));
    expect(result.users).toHaveLength(0);
    expect(result.conversations).toHaveLength(0);
    expect(result.messages).toHaveLength(0);
  });

  it("exercises current_comember_ids and records suspended co-member visibility", async () => {
    const ids = await asAuthenticated(
      RLS_IDS.authUserA,
      (sql) => sql`
      select public.current_comember_ids()::text as id order by id
    `,
    );
    expect(ids.map(({ id }) => id)).toEqual(
      [
        RLS_IDS.authUserA,
        RLS_IDS.authMulti,
        RLS_IDS.authManager,
        RLS_IDS.authEmployee,
        RLS_IDS.authInactive,
      ].sort(),
    );
  });

  it("returns both authorized conversation IDs for the multi-workspace user and none for a non-member", async () => {
    const multi = await asAuthenticated(
      RLS_IDS.authMulti,
      (sql) => sql`
      select public.current_conversation_ids()::text as id order by id
    `,
    );
    const nonMember = await asAuthenticated(
      RLS_IDS.authNonMember,
      (sql) => sql`
      select public.current_conversation_ids()::text as id
    `,
    );
    expect(multi.map(({ id }) => id)).toEqual([
      RLS_IDS.conversationA,
      RLS_IDS.conversationB,
    ]);
    expect(nonMember).toHaveLength(0);
  });

  it("verifies helper SECURITY DEFINER, search_path, owner trust, and effective ACLs", async () => {
    const helpers = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(
        client,
        (sql) => sql<
          Array<{
            name: string;
            security_definer: boolean;
            search_path: string[] | null;
            trusted_owner: boolean;
            public_execute: boolean;
            anon_execute: boolean;
            authenticated_execute: boolean;
          }>
        >`
        select p.proname as name,
          p.prosecdef as security_definer,
          p.proconfig as search_path,
          (owner.rolname in ('postgres', 'supabase_admin')
            and (owner.rolsuper or owner.rolbypassrls)) as trusted_owner,
          has_function_privilege('public', p.oid, 'execute') as public_execute,
          has_function_privilege('anon', p.oid, 'execute') as anon_execute,
          has_function_privilege('authenticated', p.oid, 'execute')
            as authenticated_execute
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        join pg_roles owner on owner.oid = p.proowner
        where n.nspname = 'public'
          and p.proname in (
            'current_workspace_ids',
            'current_comember_ids',
            'current_conversation_ids'
          )
        order by p.proname
      `,
      ),
    );
    expect(helpers).toHaveLength(3);
    for (const helper of helpers) {
      expect(helper).toMatchObject({
        security_definer: true,
        search_path: ["search_path=public"],
        trusted_owner: true,
        public_execute: false,
        anon_execute: false,
        authenticated_execute: false,
      });
    }
  });
});

describe("B3 service and owner bypass boundaries", () => {
  it("proves service_role has BYPASSRLS but no direct Verix table SELECT grant", async () => {
    const evidence = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        const [role] = await sql<
          Array<{ bypass_rls: boolean; can_select: boolean }>
        >`
          select rolbypassrls as bypass_rls,
            has_table_privilege('service_role', 'public.customers', 'select') as can_select
          from pg_roles where rolname = 'service_role'
        `;
        return role;
      }),
    );
    expect(evidence).toEqual({ bypass_rls: true, can_select: false });
  });

  it("rejects a direct service_role table query because canonical ACLs deny it", async () => {
    await expect(
      withLocalRlsDatabase((client) =>
        withRollbackTransaction(client, async (sql) => {
          await seedRlsFixtures(sql);
          await sql.unsafe("set local role service_role");
          return sql`select id from customers`;
        }),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("proves service_role bypass exposes both workspaces when a rollback-only fixture grants SELECT", async () => {
    const count = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedRlsFixtures(sql);
        await sql.unsafe("grant select on public.customers to service_role");
        await sql.unsafe("set local role service_role");
        const role = await inspectCurrentRole(sql);
        const [row] = await sql<Array<{ count: number }>>`
          select count(*)::int as count from customers
        `;
        expect(role).toMatchObject({
          currentUser: "service_role",
          bypassRls: true,
        });
        return row?.count;
      }),
    );
    expect(count).toBe(2);
  });

  it("proves the database owner connection bypasses RLS and sees both workspaces", async () => {
    const count = await withLocalRlsDatabase((client) =>
      withRollbackTransaction(client, async (sql) => {
        await seedRlsFixtures(sql);
        const role = await inspectCurrentRole(sql);
        const [row] = await sql<Array<{ count: number }>>`
          select count(*)::int as count from customers
        `;
        expect(role.bypassRls).toBe(true);
        return row?.count;
      }),
    );
    expect(count).toBe(2);
  });
});

describe("B3 indirect cross-workspace relationships", () => {
  it("rejects a booking that references Workspace B parents from Workspace A", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        insert into bookings (workspace_id, customer_id, service_id, starts_at, ends_at)
        values (${RLS_IDS.workspaceA}, ${RLS_IDS.customerB}, ${RLS_IDS.serviceB},
          '2031-01-01T09:00:00Z', '2031-01-01T10:00:00Z') returning id
      `,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects a Workspace A domain that references a Workspace B site", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        insert into site_domains (site_id, workspace_id, hostname, type)
        values (${RLS_IDS.siteB}, ${RLS_IDS.workspaceA}, 'cross.b3.local', 'custom')
        returning id
      `,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects a Workspace A building that references a Workspace B property", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        insert into buildings (workspace_id, property_id, name)
        values (${RLS_IDS.workspaceA}, ${RLS_IDS.propertyB}, 'Cross building')
        returning id
      `,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it("rejects a Workspace A reservation that references Workspace B parents", async () => {
    await expect(
      asAuthenticated(
        RLS_IDS.authUserA,
        (sql) => sql`
        insert into reservations
          (workspace_id, unit_id, customer_id, check_in_date, check_out_date)
        values (${RLS_IDS.workspaceA}, ${RLS_IDS.unitB}, ${RLS_IDS.customerB},
          '2031-02-01', '2031-02-03') returning id
      `,
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });

  it.each([
    ["invoice-reservation", "invoice"],
    ["line-item-invoice", "line-item"],
    ["payment-invoice", "payment"],
  ])(
    "blocks the trigger-protected %s cross-workspace relationship",
    async (_name, kind) => {
      await expect(
        asAuthenticated(RLS_IDS.authUserA, (sql) => {
          if (kind === "invoice") {
            return sql`
            insert into invoices (workspace_id, reservation_id, number)
            values (${RLS_IDS.workspaceA}, ${RLS_IDS.reservationB}, 'B3-CROSS')
          `;
          }
          if (kind === "line-item") {
            return sql`
            insert into invoice_line_items
              (workspace_id, invoice_id, type, description, unit_amount_cents, amount_cents)
            values (${RLS_IDS.workspaceA}, ${RLS_IDS.invoiceB}, 'stay',
              'Cross line', 100, 100)
          `;
          }
          return sql`
          insert into payments
            (workspace_id, invoice_id, amount_cents, status, type)
          values (${RLS_IDS.workspaceA}, ${RLS_IDS.invoiceB}, 100, 'paid', 'charge')
        `;
        }),
      ).rejects.toMatchObject({ code: "P0001" });
    },
  );
});
