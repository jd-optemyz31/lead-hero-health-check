-- Emergency-only reversal for 20260729075229_admin_user_roles.sql.
-- This is lossy: every User becomes an Operator, and client assignments again
-- determine access. Roll back the application deployment before running this.

drop trigger if exists preserve_active_admin on public.app_users;
drop function if exists private.preserve_active_admin();

alter table public.app_users
  drop constraint if exists app_users_role_check;

update public.app_users
set role = 'operator',
    updated_at = now()
where role = 'user';

alter table public.app_users
  alter column role set default 'viewer',
  add constraint app_users_role_check check (role in ('admin', 'operator', 'viewer'));

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

drop policy if exists app_users_read_self_or_admin on public.app_users;
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
drop policy if exists clients_active_user_insert on public.clients;
drop policy if exists clients_active_user_update on public.clients;
drop policy if exists clients_active_user_delete on public.clients;
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

drop policy if exists routing_read_assigned_or_admin on public.routing_setups;
drop policy if exists routing_active_user_insert on public.routing_setups;
drop policy if exists routing_active_user_update on public.routing_setups;
drop policy if exists routing_active_user_delete on public.routing_setups;
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
drop policy if exists blast_active_user_insert on public.blast_analyses;
drop policy if exists blast_operator_insert on public.blast_analyses;
create policy blast_read_assigned_or_admin on public.blast_analyses
  for select to authenticated using (private.can_access_client(client_id));
create policy blast_operator_insert on public.blast_analyses
  for insert to authenticated
  with check (private.can_access_client(client_id) and private.current_app_role() in ('admin', 'operator'));

drop policy if exists reports_read_assigned_or_admin on public.monthly_reports;
drop policy if exists reports_active_user_insert on public.monthly_reports;
drop policy if exists reports_active_user_update on public.monthly_reports;
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
