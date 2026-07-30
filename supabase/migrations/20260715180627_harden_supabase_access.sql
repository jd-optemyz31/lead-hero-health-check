-- Server-only Supabase hardening. No application data is modified.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select (
    select role
    from public.app_users
    where auth_user_id = (select auth.uid())
      and active = true
    limit 1
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.current_app_role() = 'admin';
$$;

create or replace function private.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select private.is_admin()
    or (
      private.current_app_role() in ('operator', 'viewer')
      and exists (
        select 1
        from public.client_assignments
        where client_id = target_client_id
          and auth_user_id = (select auth.uid())
      )
    );
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.can_access_client(uuid) from public, anon;
grant execute on function private.current_app_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.can_access_client(uuid) to authenticated, service_role;

drop policy if exists app_users_read_self_or_admin on public.app_users;
drop policy if exists app_users_admin_write on public.app_users;
drop policy if exists app_users_admin_insert on public.app_users;
drop policy if exists app_users_admin_update on public.app_users;
drop policy if exists app_users_admin_delete on public.app_users;
create policy app_users_read_self_or_admin on public.app_users
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or private.is_admin());
create policy app_users_admin_insert on public.app_users
  for insert to authenticated with check (private.is_admin());
create policy app_users_admin_update on public.app_users
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy app_users_admin_delete on public.app_users
  for delete to authenticated using (private.is_admin());

drop policy if exists clients_read_assigned_or_admin on public.clients;
drop policy if exists clients_admin_write on public.clients;
drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_admin_delete on public.clients;
create policy clients_read_assigned_or_admin on public.clients
  for select to authenticated using (private.can_access_client(id));
create policy clients_admin_insert on public.clients
  for insert to authenticated with check (private.is_admin());
create policy clients_admin_update on public.clients
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy clients_admin_delete on public.clients
  for delete to authenticated using (private.is_admin());

drop policy if exists client_assignments_read_assigned_or_admin on public.client_assignments;
drop policy if exists client_assignments_admin_write on public.client_assignments;
drop policy if exists client_assignments_admin_insert on public.client_assignments;
drop policy if exists client_assignments_admin_update on public.client_assignments;
drop policy if exists client_assignments_admin_delete on public.client_assignments;
create policy client_assignments_read_assigned_or_admin on public.client_assignments
  for select to authenticated
  using (auth_user_id = (select auth.uid()) or private.is_admin());
create policy client_assignments_admin_insert on public.client_assignments
  for insert to authenticated with check (private.is_admin());
create policy client_assignments_admin_update on public.client_assignments
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy client_assignments_admin_delete on public.client_assignments
  for delete to authenticated using (private.is_admin());

drop policy if exists routing_read_assigned_or_admin on public.routing_setups;
drop policy if exists routing_admin_write on public.routing_setups;
drop policy if exists routing_admin_insert on public.routing_setups;
drop policy if exists routing_admin_update on public.routing_setups;
drop policy if exists routing_admin_delete on public.routing_setups;
create policy routing_read_assigned_or_admin on public.routing_setups
  for select to authenticated using (private.can_access_client(client_id));
create policy routing_admin_insert on public.routing_setups
  for insert to authenticated with check (private.is_admin());
create policy routing_admin_update on public.routing_setups
  for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy routing_admin_delete on public.routing_setups
  for delete to authenticated using (private.is_admin());

drop policy if exists blast_read_assigned_or_admin on public.blast_analyses;
drop policy if exists blast_operator_insert on public.blast_analyses;
create policy blast_read_assigned_or_admin on public.blast_analyses
  for select to authenticated using (private.can_access_client(client_id));
create policy blast_operator_insert on public.blast_analyses
  for insert to authenticated
  with check (private.can_access_client(client_id) and private.current_app_role() in ('admin', 'operator'));

drop policy if exists reports_read_assigned_or_admin on public.monthly_reports;
drop policy if exists reports_operator_write on public.monthly_reports;
drop policy if exists reports_operator_insert on public.monthly_reports;
drop policy if exists reports_operator_update on public.monthly_reports;
create policy reports_read_assigned_or_admin on public.monthly_reports
  for select to authenticated using (private.can_access_client(client_id));
create policy reports_operator_insert on public.monthly_reports
  for insert to authenticated
  with check (private.can_access_client(client_id) and private.current_app_role() in ('admin', 'operator'));
create policy reports_operator_update on public.monthly_reports
  for update to authenticated
  using (private.can_access_client(client_id) and private.current_app_role() in ('admin', 'operator'))
  with check (private.can_access_client(client_id) and private.current_app_role() in ('admin', 'operator'));

drop policy if exists audit_admin_read on public.api_audit_logs;
create policy audit_admin_read on public.api_audit_logs
  for select to authenticated using (private.is_admin());

drop function if exists public.can_access_client(uuid);
drop function if exists public.is_admin();
drop function if exists public.current_app_role();

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke all privileges on table public.app_users from anon, authenticated;
revoke all privileges on table public.clients from anon, authenticated;
revoke all privileges on table public.client_assignments from anon, authenticated;
revoke all privileges on table public.routing_setups from anon, authenticated;
revoke all privileges on table public.blast_analyses from anon, authenticated;
revoke all privileges on table public.monthly_reports from anon, authenticated;
revoke all privileges on table public.api_audit_logs from anon, authenticated;

grant all privileges on table public.app_users to service_role;
grant all privileges on table public.clients to service_role;
grant all privileges on table public.client_assignments to service_role;
grant all privileges on table public.routing_setups to service_role;
grant all privileges on table public.blast_analyses to service_role;
grant all privileges on table public.monthly_reports to service_role;
grant all privileges on table public.api_audit_logs to service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;

create index if not exists api_audit_logs_auth_user_id_created_at_idx
  on public.api_audit_logs (auth_user_id, created_at desc);
