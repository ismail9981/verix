-- B6.3 closes the application-role PostgREST table boundary. Verix domain
-- access is server-only; authenticated and anon retain Supabase Auth access,
-- but no direct privileges on Verix-owned public tables.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

-- These SECURITY DEFINER helpers remain in public because existing RLS
-- policies depend on them. They are internal policy implementation details,
-- not an application RPC surface.
revoke execute on function public.current_workspace_ids() from public;
revoke execute on function public.current_workspace_ids() from anon;
revoke execute on function public.current_workspace_ids() from authenticated;

revoke execute on function public.current_comember_ids() from public;
revoke execute on function public.current_comember_ids() from anon;
revoke execute on function public.current_comember_ids() from authenticated;

revoke execute on function public.current_conversation_ids() from public;
revoke execute on function public.current_conversation_ids() from anon;
revoke execute on function public.current_conversation_ids() from authenticated;
