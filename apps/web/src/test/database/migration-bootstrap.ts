import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertSafeTestDatabase,
  withTestDatabase,
  type SafeTestDatabaseConfig,
  type TestDatabaseClient,
  type TestDatabaseEnvironment,
} from "./test-database";

export interface MigrationInventory {
  readonly sqlFiles: readonly string[];
  readonly journalTags: readonly string[];
  readonly unjournaledSqlFiles: readonly string[];
  readonly snapshotFiles: readonly string[];
}

export interface MigrationCommandResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface DisposableRoleSnapshot {
  readonly roleName: string;
  readonly superuser: boolean;
  readonly bypassRls: boolean;
  readonly canCreateDatabase: boolean;
  readonly canCreateRole: boolean;
  readonly databaseCreatePrivilege: boolean;
}

export interface CatalogSnapshot {
  readonly tables: readonly string[];
  readonly enums: readonly string[];
  readonly foreignKeys: readonly string[];
  readonly indexes: readonly string[];
  readonly uniqueConstraints: readonly string[];
  readonly rlsEnabledTables: readonly string[];
  readonly policies: readonly string[];
  readonly functions: readonly string[];
  readonly applicationRoleGrants: readonly string[];
  readonly drizzleMigrationCount: number;
}

export interface MigrationBootstrapAudit {
  readonly target: {
    readonly host: string;
    readonly port: string;
    readonly database: string;
  };
  readonly command: "npm run db:migrate";
  readonly inventory: MigrationInventory;
  readonly role: DisposableRoleSnapshot;
  readonly baseline: CatalogSnapshot;
  readonly migrationResult: MigrationCommandResult;
  readonly result: CatalogSnapshot;
}

export type MigrationCommandRunner = (options: {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}) => Promise<MigrationCommandResult>;

interface JournalFile {
  entries?: Array<{ tag?: unknown }>;
}

function migrationTag(filename: string): string {
  return filename.replace(/\.sql$/, "");
}

/** Reads committed migration metadata without changing it. */
export async function readMigrationInventory(
  appDirectory: string,
): Promise<MigrationInventory> {
  const drizzleDirectory = resolve(appDirectory, "drizzle");
  const metaDirectory = resolve(drizzleDirectory, "meta");
  const [drizzleEntries, metaEntries, journalText] = await Promise.all([
    readdir(drizzleDirectory),
    readdir(metaDirectory),
    readFile(resolve(metaDirectory, "_journal.json"), "utf8"),
  ]);

  const journal = JSON.parse(journalText) as JournalFile;
  const sqlFiles = drizzleEntries.filter((name) => name.endsWith(".sql")).sort();
  const journalTags = (journal.entries ?? [])
    .map((entry) => entry.tag)
    .filter((tag): tag is string => typeof tag === "string");
  const journalTagSet = new Set(journalTags);

  return {
    sqlFiles,
    journalTags,
    unjournaledSqlFiles: sqlFiles.filter(
      (filename) => !journalTagSet.has(migrationTag(filename)),
    ),
    snapshotFiles: metaEntries
      .filter((name) => name.endsWith("_snapshot.json"))
      .sort(),
  };
}

