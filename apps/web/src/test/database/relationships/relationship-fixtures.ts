import { RLS_IDS, seedRlsFixtures } from "../rls/rls-fixtures";
import type { RlsTransaction } from "../rls/rls-harness";
import { WORKSPACE_RELATIONSHIPS } from "./relationship-inventory";

interface RelationshipFixture {
  readonly childId: string;
  readonly parentAId: string;
  readonly parentBId: string;
}

export type RelationshipFixtureMap = Readonly<
  Record<string, RelationshipFixture>
>;

const IDS = {
  pageA: "40000000-0000-4000-8000-000000000001",
  pageB: "40000000-0000-4000-8000-000000000002",
  sectionA: "41000000-0000-4000-8000-000000000001",
  sectionB: "41000000-0000-4000-8000-000000000002",
  versionA: "42000000-0000-4000-8000-000000000001",
  versionB: "42000000-0000-4000-8000-000000000002",
  activityA: "43000000-0000-4000-8000-000000000001",
  activityB: "43000000-0000-4000-8000-000000000002",
  lineA: "44000000-0000-4000-8000-000000000001",
  lineB: "44000000-0000-4000-8000-000000000002",
  chargeA: "45000000-0000-4000-8000-000000000001",
  chargeB: "45000000-0000-4000-8000-000000000002",
  refundA: "46000000-0000-4000-8000-000000000001",
  refundB: "46000000-0000-4000-8000-000000000002",
} as const;

async function idByWorkspace(
  sql: RlsTransaction,
  table: string,
  workspaceId: string,
): Promise<string> {
  if (!/^[a-z][a-z0-9_]*$/.test(table)) {
    throw new Error("Unsafe relationship fixture table identifier.");
  }
  const [row] = await sql.unsafe<Array<{ id: string }>>(
    `select id::text from "${table}" where workspace_id = $1 order by id limit 1`,
    [workspaceId],
  );
  if (!row) throw new Error(`Missing relationship fixture for ${table}.`);
  return row.id;
}

