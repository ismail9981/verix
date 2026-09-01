import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT_DIRECTORY = resolve(process.cwd(), "../..");
const EMAIL_PREFIX = "b6-1-postgrest-";
const PASSWORD = "B6.1-local-proof-2026!";
const WORKSPACE_ID = "61000000-0000-4000-8000-000000000001";
const OWNER_MEMBER_ID = "61100000-0000-4000-8000-000000000001";
const MANAGER_MEMBER_ID = "61100000-0000-4000-8000-000000000002";
const EMPLOYEE_MEMBER_ID = "61100000-0000-4000-8000-000000000003";
const CUSTOMER_ID = "61200000-0000-4000-8000-000000000001";
const SERVICE_ID = "61300000-0000-4000-8000-000000000001";
const BOOKING_ID = "61400000-0000-4000-8000-000000000001";
const INVOICE_ID = "61500000-0000-4000-8000-000000000001";
const CHARGE_ID = "61600000-0000-4000-8000-000000000001";
const REFUND_ID = "61600000-0000-4000-8000-000000000002";
const SITE_ID = "61700000-0000-4000-8000-000000000001";
const PAGE_ID = "61800000-0000-4000-8000-000000000001";
const VERSION_ID = "61900000-0000-4000-8000-000000000001";

type LocalStatus = {
  API_URL: string;
  DB_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
};

type Actor = "owner" | "manager" | "employee";

type AuthFixture = {
  id: string;
  email: string;
  token: string;
};

type RestResult = {
  status: number;
  body: unknown;
};

let status: LocalStatus;
let database: ReturnType<typeof postgres>;
let admin: SupabaseClient;
const actors = {} as Record<Actor, AuthFixture>;

function readLocalStatus(): LocalStatus {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    cwd: ROOT_DIRECTORY,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  const parsed = JSON.parse(output) as LocalStatus;
  if (
    parsed.API_URL !== "http://127.0.0.1:54321" ||
    !parsed.DB_URL.includes("@127.0.0.1:54322/postgres")
  ) {
    throw new Error("B6.1 proof requires the repository-local Supabase stack.");
  }
  return parsed;
}

async function removeStaleFixtures(): Promise<void> {
  await database`
    delete from public.payments
    where type = 'refund'
      and workspace_id in (
        select id from public.workspaces
        where owner_id in (
          select id from public.users where email like ${`${EMAIL_PREFIX}%`}
        )
      )
  `;

  await database`
    delete from public.payments
    where workspace_id in (
      select id from public.workspaces
      where owner_id in (
        select id from public.users where email like ${`${EMAIL_PREFIX}%`}
      )
    )
  `;

  await database`
    update public.invoices
    set status = 'draft',
        issued_at = null
    where workspace_id in (
      select id from public.workspaces
      where owner_id in (
        select id from public.users where email like ${`${EMAIL_PREFIX}%`}
      )
    )
      and status not in ('void', 'written_off')
  `;

  await database`
    delete from public.invoice_line_items
    where workspace_id in (
      select id from public.workspaces
      where owner_id in (
        select id from public.users where email like ${`${EMAIL_PREFIX}%`}
      )
    )
  `;

  await database`
    delete from public.workspaces
    where owner_id in (
      select id from public.users where email like ${`${EMAIL_PREFIX}%`}
    )
  `;

  await database`
    delete from public.users where email like ${`${EMAIL_PREFIX}%`}
  `;

  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;
  for (const user of data.users) {
    if (user.email?.startsWith(EMAIL_PREFIX)) {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }
  }
}

async function createActor(actor: Actor): Promise<AuthFixture> {
  const email = `${EMAIL_PREFIX}${actor}@verix.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;

  const response = await fetch(
    `${status.API_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: status.ANON_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email, password: PASSWORD }),
    },
  );
  const body = (await response.json()) as { access_token?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(`Could not establish local ${actor} session.`);
  }
  return { id: data.user.id, email, token: body.access_token };
}

