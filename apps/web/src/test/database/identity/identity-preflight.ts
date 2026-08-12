import type { TestDatabaseClient } from "../test-database";

export type IdentityLinkageClassification =
  | "EXACT_MATCH"
  | "NO_AUTH_MATCH"
  | "AMBIGUOUS_MATCH"
  | "ALREADY_LINKED"
  | "CONFLICT";

export interface IdentityLinkagePreflight {
  readonly totalInternalUsers: number;
  readonly counts: Readonly<Record<IdentityLinkageClassification, number>>;
  readonly unresolvedCount: number;
  readonly conflictCount: number;
  readonly safeForMigration: boolean;
}

interface ClassificationRow {
  classification: IdentityLinkageClassification;
  count: number;
}

/** Read-only, aggregate-only linkage audit. It never returns email or row IDs. */
export async function runIdentityLinkagePreflight(
  client: TestDatabaseClient,
): Promise<IdentityLinkagePreflight> {
  const rows = await client<ClassificationRow[]>`
    with internal_counts as (
      select lower(btrim(email)) as normalized_email, count(*)::integer as match_count
      from public.users
      where deleted_at is null
      group by lower(btrim(email))
    ),
    auth_counts as (
      select lower(btrim(email)) as normalized_email, count(*)::integer as match_count
      from auth.users
      where email is not null and email_confirmed_at is not null
      group by lower(btrim(email))
    ),
    classifications as (
      select case
        when u.auth_user_id is not null
          and exists (select 1 from auth.users au where au.id = u.auth_user_id)
          then 'ALREADY_LINKED'
        when u.auth_user_id is not null then 'CONFLICT'
        when ic.match_count > 1 or coalesce(ac.match_count, 0) > 1
          then 'AMBIGUOUS_MATCH'
        when ac.match_count = 1 then 'EXACT_MATCH'
        else 'NO_AUTH_MATCH'
      end as classification
      from public.users u
      join internal_counts ic on ic.normalized_email = lower(btrim(u.email))
      left join auth_counts ac on ac.normalized_email = ic.normalized_email
      where u.deleted_at is null
    )
    select classification, count(*)::integer as count
    from classifications
    group by classification
    order by classification
  `;

  const counts: Record<IdentityLinkageClassification, number> = {
    EXACT_MATCH: 0,
    NO_AUTH_MATCH: 0,
    AMBIGUOUS_MATCH: 0,
    ALREADY_LINKED: 0,
    CONFLICT: 0,
  };
  for (const row of rows) counts[row.classification] = row.count;

  const totalInternalUsers = Object.values(counts).reduce(
    (total, count) => total + count,
    0,
  );
  return {
    totalInternalUsers,
    counts,
    unresolvedCount:
      counts.NO_AUTH_MATCH + counts.AMBIGUOUS_MATCH + counts.CONFLICT,
    conflictCount: counts.CONFLICT,
    safeForMigration: counts.CONFLICT === 0,
  };
}

export function assertIdentityLinkagePreflightSafe(
  report: IdentityLinkagePreflight,
): void {
  if (!report.safeForMigration) {
    throw new Error(
      `Identity linkage preflight failed: conflict=${report.conflictCount}.`,
    );
  }
}
