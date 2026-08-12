import type { RlsTransaction } from "./rls-harness";

export const RLS_IDS = {
  authUserA: "10000000-0000-4000-8000-000000000001",
  authUserB: "10000000-0000-4000-8000-000000000002",
  authMulti: "10000000-0000-4000-8000-000000000003",
  authNonMember: "10000000-0000-4000-8000-000000000004",
  authManager: "10000000-0000-4000-8000-000000000005",
  authEmployee: "10000000-0000-4000-8000-000000000006",
  authInactive: "10000000-0000-4000-8000-000000000007",
  workspaceA: "20000000-0000-4000-8000-000000000001",
  workspaceB: "20000000-0000-4000-8000-000000000002",
  teamMemberA: "21000000-0000-4000-8000-000000000001",
  teamMemberB: "21000000-0000-4000-8000-000000000002",
  customerA: "30000000-0000-4000-8000-000000000001",
  customerB: "30000000-0000-4000-8000-000000000002",
  serviceA: "31000000-0000-4000-8000-000000000001",
  serviceB: "31000000-0000-4000-8000-000000000002",
  bookingA: "32000000-0000-4000-8000-000000000001",
  bookingB: "32000000-0000-4000-8000-000000000002",
  siteA: "33000000-0000-4000-8000-000000000001",
  siteB: "33000000-0000-4000-8000-000000000002",
  propertyA: "34000000-0000-4000-8000-000000000001",
  propertyB: "34000000-0000-4000-8000-000000000002",
  buildingA: "35000000-0000-4000-8000-000000000001",
  buildingB: "35000000-0000-4000-8000-000000000002",
  unitA: "36000000-0000-4000-8000-000000000001",
  unitB: "36000000-0000-4000-8000-000000000002",
  reservationA: "37000000-0000-4000-8000-000000000001",
  reservationB: "37000000-0000-4000-8000-000000000002",
  invoiceA: "38000000-0000-4000-8000-000000000001",
  invoiceB: "38000000-0000-4000-8000-000000000002",
  conversationA: "39000000-0000-4000-8000-000000000001",
  conversationB: "39000000-0000-4000-8000-000000000002",
} as const;

const USERS = [
  [RLS_IDS.authUserA, "b3-user-a@verix.local", "User A"],
  [RLS_IDS.authUserB, "b3-user-b@verix.local", "User B"],
  [RLS_IDS.authMulti, "b3-multi@verix.local", "Multi User"],
  [RLS_IDS.authNonMember, "b3-none@verix.local", "Non-member"],
  [RLS_IDS.authManager, "b3-manager@verix.local", "Manager"],
  [RLS_IDS.authEmployee, "b3-employee@verix.local", "Employee"],
  [RLS_IDS.authInactive, "b3-inactive@verix.local", "Inactive"],
] as const;

