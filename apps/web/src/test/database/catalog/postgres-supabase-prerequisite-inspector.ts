import type { TestDatabaseClient } from "../test-database";
import type { PrerequisiteObservation } from "./supabase-prerequisite-check";

interface NamedRow {
  name: string;
}

interface FunctionRow {
  schema_name: string;
  function_name: string;
  return_type: string;
}

interface RoleRow {
  role_name: "anon" | "authenticated" | "service_role";
  bypass_rls: boolean;
}

interface ExtensionRow {
  available: boolean;
  installed: boolean;
  extension_schema: string | null;
}

/** Read-only prerequisite inspection for the repository-local Supabase stack. */
export async function inspectSupabasePrerequisites(
  client: TestDatabaseClient,
): Promise<PrerequisiteObservation[]> {
  const [schemas, authColumns, functions, roles, extensions] = await Promise.all([
    client<NamedRow[]>`
      select nspname as name from pg_namespace where nspname = 'auth'
    `,
    client<NamedRow[]>`
      select a.attname as name
      from pg_attribute a
      join pg_class c on c.oid = a.attrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'auth' and c.relname = 'users'
        and a.attnum > 0 and not a.attisdropped
      order by a.attname
    `,
    client<FunctionRow[]>`
      select n.nspname as schema_name, p.proname as function_name,
        pg_get_function_result(p.oid) as return_type
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where (n.nspname = 'auth' and p.proname = 'uid')
        or (n.nspname = 'pg_catalog' and p.proname = 'gen_random_uuid')
    `,
    client<RoleRow[]>`
      select rolname as role_name, rolbypassrls as bypass_rls
      from pg_roles where rolname in ('anon', 'authenticated', 'service_role')
    `,
    client<ExtensionRow[]>`
      select true as available, (a.installed_version is not null) as installed,
        n.nspname as extension_schema
      from pg_available_extensions a
      left join pg_extension e on e.extname = a.name
      left join pg_namespace n on n.oid = e.extnamespace
      where a.name = 'btree_gist'
    `,
  ]);

  const functionById = new Map(
    functions.map((fn) => [
      `${fn.schema_name}.${fn.function_name}()`,
      fn,
    ]),
  );
  const roleByName = new Map(roles.map((role) => [role.role_name, role]));
  const extension = extensions[0];

  return [
    { identifier: "auth", present: schemas.length === 1, attributes: {} },
    {
      identifier: "auth.users",
      present: authColumns.length > 0,
      attributes: { requiredColumns: authColumns.map((column) => column.name) },
    },
    {
      identifier: "auth.uid()",
      present: functionById.has("auth.uid()"),
      attributes: {
        returnType: functionById.get("auth.uid()")?.return_type ?? "",
      },
    },
    ...(["anon", "authenticated", "service_role"] as const).map(
      (identifier): PrerequisiteObservation => ({
        identifier,
        present: roleByName.has(identifier),
        attributes:
          identifier === "service_role"
            ? {
                expectedRlsBehavior: roleByName.get(identifier)?.bypass_rls
                  ? "bypass"
                  : "subject_to_rls",
              }
            : {},
      }),
    ),
    {
      identifier: "btree_gist",
      present: extension?.available ?? false,
      attributes: {
        available: extension?.available ?? false,
        installed: extension?.installed ?? false,
        extensionSchema: extension?.extension_schema ?? "",
      },
    },
    {
      identifier: "pg_catalog.gen_random_uuid()",
      present: functionById.has("pg_catalog.gen_random_uuid()"),
      attributes: {
        returnType:
          functionById.get("pg_catalog.gen_random_uuid()")?.return_type ?? "",
      },
    },
  ];
}
