-- Row Level Security: workspace-membership policies (auth.uid()).
-- Applied out-of-band (not part of the drizzle-kit journal).

create or replace function public.current_workspace_ids()
   returns setof uuid language sql stable security definer set search_path = public as $fn$
     select tm.workspace_id
     from public.team_members tm
     join public.users u on u.id = tm.user_id and u.deleted_at is null
     join auth.users au on lower(au.email) = lower(u.email)
     where au.id = auth.uid()
       and tm.status = 'active'
       and tm.deleted_at is null
   $fn$;

create or replace function public.current_comember_ids()
   returns setof uuid language sql stable security definer set search_path = public as $fn$
     select distinct tm.user_id
     from public.team_members tm
     where tm.workspace_id in (select public.current_workspace_ids())
       and tm.deleted_at is null
   $fn$;

create or replace function public.current_conversation_ids()
   returns setof uuid language sql stable security definer set search_path = public as $fn$
     select c.id
     from public.ai_conversations c
     where c.workspace_id in (select public.current_workspace_ids())
       and c.deleted_at is null
   $fn$;

grant execute on function public.current_workspace_ids() to authenticated, anon;

grant execute on function public.current_comember_ids() to authenticated, anon;

grant execute on function public.current_conversation_ids() to authenticated, anon;

alter table public.workspaces enable row level security;

grant select, insert, update, delete on public.workspaces to authenticated;

drop policy if exists workspace_access on public.workspaces;

create policy workspace_access on public.workspaces for all to authenticated using (id in (select public.current_workspace_ids())) with check (id in (select public.current_workspace_ids()));

alter table public.team_members enable row level security;

grant select, insert, update, delete on public.team_members to authenticated;

drop policy if exists workspace_access on public.team_members;

create policy workspace_access on public.team_members for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.users enable row level security;

grant select, insert, update, delete on public.users to authenticated;

drop policy if exists workspace_access on public.users;

create policy workspace_access on public.users for all to authenticated using (id in (select public.current_comember_ids())) with check (id in (select public.current_comember_ids()));

alter table public.customers enable row level security;

grant select, insert, update, delete on public.customers to authenticated;

drop policy if exists workspace_access on public.customers;

create policy workspace_access on public.customers for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.services enable row level security;

grant select, insert, update, delete on public.services to authenticated;

drop policy if exists workspace_access on public.services;

create policy workspace_access on public.services for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.bookings enable row level security;

grant select, insert, update, delete on public.bookings to authenticated;

drop policy if exists workspace_access on public.bookings;

create policy workspace_access on public.bookings for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.payments enable row level security;

grant select, insert, update, delete on public.payments to authenticated;

drop policy if exists workspace_access on public.payments;

create policy workspace_access on public.payments for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.files enable row level security;

grant select, insert, update, delete on public.files to authenticated;

drop policy if exists workspace_access on public.files;

create policy workspace_access on public.files for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.settings enable row level security;

grant select, insert, update, delete on public.settings to authenticated;

drop policy if exists workspace_access on public.settings;

create policy workspace_access on public.settings for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.notifications enable row level security;

grant select, insert, update, delete on public.notifications to authenticated;

drop policy if exists workspace_access on public.notifications;

create policy workspace_access on public.notifications for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.ai_conversations enable row level security;

grant select, insert, update, delete on public.ai_conversations to authenticated;

drop policy if exists workspace_access on public.ai_conversations;

create policy workspace_access on public.ai_conversations for all to authenticated using (workspace_id in (select public.current_workspace_ids())) with check (workspace_id in (select public.current_workspace_ids()));

alter table public.ai_messages enable row level security;

grant select, insert, update, delete on public.ai_messages to authenticated;

drop policy if exists workspace_access on public.ai_messages;

create policy workspace_access on public.ai_messages for all to authenticated using (conversation_id in (select public.current_conversation_ids())) with check (conversation_id in (select public.current_conversation_ids()));