/** Installs deterministic two-workspace fixtures inside a rollback-only test. */
export async function seedRlsFixtures(sql: RlsTransaction): Promise<void> {
  for (const [id, email, name] of USERS) {
    await sql`
      insert into auth.users (id, email, aud, role, created_at, updated_at)
      values (${id}, ${email}, 'authenticated', 'authenticated', now(), now())
    `;
    await sql`
      insert into public.users (id, auth_user_id, email, full_name)
      values (${id}, ${id}, ${email}, ${name})
    `;
  }

  await sql`
    insert into workspaces (id, owner_id, name, slug) values
      (${RLS_IDS.workspaceA}, ${RLS_IDS.authUserA}, 'B3 Workspace A', 'b3-workspace-a'),
      (${RLS_IDS.workspaceB}, ${RLS_IDS.authUserB}, 'B3 Workspace B', 'b3-workspace-b')
  `;
  await sql`
    insert into team_members (id, workspace_id, user_id, role, status) values
      (${RLS_IDS.teamMemberA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.authUserA}, 'owner', 'active'),
      (${RLS_IDS.teamMemberB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.authUserB}, 'owner', 'active'),
      (gen_random_uuid(), ${RLS_IDS.workspaceA}, ${RLS_IDS.authMulti}, 'manager', 'active'),
      (gen_random_uuid(), ${RLS_IDS.workspaceB}, ${RLS_IDS.authMulti}, 'employee', 'active'),
      (gen_random_uuid(), ${RLS_IDS.workspaceA}, ${RLS_IDS.authManager}, 'manager', 'active'),
      (gen_random_uuid(), ${RLS_IDS.workspaceA}, ${RLS_IDS.authEmployee}, 'employee', 'active'),
      (gen_random_uuid(), ${RLS_IDS.workspaceA}, ${RLS_IDS.authInactive}, 'employee', 'suspended')
  `;

  await sql`
    insert into customers (id, workspace_id, name) values
      (${RLS_IDS.customerA}, ${RLS_IDS.workspaceA}, 'Customer A'),
      (${RLS_IDS.customerB}, ${RLS_IDS.workspaceB}, 'Customer B')
  `;
  await sql`
    insert into services (id, workspace_id, name, price_cents) values
      (${RLS_IDS.serviceA}, ${RLS_IDS.workspaceA}, 'Service A', 1000),
      (${RLS_IDS.serviceB}, ${RLS_IDS.workspaceB}, 'Service B', 2000)
  `;
  await sql`
    insert into bookings (id, workspace_id, customer_id, service_id, starts_at, ends_at) values
      (${RLS_IDS.bookingA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.customerA}, ${RLS_IDS.serviceA}, '2030-01-01T09:00:00Z', '2030-01-01T10:00:00Z'),
      (${RLS_IDS.bookingB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.customerB}, ${RLS_IDS.serviceB}, '2030-01-02T09:00:00Z', '2030-01-02T10:00:00Z')
  `;
  await sql`
    insert into payments (workspace_id, customer_id, booking_id, amount_cents) values
      (${RLS_IDS.workspaceA}, ${RLS_IDS.customerA}, ${RLS_IDS.bookingA}, 1000),
      (${RLS_IDS.workspaceB}, ${RLS_IDS.customerB}, ${RLS_IDS.bookingB}, 2000)
  `;

  await sql`
    insert into sites (id, workspace_id, name) values
      (${RLS_IDS.siteA}, ${RLS_IDS.workspaceA}, 'Site A'),
      (${RLS_IDS.siteB}, ${RLS_IDS.workspaceB}, 'Site B')
  `;
  await sql`
    insert into site_domains (site_id, workspace_id, hostname, type) values
      (${RLS_IDS.siteA}, ${RLS_IDS.workspaceA}, 'a.b3.local', 'custom'),
      (${RLS_IDS.siteB}, ${RLS_IDS.workspaceB}, 'b.b3.local', 'custom')
  `;
  await sql`
    insert into leads (workspace_id, site_id, form_key, name) values
      (${RLS_IDS.workspaceA}, ${RLS_IDS.siteA}, 'contact', 'Lead A'),
      (${RLS_IDS.workspaceB}, ${RLS_IDS.siteB}, 'contact', 'Lead B')
  `;
  await sql`
    with pipelines as (
      insert into crm_pipelines (workspace_id, name) values
        (${RLS_IDS.workspaceA}, 'Pipeline A'), (${RLS_IDS.workspaceB}, 'Pipeline B')
      returning id, workspace_id
    ), stages as (
      insert into crm_stages (workspace_id, pipeline_id, name)
      select workspace_id, id, 'Stage' from pipelines returning id, workspace_id, pipeline_id
    )
    insert into crm_opportunities (workspace_id, pipeline_id, stage_id, title)
    select workspace_id, pipeline_id, id, 'Opportunity' from stages
  `;

  await sql`
    insert into properties (id, workspace_id, name) values
      (${RLS_IDS.propertyA}, ${RLS_IDS.workspaceA}, 'Property A'),
      (${RLS_IDS.propertyB}, ${RLS_IDS.workspaceB}, 'Property B')
  `;
  await sql`
    insert into buildings (id, workspace_id, property_id, name) values
      (${RLS_IDS.buildingA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.propertyA}, 'Building A'),
      (${RLS_IDS.buildingB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.propertyB}, 'Building B')
  `;
  await sql`
    insert into rental_units (id, workspace_id, property_id, building_id, name) values
      (${RLS_IDS.unitA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.propertyA}, ${RLS_IDS.buildingA}, 'Unit A'),
      (${RLS_IDS.unitB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.propertyB}, ${RLS_IDS.buildingB}, 'Unit B')
  `;
  await sql`
    insert into reservations (id, workspace_id, unit_id, customer_id, check_in_date, check_out_date) values
      (${RLS_IDS.reservationA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.unitA}, ${RLS_IDS.customerA}, '2030-02-01', '2030-02-03'),
      (${RLS_IDS.reservationB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.unitB}, ${RLS_IDS.customerB}, '2030-02-04', '2030-02-06')
  `;
  await sql`
    insert into housekeeping_tasks (workspace_id, property_id, building_id, unit_id, reservation_id, task_type, title) values
      (${RLS_IDS.workspaceA}, ${RLS_IDS.propertyA}, ${RLS_IDS.buildingA}, ${RLS_IDS.unitA}, ${RLS_IDS.reservationA}, 'cleaning', 'Task A'),
      (${RLS_IDS.workspaceB}, ${RLS_IDS.propertyB}, ${RLS_IDS.buildingB}, ${RLS_IDS.unitB}, ${RLS_IDS.reservationB}, 'cleaning', 'Task B')
  `;
  await sql`
    insert into invoices (id, workspace_id, customer_id, number) values
      (${RLS_IDS.invoiceA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.customerA}, 'B3-A'),
      (${RLS_IDS.invoiceB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.customerB}, 'B3-B')
  `;

  await sql`
    insert into ai_conversations (id, workspace_id, user_id, title) values
      (${RLS_IDS.conversationA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.authUserA}, 'Conversation A'),
      (${RLS_IDS.conversationB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.authUserB}, 'Conversation B')
  `;
  await sql`
    insert into ai_messages (conversation_id, role, content) values
      (${RLS_IDS.conversationA}, 'user', 'Message A'),
      (${RLS_IDS.conversationB}, 'user', 'Message B')
  `;
}