async function rest(
  actor: Actor,
  tableAndQuery: string,
  init: RequestInit = {},
): Promise<RestResult> {
  const response = await fetch(`${status.API_URL}/rest/v1/${tableAndQuery}`, {
    ...init,
    headers: {
      apikey: status.ANON_KEY,
      authorization: `Bearer ${actors[actor].token}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

async function restWithCredential(
  credential: string,
  tableAndQuery: string,
  init: RequestInit = {},
): Promise<RestResult> {
  const response = await fetch(`${status.API_URL}/rest/v1/${tableAndQuery}`, {
    ...init,
    headers: {
      apikey: credential,
      authorization: `Bearer ${credential}`,
      "content-type": "application/json",
      prefer: "return=representation",
      ...init.headers,
    },
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as unknown) : null,
  };
}

function expectTableAclDenied(result: RestResult): void {
  expect([401, 403]).toContain(result.status);
  expect(result.body).toMatchObject({ code: "42501" });
}

function expectRpcDenied(result: RestResult): void {
  // PostgREST may omit a non-executable function from its role-specific schema
  // cache (PGRST202) or surface PostgreSQL's ACL rejection (42501).
  expect([401, 403, 404]).toContain(result.status);
  expect(["42501", "PGRST202"]).toContain(
    (result.body as { code?: string } | null)?.code,
  );
}

beforeAll(async () => {
  status = readLocalStatus();
  database = postgres(status.DB_URL, { max: 1, prepare: false });
  admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await removeStaleFixtures();

  actors.owner = await createActor("owner");
  actors.manager = await createActor("manager");
  actors.employee = await createActor("employee");

  await database`
    insert into public.users (id, auth_user_id, email, full_name, email_verified)
    values
      (${actors.owner.id}, ${actors.owner.id}, ${actors.owner.email}, 'B6.1 Owner', true),
      (${actors.manager.id}, ${actors.manager.id}, ${actors.manager.email}, 'B6.1 Manager', true),
      (${actors.employee.id}, ${actors.employee.id}, ${actors.employee.email}, 'B6.1 Employee', true)
  `;
  await database`
    insert into public.workspaces (id, owner_id, name, slug)
    values (${WORKSPACE_ID}, ${actors.owner.id}, 'B6.1 Workspace', 'b6-1-postgrest-workspace')
  `;
  await database`
    insert into public.team_members (id, workspace_id, user_id, role, status)
    values
      (${OWNER_MEMBER_ID}, ${WORKSPACE_ID}, ${actors.owner.id}, 'owner', 'active'),
      (${MANAGER_MEMBER_ID}, ${WORKSPACE_ID}, ${actors.manager.id}, 'manager', 'active'),
      (${EMPLOYEE_MEMBER_ID}, ${WORKSPACE_ID}, ${actors.employee.id}, 'employee', 'active')
  `;
  await database`
    insert into public.settings (workspace_id) values (${WORKSPACE_ID})
  `;
  await database`
    insert into public.customers (id, workspace_id, name)
    values (${CUSTOMER_ID}, ${WORKSPACE_ID}, 'B6.1 Customer')
  `;
  await database`
    insert into public.services (id, workspace_id, name, price_cents)
    values (${SERVICE_ID}, ${WORKSPACE_ID}, 'B6.1 Service', 10000)
  `;
  await database`
    insert into public.bookings (
      id, workspace_id, customer_id, service_id, staff_id,
      starts_at, ends_at, price_cents
    ) values (
      ${BOOKING_ID}, ${WORKSPACE_ID}, ${CUSTOMER_ID}, ${SERVICE_ID}, ${EMPLOYEE_MEMBER_ID},
      '2031-01-01T09:00:00Z', '2031-01-01T10:00:00Z', 10000
    )
  `;
  await database`
    insert into public.invoices (id, workspace_id, customer_id, number, notes)
    values (${INVOICE_ID}, ${WORKSPACE_ID}, ${CUSTOMER_ID}, 'B6.1-001', 'financial fixture')
  `;
  await database`
    insert into public.invoice_line_items (
      workspace_id, invoice_id, type, description, quantity,
      unit_amount_cents, amount_cents
    ) values (${WORKSPACE_ID}, ${INVOICE_ID}, 'stay', 'B6.1 line', 1, 10000, 10000)
  `;
  await database`
    update public.invoices
    set status = 'open', issued_at = now()
    where id = ${INVOICE_ID}
  `;
  await database`
    insert into public.payments (
      id, workspace_id, customer_id, invoice_id, amount_cents,
      status, type, idempotency_key, actor_team_member_id, paid_at
    ) values (
      ${CHARGE_ID}, ${WORKSPACE_ID}, ${CUSTOMER_ID}, ${INVOICE_ID}, 6000,
      'paid', 'charge', 'b6-1-charge', ${OWNER_MEMBER_ID}, now()
    )
  `;
  await database`
    insert into public.payments (
      id, workspace_id, customer_id, invoice_id, amount_cents,
      status, type, refunded_payment_id, idempotency_key,
      actor_team_member_id, paid_at
    ) values (
      ${REFUND_ID}, ${WORKSPACE_ID}, ${CUSTOMER_ID}, ${INVOICE_ID}, 1000,
      'paid', 'refund', ${CHARGE_ID}, 'b6-1-refund',
      ${OWNER_MEMBER_ID}, now()
    )
  `;
  await database`
    insert into public.sites (id, workspace_id, name)
    values (${SITE_ID}, ${WORKSPACE_ID}, 'B6.1 Site')
  `;
  await database`
    insert into public.pages (id, site_id, workspace_id, path, title)
    values (${PAGE_ID}, ${SITE_ID}, ${WORKSPACE_ID}, '', 'B6.1 Home')
  `;
  await database`
    insert into public.page_sections (page_id, site_id, workspace_id, type_key, props)
    values (${PAGE_ID}, ${SITE_ID}, ${WORKSPACE_ID}, 'hero', '{}'::jsonb)
  `;
  await database`
    insert into public.site_versions (id, site_id, workspace_id, version_number, snapshot)
    values (${VERSION_ID}, ${SITE_ID}, ${WORKSPACE_ID}, 1, '{}'::jsonb)
  `;
  await database`
    insert into public.site_domains (site_id, workspace_id, hostname, type)
    values (${SITE_ID}, ${WORKSPACE_ID}, 'b6-1-postgrest.local', 'custom')
  `;
});

afterAll(async () => {
  if (database && admin) {
    await removeStaleFixtures();
    await database.end();
  }
});

describe("B6.3 direct PostgREST ACL denial regression", () => {
  it("proves all three normal Workspace JWTs remain valid through Supabase Auth", async () => {
    for (const actor of ["owner", "manager", "employee"] as const) {
      const response = await fetch(`${status.API_URL}/auth/v1/user`, {
        headers: {
          apikey: status.ANON_KEY,
          authorization: `Bearer ${actors[actor].token}`,
        },
      });
      const body = (await response.json()) as { id?: string };
      expect(response.status).toBe(200);
      expect(body.id).toBe(actors[actor].id);
    }
  });

  it("denies anonymous direct table access at the ACL boundary", async () => {
    const response = await fetch(`${status.API_URL}/rest/v1/sites?select=id`, {
      headers: { apikey: status.ANON_KEY },
    });
    const body = (await response.json()) as unknown;
    expectTableAclDenied({ status: response.status, body });
  });

  it("denies all B6 financial reads to an authenticated employee", async () => {
    for (const query of [
      "invoices?select=id",
      "invoice_line_items?select=id",
      "payments?select=id&type=eq.charge",
      "payments?select=id&type=eq.refund",
    ]) {
      expectTableAclDenied(await rest("employee", query));
    }
  });

  it("denies financial table writes to an authenticated employee", async () => {
    const cases: Array<[string, RequestInit]> = [
      [
        "invoices",
        {
          method: "POST",
          body: JSON.stringify({
            workspace_id: WORKSPACE_ID,
            customer_id: CUSTOMER_ID,
            number: "B6.3-DENIED",
          }),
        },
      ],
      [
        `invoices?id=eq.${INVOICE_ID}`,
        {
          method: "PATCH",
          body: JSON.stringify({ notes: "must remain unchanged" }),
        },
      ],
      [`invoices?id=eq.${INVOICE_ID}`, { method: "DELETE" }],
    ];

    for (const [query, init] of cases) {
      expectTableAclDenied(await rest("employee", query, init));
    }
  });

  it("denies Team, settings, Website Builder, and Platform-only table operations", async () => {
    const cases: Array<[string, RequestInit?]> = [
      ["team_members?select=id,role"],
      ["settings?select=id"],
      ["sites?select=id"],
      ["pages?select=id"],
      ["page_sections?select=id"],
      ["site_versions?select=id"],
      ["site_domains?select=id"],
      [
        `team_members?id=eq.${EMPLOYEE_MEMBER_ID}`,
        { method: "PATCH", body: JSON.stringify({ role: "owner" }) },
      ],
      [
        `settings?workspace_id=eq.${WORKSPACE_ID}`,
        {
          method: "PATCH",
          body: JSON.stringify({ primary_color: "#123456" }),
        },
      ],
      [
        `sites?id=eq.${SITE_ID}`,
        {
          method: "PATCH",
          body: JSON.stringify({ name: "must remain unchanged" }),
        },
      ],
    ];

    for (const [query, init] of cases) {
      expectTableAclDenied(await rest("employee", query, init));
    }
    for (const actor of ["manager", "owner"] as const) {
      expectTableAclDenied(await rest(actor, "sites?select=id"));
    }
  });

  it("denies direct invocation of all three internal RLS helpers", async () => {
    for (const helper of [
      "current_workspace_ids",
      "current_comember_ids",
      "current_conversation_ids",
    ]) {
      expectRpcDenied(
        await rest("employee", `rpc/${helper}`, {
          method: "POST",
          body: "{}",
        }),
      );
    }
  });

  it.each(["platform_admins", "platform_audit_events"])(
    "denies anon and authenticated CRUD on %s",
    async (table) => {
      const cases: Array<[string, RequestInit]> = [
        [`${table}?select=id`, { method: "GET" }],
        [table, { method: "POST", body: JSON.stringify({}) }],
        [
          `${table}?id=eq.00000000-0000-4000-8000-000000000000`,
          {
            method: "PATCH",
            body: JSON.stringify({}),
          },
        ],
        [
          `${table}?id=eq.00000000-0000-4000-8000-000000000000`,
          {
            method: "DELETE",
          },
        ],
      ];

      for (const [query, init] of cases) {
        expectTableAclDenied(
          await restWithCredential(status.ANON_KEY, query, init),
        );
        expectTableAclDenied(await rest("employee", query, init));
      }
    },
  );

  it("keeps service-role Auth administration operational but denies platform-table Data API CRUD", async () => {
    const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    expect(error).toBeNull();

    for (const table of ["platform_admins", "platform_audit_events"] as const) {
      for (const [query, init] of [
        [`${table}?select=id`, { method: "GET" }],
        [table, { method: "POST", body: JSON.stringify({}) }],
        [
          `${table}?id=eq.00000000-0000-4000-8000-000000000000`,
          {
            method: "PATCH",
            body: JSON.stringify({}),
          },
        ],
        [
          `${table}?id=eq.00000000-0000-4000-8000-000000000000`,
          {
            method: "DELETE",
          },
        ],
      ] satisfies Array<[string, RequestInit]>) {
        expectTableAclDenied(
          await restWithCredential(status.SERVICE_ROLE_KEY, query, init),
        );
      }
    }
  });

  it("does not expose the new trigger helpers as PostgREST RPCs", async () => {
    for (const helper of [
      "enforce_platform_admin_auth_user_id_immutability",
      "prevent_platform_audit_event_mutation",
    ]) {
      expectRpcDenied(
        await rest("employee", `rpc/${helper}`, {
          method: "POST",
          body: "{}",
        }),
      );
    }
  });
});