/** Removes connection strings and credential components from child output. */
export function sanitizeMigrationOutput(
  output: string,
  config: SafeTestDatabaseConfig,
): string {
  const parsed = new URL(config.connectionString);
  const sensitiveValues = [
    config.connectionString,
    parsed.username,
    parsed.password,
  ].filter((value) => value.length > 0);

  let sanitized = output;
  for (const value of sensitiveValues) {
    sanitized = sanitized.replaceAll(value, "[REDACTED]");
  }

  return sanitized.replace(
    /postgres(?:ql)?:\/\/[^\s"']+/gi,
    "[REDACTED_POSTGRES_URL]",
  );
}

async function defaultMigrationCommandRunner({
  cwd,
  env,
}: {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<MigrationCommandResult> {
  return new Promise((resolveResult, reject) => {
    const child = spawn("npm", ["run", "db:migrate"], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (exitCode, signal) => {
      resolveResult({ exitCode, signal, stdout, stderr });
    });
  });
}

/**
 * Runs the existing canonical web migration command after B1 validation.
 * Drizzle Kit currently accepts only DATABASE_URL, so the child receives the
 * already-approved TEST_DATABASE_URL under that name. No fallback is read.
 */
export async function runCanonicalMigrationCommand(
  appDirectory: string,
  source: TestDatabaseEnvironment = process.env,
  runner: MigrationCommandRunner = defaultMigrationCommandRunner,
): Promise<MigrationCommandResult> {
  const config = assertSafeTestDatabase(source);
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: config.connectionString,
    SUPABASE_URL: "https://b2.invalid",
    SUPABASE_ANON_KEY: "b2-test-placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "b2-test-placeholder",
  };

  const result = await runner({ cwd: appDirectory, env: childEnv });
  return {
    ...result,
    stdout: sanitizeMigrationOutput(result.stdout, config),
    stderr: sanitizeMigrationOutput(result.stderr, config),
  };
}

async function inspectRole(
  client: TestDatabaseClient,
): Promise<DisposableRoleSnapshot> {
  const [role] = await client<
    Array<{
      role_name: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      database_create_privilege: boolean;
    }>
  >`
    select
      current_user as role_name,
      rolsuper,
      rolbypassrls,
      rolcreatedb,
      rolcreaterole,
      has_database_privilege(current_user, current_database(), 'CREATE')
        as database_create_privilege
    from pg_roles
    where rolname = current_user
  `;

  if (!role) throw new Error("Disposable database role could not be inspected.");
  return {
    roleName: role.role_name,
    superuser: role.rolsuper,
    bypassRls: role.rolbypassrls,
    canCreateDatabase: role.rolcreatedb,
    canCreateRole: role.rolcreaterole,
    databaseCreatePrivilege: role.database_create_privilege,
  };
}

async function inspectCatalog(
  client: TestDatabaseClient,
): Promise<CatalogSnapshot> {
  const [
    tables,
    enums,
    foreignKeys,
    indexes,
    uniqueConstraints,
    rlsTables,
    policies,
    functions,
    grants,
    migrationRelation,
  ] = await Promise.all([
    client<Array<{ name: string }>>`
      select tablename as name from pg_tables
      where schemaname = 'public' order by tablename
    `,
    client<Array<{ name: string }>>`
      select t.typname as name from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typtype = 'e' order by t.typname
    `,
    client<Array<{ name: string }>>`
      select conrelid::regclass::text || '.' || conname as name
      from pg_constraint
      where contype = 'f' and connamespace = 'public'::regnamespace
      order by name
    `,
    client<Array<{ name: string }>>`
      select tablename || '.' || indexname as name from pg_indexes
      where schemaname = 'public' order by tablename, indexname
    `,
    client<Array<{ name: string }>>`
      select conrelid::regclass::text || '.' || conname as name
      from pg_constraint
      where contype = 'u' and connamespace = 'public'::regnamespace
      order by name
    `,
    client<Array<{ name: string }>>`
      select relname as name from pg_class
      where relnamespace = 'public'::regnamespace and relrowsecurity
      order by relname
    `,
    client<Array<{ name: string }>>`
      select tablename || '.' || policyname as name from pg_policies
      where schemaname = 'public' order by tablename, policyname
    `,
    client<Array<{ name: string }>>`
      select p.proname as name from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' order by p.proname
    `,
    client<Array<{ name: string }>>`
      select grantee || ':' || table_name || ':' || privilege_type as name
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('authenticated', 'anon')
      order by grantee, table_name, privilege_type
    `,
    client<Array<{ relation_name: string | null }>>`
      select to_regclass('drizzle.__drizzle_migrations')::text as relation_name
    `,
  ]);

  let drizzleMigrationCount = 0;
  if (migrationRelation[0]?.relation_name) {
    const [count] = await client<Array<{ count: number }>>`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `;
    drizzleMigrationCount = count?.count ?? 0;
  }

  return {
    tables: tables.map(({ name }) => name),
    enums: enums.map(({ name }) => name),
    foreignKeys: foreignKeys.map(({ name }) => name),
    indexes: indexes.map(({ name }) => name),
    uniqueConstraints: uniqueConstraints.map(({ name }) => name),
    rlsEnabledTables: rlsTables.map(({ name }) => name),
    policies: policies.map(({ name }) => name),
    functions: functions.map(({ name }) => name),
    applicationRoleGrants: grants.map(({ name }) => name),
    drizzleMigrationCount,
  };
}

/** Runs a non-repairing fresh-database audit and returns redacted evidence. */
export async function runMigrationBootstrapAudit(
  appDirectory: string,
  source: TestDatabaseEnvironment = process.env,
  runner: MigrationCommandRunner = defaultMigrationCommandRunner,
): Promise<MigrationBootstrapAudit> {
  const config = assertSafeTestDatabase(source);
  const inventory = await readMigrationInventory(appDirectory);
  const before = await withTestDatabase(async (client) => {
    const [role, baseline] = await Promise.all([
      inspectRole(client),
      inspectCatalog(client),
    ]);
    return { role, baseline };
  }, source);

  if (
    before.baseline.tables.length > 0 ||
    before.baseline.drizzleMigrationCount > 0
  ) {
    throw new Error(
      "Bootstrap audit requires a clean disposable database with no Verix tables.",
    );
  }

  const migrationResult = await runCanonicalMigrationCommand(
    appDirectory,
    source,
    runner,
  );
  const result = await withTestDatabase(inspectCatalog, source);

  return {
    target: {
      host: config.host,
      port: config.port,
      database: config.database,
    },
    command: "npm run db:migrate",
    inventory,
    role: before.role,
    baseline: before.baseline,
    migrationResult,
    result,
  };
}
