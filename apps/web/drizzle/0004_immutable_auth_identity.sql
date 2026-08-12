ALTER TABLE "users" ADD COLUMN "auth_user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_uq" UNIQUE("auth_user_id");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'auth'
      AND table_name = 'users'
      AND column_name = 'email_confirmed_at'
  ) THEN
    RAISE EXCEPTION 'B4 requires auth.users.email_confirmed_at for verified legacy linkage.'
      USING ERRCODE = 'P0001';
  END IF;
END
$$;--> statement-breakpoint
DO $$
DECLARE
  exact_match_count integer;
  no_auth_match_count integer;
  ambiguous_match_count integer;
  already_linked_count integer;
  conflict_count integer;
BEGIN
  WITH internal_counts AS (
    SELECT lower(btrim(email)) AS normalized_email, count(*)::integer AS match_count
    FROM public.users
    WHERE deleted_at IS NULL
    GROUP BY lower(btrim(email))
  ),
  auth_counts AS (
    SELECT lower(btrim(email)) AS normalized_email, count(*)::integer AS match_count
    FROM auth.users
    WHERE email IS NOT NULL AND email_confirmed_at IS NOT NULL
    GROUP BY lower(btrim(email))
  ),
  classifications AS (
    SELECT CASE
      WHEN u.auth_user_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.auth_user_id)
        THEN 'ALREADY_LINKED'
      WHEN u.auth_user_id IS NOT NULL THEN 'CONFLICT'
      WHEN ic.match_count > 1 OR coalesce(ac.match_count, 0) > 1
        THEN 'AMBIGUOUS_MATCH'
      WHEN ac.match_count = 1 THEN 'EXACT_MATCH'
      ELSE 'NO_AUTH_MATCH'
    END AS classification
    FROM public.users u
    JOIN internal_counts ic ON ic.normalized_email = lower(btrim(u.email))
    LEFT JOIN auth_counts ac ON ac.normalized_email = ic.normalized_email
    WHERE u.deleted_at IS NULL
  )
  SELECT
    count(*) FILTER (WHERE classification = 'EXACT_MATCH')::integer,
    count(*) FILTER (WHERE classification = 'NO_AUTH_MATCH')::integer,
    count(*) FILTER (WHERE classification = 'AMBIGUOUS_MATCH')::integer,
    count(*) FILTER (WHERE classification = 'ALREADY_LINKED')::integer,
    count(*) FILTER (WHERE classification = 'CONFLICT')::integer
  INTO exact_match_count, no_auth_match_count, ambiguous_match_count,
    already_linked_count, conflict_count
  FROM classifications;

  RAISE NOTICE 'B4 identity linkage preflight: exact_match=%, no_auth_match=%, ambiguous_match=%, already_linked=%, conflict=%',
    exact_match_count, no_auth_match_count, ambiguous_match_count,
    already_linked_count, conflict_count;

  IF conflict_count <> 0 THEN
    RAISE EXCEPTION 'B4 identity linkage preflight found % conflicting link(s).', conflict_count
      USING ERRCODE = 'P0001';
  END IF;
END
$$;--> statement-breakpoint
WITH internal_counts AS (
  SELECT lower(btrim(email)) AS normalized_email, count(*)::integer AS match_count
  FROM public.users
  WHERE deleted_at IS NULL
  GROUP BY lower(btrim(email))
),
auth_counts AS (
  SELECT lower(btrim(email)) AS normalized_email, count(*)::integer AS match_count
  FROM auth.users
  WHERE email IS NOT NULL AND email_confirmed_at IS NOT NULL
  GROUP BY lower(btrim(email))
),
exact_matches AS (
  SELECT u.id AS internal_user_id, au.id AS auth_user_id
  FROM public.users u
  JOIN internal_counts ic
    ON ic.normalized_email = lower(btrim(u.email)) AND ic.match_count = 1
  JOIN auth_counts ac
    ON ac.normalized_email = ic.normalized_email AND ac.match_count = 1
  JOIN auth.users au
    ON lower(btrim(au.email)) = ac.normalized_email
   AND au.email_confirmed_at IS NOT NULL
  WHERE u.deleted_at IS NULL AND u.auth_user_id IS NULL
)
UPDATE public.users u
SET auth_user_id = matches.auth_user_id,
    email_verified = true,
    updated_at = now()
FROM exact_matches matches
WHERE u.id = matches.internal_user_id
  AND u.auth_user_id IS NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.enforce_auth_user_id_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  authenticated_user_id uuid;
  matching_internal_count integer;
  matching_auth_count integer;
BEGIN
  IF OLD.auth_user_id IS NOT NULL
    AND NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
    RAISE EXCEPTION 'auth_user_id is immutable once linked.'
      USING ERRCODE = '23514';
  END IF;

  IF OLD.auth_user_id IS NULL AND NEW.auth_user_id IS NOT NULL THEN
    authenticated_user_id := auth.uid();

    -- Privileged migration/runtime writes have no request claim. Authenticated
    -- direct writes must satisfy the same one-to-one verified-email evidence
    -- as the controlled legacy-link flow.
    IF authenticated_user_id IS NOT NULL THEN
      IF NEW.auth_user_id IS DISTINCT FROM authenticated_user_id THEN
        RAISE EXCEPTION 'auth_user_id must match the authenticated identity.'
          USING ERRCODE = '42501';
      END IF;

      SELECT count(*)::integer INTO matching_internal_count
      FROM public.users u
      WHERE u.deleted_at IS NULL
        AND lower(btrim(u.email)) = lower(btrim(NEW.email));

      SELECT count(*)::integer INTO matching_auth_count
      FROM auth.users au
      WHERE au.id = authenticated_user_id
        AND au.email IS NOT NULL
        AND au.email_confirmed_at IS NOT NULL
        AND lower(btrim(au.email)) = lower(btrim(NEW.email));

      IF matching_internal_count <> 1 OR matching_auth_count <> 1 THEN
        RAISE EXCEPTION 'auth_user_id linkage evidence is ambiguous or unverified.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END
$function$;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON FUNCTION public.enforce_auth_user_id_immutability()
  FROM PUBLIC, anon, authenticated, service_role;--> statement-breakpoint
CREATE TRIGGER enforce_auth_user_id_immutability_trg
BEFORE UPDATE OF auth_user_id ON public.users
FOR EACH ROW EXECUTE FUNCTION public.enforce_auth_user_id_immutability();--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT tm.workspace_id
  FROM public.team_members tm
  JOIN public.users u ON u.id = tm.user_id AND u.deleted_at IS NULL
  WHERE u.auth_user_id = auth.uid()
    AND tm.status = 'active'
    AND tm.deleted_at IS NULL
$function$;