/** Seeds one valid same-workspace edge for every relationship in B3.2. */
export async function seedRelationshipFixtures(
  sql: RlsTransaction,
): Promise<RelationshipFixtureMap> {
  await seedRlsFixtures(sql);

  await sql`
    update bookings set staff_id = case workspace_id
      when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid
      else ${RLS_IDS.teamMemberB}::uuid end
  `;
  await sql`
    insert into pages (id, site_id, workspace_id, path, title) values
      (${IDS.pageA}, ${RLS_IDS.siteA}, ${RLS_IDS.workspaceA}, '/b32-a', 'Page A'),
      (${IDS.pageB}, ${RLS_IDS.siteB}, ${RLS_IDS.workspaceB}, '/b32-b', 'Page B')
  `;
  await sql`
    insert into page_sections (id, page_id, site_id, workspace_id, type_key) values
      (${IDS.sectionA}, ${IDS.pageA}, ${RLS_IDS.siteA}, ${RLS_IDS.workspaceA}, 'hero'),
      (${IDS.sectionB}, ${IDS.pageB}, ${RLS_IDS.siteB}, ${RLS_IDS.workspaceB}, 'hero')
  `;
  await sql`
    insert into site_versions (id, site_id, workspace_id, version_number, snapshot) values
      (${IDS.versionA}, ${RLS_IDS.siteA}, ${RLS_IDS.workspaceA}, 1, '{}'::jsonb),
      (${IDS.versionB}, ${RLS_IDS.siteB}, ${RLS_IDS.workspaceB}, 1, '{}'::jsonb)
  `;
  await sql`
    update sites set published_version_id = case id
      when ${RLS_IDS.siteA} then ${IDS.versionA}::uuid
      else ${IDS.versionB}::uuid end
    where id in (${RLS_IDS.siteA}, ${RLS_IDS.siteB})
  `;

  const [
    leadA,
    leadB,
    pipelineA,
    pipelineB,
    stageA,
    stageB,
    opportunityA,
    opportunityB,
  ] = await Promise.all([
    idByWorkspace(sql, "leads", RLS_IDS.workspaceA),
    idByWorkspace(sql, "leads", RLS_IDS.workspaceB),
    idByWorkspace(sql, "crm_pipelines", RLS_IDS.workspaceA),
    idByWorkspace(sql, "crm_pipelines", RLS_IDS.workspaceB),
    idByWorkspace(sql, "crm_stages", RLS_IDS.workspaceA),
    idByWorkspace(sql, "crm_stages", RLS_IDS.workspaceB),
    idByWorkspace(sql, "crm_opportunities", RLS_IDS.workspaceA),
    idByWorkspace(sql, "crm_opportunities", RLS_IDS.workspaceB),
  ]);
  await sql`
    update leads set converted_customer_id = case workspace_id
      when ${RLS_IDS.workspaceA} then ${RLS_IDS.customerA}::uuid
      else ${RLS_IDS.customerB}::uuid end
  `;
  await sql`
    update crm_opportunities set
      customer_id = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.customerA}::uuid else ${RLS_IDS.customerB}::uuid end,
      lead_id = case workspace_id when ${RLS_IDS.workspaceA} then ${leadA}::uuid else ${leadB}::uuid end
  `;
  await sql`
    insert into crm_activities (id, workspace_id, opportunity_id, title) values
      (${IDS.activityA}, ${RLS_IDS.workspaceA}, ${opportunityA}, 'Activity A'),
      (${IDS.activityB}, ${RLS_IDS.workspaceB}, ${opportunityB}, 'Activity B')
  `;

  await sql`
    update reservations set staff_id = case workspace_id
      when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid
      else ${RLS_IDS.teamMemberB}::uuid end
  `;
  await sql`
    update housekeeping_tasks set
      assigned_to = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid else ${RLS_IDS.teamMemberB}::uuid end,
      completed_by = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid else ${RLS_IDS.teamMemberB}::uuid end,
      created_by = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid else ${RLS_IDS.teamMemberB}::uuid end
  `;
  await sql`
    update invoices set
      reservation_id = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.reservationA}::uuid else ${RLS_IDS.reservationB}::uuid end,
      voided_by = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid else ${RLS_IDS.teamMemberB}::uuid end,
      written_off_by = case workspace_id when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid else ${RLS_IDS.teamMemberB}::uuid end
  `;
  await sql`
    insert into invoice_line_items
      (id, workspace_id, invoice_id, type, description, unit_amount_cents, amount_cents)
    values
      (${IDS.lineA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.invoiceA}, 'stay', 'Line A', 100, 100),
      (${IDS.lineB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.invoiceB}, 'stay', 'Line B', 100, 100)
  `;
  await sql`
    update invoices set status = 'open', issued_at = now()
    where id in (${RLS_IDS.invoiceA}, ${RLS_IDS.invoiceB})
  `;
  await sql`
    update payments set actor_team_member_id = case workspace_id
      when ${RLS_IDS.workspaceA} then ${RLS_IDS.teamMemberA}::uuid
      else ${RLS_IDS.teamMemberB}::uuid end
    where booking_id is not null
  `;
  await sql`
    insert into payments
      (id, workspace_id, customer_id, invoice_id, amount_cents, status, type, actor_team_member_id)
    values
      (${IDS.chargeA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.customerA}, ${RLS_IDS.invoiceA}, 50, 'paid', 'charge', ${RLS_IDS.teamMemberA}),
      (${IDS.chargeB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.customerB}, ${RLS_IDS.invoiceB}, 50, 'paid', 'charge', ${RLS_IDS.teamMemberB})
  `;
  await sql`
    insert into payments
      (id, workspace_id, customer_id, invoice_id, amount_cents, status, type, refunded_payment_id, actor_team_member_id)
    values
      (${IDS.refundA}, ${RLS_IDS.workspaceA}, ${RLS_IDS.customerA}, ${RLS_IDS.invoiceA}, 10, 'paid', 'refund', ${IDS.chargeA}, ${RLS_IDS.teamMemberA}),
      (${IDS.refundB}, ${RLS_IDS.workspaceB}, ${RLS_IDS.customerB}, ${RLS_IDS.invoiceB}, 10, 'paid', 'refund', ${IDS.chargeB}, ${RLS_IDS.teamMemberB})
  `;

  const [domainA, housekeepingA] = await Promise.all([
    idByWorkspace(sql, "site_domains", RLS_IDS.workspaceA),
    idByWorkspace(sql, "housekeeping_tasks", RLS_IDS.workspaceA),
  ]);
  const [bookingPayment] = await sql<Array<{ id: string }>>`
    select id::text from payments
    where workspace_id = ${RLS_IDS.workspaceA} and booking_id is not null
    limit 1
  `;
  if (!bookingPayment) throw new Error("Missing booking payment fixture.");
  const bookingPaymentA = bookingPayment.id;

  const byKey: Record<string, RelationshipFixture> = {};
  const add = (
    key: string,
    childId: string,
    parentAId: string,
    parentBId: string,
  ) => {
    byKey[key] = { childId, parentAId, parentBId };
  };
  add(
    "bookings.customer_id->customers.id",
    RLS_IDS.bookingA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add(
    "bookings.service_id->services.id",
    RLS_IDS.bookingA,
    RLS_IDS.serviceA,
    RLS_IDS.serviceB,
  );
  add(
    "bookings.staff_id->team_members.id",
    RLS_IDS.bookingA,
    RLS_IDS.teamMemberA,
    RLS_IDS.teamMemberB,
  );
  add(
    "buildings.property_id->properties.id",
    RLS_IDS.buildingA,
    RLS_IDS.propertyA,
    RLS_IDS.propertyB,
  );
  add(
    "crm_activities.opportunity_id->crm_opportunities.id",
    IDS.activityA,
    opportunityA,
    opportunityB,
  );
  add(
    "crm_opportunities.customer_id->customers.id",
    opportunityA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add("crm_opportunities.lead_id->leads.id", opportunityA, leadA, leadB);
  add(
    "crm_opportunities.pipeline_id->crm_pipelines.id",
    opportunityA,
    pipelineA,
    pipelineB,
  );
  add(
    "crm_opportunities.stage_id->crm_stages.id",
    opportunityA,
    stageA,
    stageB,
  );
  add("crm_stages.pipeline_id->crm_pipelines.id", stageA, pipelineA, pipelineB);
  for (const column of ["assigned_to", "completed_by", "created_by"])
    add(
      `housekeeping_tasks.${column}->team_members.id`,
      housekeepingA,
      RLS_IDS.teamMemberA,
      RLS_IDS.teamMemberB,
    );
  add(
    "housekeeping_tasks.building_id->buildings.id",
    housekeepingA,
    RLS_IDS.buildingA,
    RLS_IDS.buildingB,
  );
  add(
    "housekeeping_tasks.property_id->properties.id",
    housekeepingA,
    RLS_IDS.propertyA,
    RLS_IDS.propertyB,
  );
  add(
    "housekeeping_tasks.reservation_id->reservations.id",
    housekeepingA,
    RLS_IDS.reservationA,
    RLS_IDS.reservationB,
  );
  add(
    "housekeeping_tasks.unit_id->rental_units.id",
    housekeepingA,
    RLS_IDS.unitA,
    RLS_IDS.unitB,
  );
  add(
    "invoice_line_items.invoice_id->invoices.id",
    IDS.lineA,
    RLS_IDS.invoiceA,
    RLS_IDS.invoiceB,
  );
  add(
    "invoices.customer_id->customers.id",
    RLS_IDS.invoiceA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add(
    "invoices.reservation_id->reservations.id",
    RLS_IDS.invoiceA,
    RLS_IDS.reservationA,
    RLS_IDS.reservationB,
  );
  add(
    "invoices.voided_by->team_members.id",
    RLS_IDS.invoiceA,
    RLS_IDS.teamMemberA,
    RLS_IDS.teamMemberB,
  );
  add(
    "invoices.written_off_by->team_members.id",
    RLS_IDS.invoiceA,
    RLS_IDS.teamMemberA,
    RLS_IDS.teamMemberB,
  );
  add(
    "leads.converted_customer_id->customers.id",
    leadA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add("leads.site_id->sites.id", leadA, RLS_IDS.siteA, RLS_IDS.siteB);
  add("page_sections.page_id->pages.id", IDS.sectionA, IDS.pageA, IDS.pageB);
  add(
    "page_sections.site_id->sites.id",
    IDS.sectionA,
    RLS_IDS.siteA,
    RLS_IDS.siteB,
  );
  add("pages.site_id->sites.id", IDS.pageA, RLS_IDS.siteA, RLS_IDS.siteB);
  add(
    "payments.actor_team_member_id->team_members.id",
    IDS.chargeA,
    RLS_IDS.teamMemberA,
    RLS_IDS.teamMemberB,
  );
  add(
    "payments.booking_id->bookings.id",
    bookingPaymentA,
    RLS_IDS.bookingA,
    RLS_IDS.bookingB,
  );
  add(
    "payments.customer_id->customers.id",
    bookingPaymentA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add(
    "payments.invoice_id->invoices.id",
    IDS.chargeA,
    RLS_IDS.invoiceA,
    RLS_IDS.invoiceB,
  );
  add(
    "payments.refunded_payment_id->payments.id",
    IDS.refundA,
    IDS.chargeA,
    IDS.chargeB,
  );
  add(
    "rental_units.building_id->buildings.id",
    RLS_IDS.unitA,
    RLS_IDS.buildingA,
    RLS_IDS.buildingB,
  );
  add(
    "rental_units.property_id->properties.id",
    RLS_IDS.unitA,
    RLS_IDS.propertyA,
    RLS_IDS.propertyB,
  );
  add(
    "reservations.customer_id->customers.id",
    RLS_IDS.reservationA,
    RLS_IDS.customerA,
    RLS_IDS.customerB,
  );
  add(
    "reservations.staff_id->team_members.id",
    RLS_IDS.reservationA,
    RLS_IDS.teamMemberA,
    RLS_IDS.teamMemberB,
  );
  add(
    "reservations.unit_id->rental_units.id",
    RLS_IDS.reservationA,
    RLS_IDS.unitA,
    RLS_IDS.unitB,
  );
  add("site_domains.site_id->sites.id", domainA, RLS_IDS.siteA, RLS_IDS.siteB);
  add(
    "site_versions.site_id->sites.id",
    IDS.versionA,
    RLS_IDS.siteA,
    RLS_IDS.siteB,
  );
  add(
    "sites.published_version_id->site_versions.id",
    RLS_IDS.siteA,
    IDS.versionA,
    IDS.versionB,
  );

  if (WORKSPACE_RELATIONSHIPS.some(({ key }) => !byKey[key])) {
    throw new Error(
      "Relationship fixture map does not cover the B3.2 inventory.",
    );
  }
  return byKey;
}
