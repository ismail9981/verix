-- B3.2: enforce same-workspace ownership for every tenant-to-tenant reference.
-- The preflight runs before any DDL and reports counts only; it never repairs data.
DO $$
DECLARE
  relationship record;
  missing_parent bigint;
  cross_workspace bigint;
  path_anomaly bigint;
BEGIN
  FOR relationship IN
    SELECT * FROM (VALUES
      ('bookings', 'customers', 'customer_id'),
      ('bookings', 'services', 'service_id'),
      ('bookings', 'team_members', 'staff_id'),
      ('buildings', 'properties', 'property_id'),
      ('crm_activities', 'crm_opportunities', 'opportunity_id'),
      ('crm_opportunities', 'customers', 'customer_id'),
      ('crm_opportunities', 'leads', 'lead_id'),
      ('crm_opportunities', 'crm_pipelines', 'pipeline_id'),
      ('crm_opportunities', 'crm_stages', 'stage_id'),
      ('crm_stages', 'crm_pipelines', 'pipeline_id'),
      ('housekeeping_tasks', 'team_members', 'assigned_to'),
      ('housekeeping_tasks', 'buildings', 'building_id'),
      ('housekeeping_tasks', 'team_members', 'completed_by'),
      ('housekeeping_tasks', 'team_members', 'created_by'),
      ('housekeeping_tasks', 'properties', 'property_id'),
      ('housekeeping_tasks', 'reservations', 'reservation_id'),
      ('housekeeping_tasks', 'rental_units', 'unit_id'),
      ('invoice_line_items', 'invoices', 'invoice_id'),
      ('invoices', 'customers', 'customer_id'),
      ('invoices', 'reservations', 'reservation_id'),
      ('invoices', 'team_members', 'voided_by'),
      ('invoices', 'team_members', 'written_off_by'),
      ('leads', 'customers', 'converted_customer_id'),
      ('leads', 'sites', 'site_id'),
      ('page_sections', 'pages', 'page_id'),
      ('page_sections', 'sites', 'site_id'),
      ('pages', 'sites', 'site_id'),
      ('payments', 'team_members', 'actor_team_member_id'),
      ('payments', 'bookings', 'booking_id'),
      ('payments', 'customers', 'customer_id'),
      ('payments', 'invoices', 'invoice_id'),
      ('payments', 'payments', 'refunded_payment_id'),
      ('rental_units', 'buildings', 'building_id'),
      ('rental_units', 'properties', 'property_id'),
      ('reservations', 'customers', 'customer_id'),
      ('reservations', 'team_members', 'staff_id'),
      ('reservations', 'rental_units', 'unit_id'),
      ('site_domains', 'sites', 'site_id'),
      ('site_versions', 'sites', 'site_id'),
      ('sites', 'site_versions', 'published_version_id')
    ) AS relationships(child_table, parent_table, foreign_column)
  LOOP
    EXECUTE format(
      'select count(*) from %I child left join %I parent on parent.id = child.%I where child.%I is not null and parent.id is null',
      relationship.child_table, relationship.parent_table,
      relationship.foreign_column, relationship.foreign_column
    ) INTO missing_parent;
    EXECUTE format(
      'select count(*) from %I child join %I parent on parent.id = child.%I where child.%I is not null and child.workspace_id is distinct from parent.workspace_id',
      relationship.child_table, relationship.parent_table,
      relationship.foreign_column, relationship.foreign_column
    ) INTO cross_workspace;
    IF missing_parent <> 0 OR cross_workspace <> 0 THEN
      RAISE EXCEPTION
        'workspace relationship preflight failed for %.% -> %: missing_parent=%, cross_workspace=%',
        relationship.child_table, relationship.foreign_column,
        relationship.parent_table, missing_parent, cross_workspace;
    END IF;
  END LOOP;

  SELECT count(*) INTO path_anomaly FROM crm_opportunities child join crm_stages parent on parent.id = child.stage_id where parent.pipeline_id is distinct from child.pipeline_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for crm_opportunities.stage_id->crm_stages.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM housekeeping_tasks child join rental_units unit_parent on unit_parent.id = child.unit_id where child.building_id is distinct from unit_parent.building_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for housekeeping_tasks.building_id->buildings.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM housekeeping_tasks child join rental_units unit_parent on unit_parent.id = child.unit_id where child.property_id is distinct from unit_parent.property_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for housekeeping_tasks.property_id->properties.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM housekeeping_tasks child join reservations parent on parent.id = child.reservation_id where child.reservation_id is not null and parent.unit_id is distinct from child.unit_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for housekeeping_tasks.reservation_id->reservations.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM page_sections child join pages parent on parent.id = child.page_id where child.site_id is distinct from parent.site_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for page_sections.page_id->pages.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM rental_units child join buildings parent on parent.id = child.building_id where child.property_id is distinct from parent.property_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for rental_units.building_id->buildings.id: count=%', path_anomaly;
  END IF;

  SELECT count(*) INTO path_anomaly FROM sites child join site_versions parent on parent.id = child.published_version_id where child.published_version_id is not null and child.id is distinct from parent.site_id;
  IF path_anomaly <> 0 THEN
    RAISE EXCEPTION 'workspace relationship ownership-path preflight failed for sites.published_version_id->site_versions.id: count=%', path_anomaly;
  END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "crm_pipelines" ADD CONSTRAINT "crm_pipelines_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_workspace_id_id_uq" UNIQUE("workspace_id","id");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_workspace_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_workspace_fk" FOREIGN KEY ("workspace_id","service_id") REFERENCES "public"."services"("workspace_id","id") ON DELETE no action ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_workspace_fk" FOREIGN KEY ("workspace_id","staff_id") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("staff_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_property_workspace_fk" FOREIGN KEY ("workspace_id","property_id") REFERENCES "public"."properties"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunity_workspace_fk" FOREIGN KEY ("workspace_id","opportunity_id") REFERENCES "public"."crm_opportunities"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_customer_workspace_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE set null ("customer_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_lead_workspace_fk" FOREIGN KEY ("workspace_id","lead_id") REFERENCES "public"."leads"("workspace_id","id") ON DELETE set null ("lead_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_pipeline_workspace_fk" FOREIGN KEY ("workspace_id","pipeline_id") REFERENCES "public"."crm_pipelines"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_stage_workspace_fk" FOREIGN KEY ("workspace_id","stage_id") REFERENCES "public"."crm_stages"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "crm_stages" ADD CONSTRAINT "crm_stages_pipeline_workspace_fk" FOREIGN KEY ("workspace_id","pipeline_id") REFERENCES "public"."crm_pipelines"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_assigned_to_workspace_fk" FOREIGN KEY ("workspace_id","assigned_to") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("assigned_to") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_building_workspace_fk" FOREIGN KEY ("workspace_id","building_id") REFERENCES "public"."buildings"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_completed_by_workspace_fk" FOREIGN KEY ("workspace_id","completed_by") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("completed_by") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_created_by_workspace_fk" FOREIGN KEY ("workspace_id","created_by") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("created_by") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_property_workspace_fk" FOREIGN KEY ("workspace_id","property_id") REFERENCES "public"."properties"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_reservation_workspace_fk" FOREIGN KEY ("workspace_id","reservation_id") REFERENCES "public"."reservations"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" ADD CONSTRAINT "housekeeping_unit_workspace_fk" FOREIGN KEY ("workspace_id","unit_id") REFERENCES "public"."rental_units"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_workspace_fk" FOREIGN KEY ("workspace_id","invoice_id") REFERENCES "public"."invoices"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_workspace_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE set null ("customer_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_reservation_workspace_fk" FOREIGN KEY ("workspace_id","reservation_id") REFERENCES "public"."reservations"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_workspace_fk" FOREIGN KEY ("workspace_id","voided_by") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("voided_by") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_written_off_by_workspace_fk" FOREIGN KEY ("workspace_id","written_off_by") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("written_off_by") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_converted_customer_workspace_fk" FOREIGN KEY ("workspace_id","converted_customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE set null ("converted_customer_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_site_workspace_fk" FOREIGN KEY ("workspace_id","site_id") REFERENCES "public"."sites"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_page_workspace_fk" FOREIGN KEY ("workspace_id","page_id") REFERENCES "public"."pages"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "page_sections" ADD CONSTRAINT "page_sections_site_workspace_fk" FOREIGN KEY ("workspace_id","site_id") REFERENCES "public"."sites"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_workspace_fk" FOREIGN KEY ("workspace_id","site_id") REFERENCES "public"."sites"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_actor_member_workspace_fk" FOREIGN KEY ("workspace_id","actor_team_member_id") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("actor_team_member_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_workspace_fk" FOREIGN KEY ("workspace_id","booking_id") REFERENCES "public"."bookings"("workspace_id","id") ON DELETE set null ("booking_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_workspace_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE set null ("customer_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_workspace_fk" FOREIGN KEY ("workspace_id","invoice_id") REFERENCES "public"."invoices"("workspace_id","id") ON DELETE set null ("invoice_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_refunded_payment_workspace_fk" FOREIGN KEY ("workspace_id","refunded_payment_id") REFERENCES "public"."payments"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_building_workspace_fk" FOREIGN KEY ("workspace_id","building_id") REFERENCES "public"."buildings"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "rental_units" ADD CONSTRAINT "rental_units_property_workspace_fk" FOREIGN KEY ("workspace_id","property_id") REFERENCES "public"."properties"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_workspace_fk" FOREIGN KEY ("workspace_id","customer_id") REFERENCES "public"."customers"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_staff_workspace_fk" FOREIGN KEY ("workspace_id","staff_id") REFERENCES "public"."team_members"("workspace_id","id") ON DELETE set null ("staff_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_unit_workspace_fk" FOREIGN KEY ("workspace_id","unit_id") REFERENCES "public"."rental_units"("workspace_id","id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_workspace_fk" FOREIGN KEY ("workspace_id","site_id") REFERENCES "public"."sites"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "site_versions" ADD CONSTRAINT "site_versions_site_workspace_fk" FOREIGN KEY ("workspace_id","site_id") REFERENCES "public"."sites"("workspace_id","id") ON DELETE cascade ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_published_version_workspace_fk" FOREIGN KEY ("workspace_id","published_version_id") REFERENCES "public"."site_versions"("workspace_id","id") ON DELETE set null ("published_version_id") ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_service_workspace_fk";--> statement-breakpoint
ALTER TABLE "bookings" VALIDATE CONSTRAINT "bookings_staff_workspace_fk";--> statement-breakpoint
ALTER TABLE "buildings" VALIDATE CONSTRAINT "buildings_property_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_activities" VALIDATE CONSTRAINT "crm_activities_opportunity_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_opportunities" VALIDATE CONSTRAINT "crm_opportunities_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_opportunities" VALIDATE CONSTRAINT "crm_opportunities_lead_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_opportunities" VALIDATE CONSTRAINT "crm_opportunities_pipeline_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_opportunities" VALIDATE CONSTRAINT "crm_opportunities_stage_workspace_fk";--> statement-breakpoint
ALTER TABLE "crm_stages" VALIDATE CONSTRAINT "crm_stages_pipeline_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_assigned_to_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_building_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_completed_by_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_created_by_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_property_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_reservation_workspace_fk";--> statement-breakpoint
ALTER TABLE "housekeeping_tasks" VALIDATE CONSTRAINT "housekeeping_unit_workspace_fk";--> statement-breakpoint
ALTER TABLE "invoice_line_items" VALIDATE CONSTRAINT "invoice_line_items_invoice_workspace_fk";--> statement-breakpoint
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_reservation_workspace_fk";--> statement-breakpoint
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_voided_by_workspace_fk";--> statement-breakpoint
ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_written_off_by_workspace_fk";--> statement-breakpoint
ALTER TABLE "leads" VALIDATE CONSTRAINT "leads_converted_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "leads" VALIDATE CONSTRAINT "leads_site_workspace_fk";--> statement-breakpoint
ALTER TABLE "page_sections" VALIDATE CONSTRAINT "page_sections_page_workspace_fk";--> statement-breakpoint
ALTER TABLE "page_sections" VALIDATE CONSTRAINT "page_sections_site_workspace_fk";--> statement-breakpoint
ALTER TABLE "pages" VALIDATE CONSTRAINT "pages_site_workspace_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_actor_member_workspace_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_booking_workspace_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_invoice_workspace_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_refunded_payment_workspace_fk";--> statement-breakpoint
ALTER TABLE "rental_units" VALIDATE CONSTRAINT "rental_units_building_workspace_fk";--> statement-breakpoint
ALTER TABLE "rental_units" VALIDATE CONSTRAINT "rental_units_property_workspace_fk";--> statement-breakpoint
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_customer_workspace_fk";--> statement-breakpoint
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_staff_workspace_fk";--> statement-breakpoint
ALTER TABLE "reservations" VALIDATE CONSTRAINT "reservations_unit_workspace_fk";--> statement-breakpoint
ALTER TABLE "site_domains" VALIDATE CONSTRAINT "site_domains_site_workspace_fk";--> statement-breakpoint
ALTER TABLE "site_versions" VALIDATE CONSTRAINT "site_versions_site_workspace_fk";--> statement-breakpoint
ALTER TABLE "sites" VALIDATE CONSTRAINT "sites_published_version_workspace_fk";--> statement-breakpoint
