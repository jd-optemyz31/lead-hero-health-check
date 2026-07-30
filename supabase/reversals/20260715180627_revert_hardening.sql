-- Emergency compatibility reversal for 20260715180627_harden_supabase_access.
-- Prefer rolling back the Node deployment first. Applying this file restores
-- the former browser grants and public helpers, and therefore reopens the
-- security findings addressed by the hardening migration.

create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public
as $$
  select coalesce((select role from public.app_users where auth_user_id=(select auth.uid()) and active=true limit 1), 'viewer');
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.current_app_role()='admin'; $$;
create or replace function public.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from public.client_assignments
    where client_id=target_client_id and auth_user_id=(select auth.uid())
  );
$$;

drop policy if exists app_users_admin_insert on public.app_users;
drop policy if exists app_users_admin_update on public.app_users;
drop policy if exists app_users_admin_delete on public.app_users;
drop policy if exists app_users_read_self_or_admin on public.app_users;
create policy app_users_read_self_or_admin on public.app_users for select to authenticated using (auth_user_id=(select auth.uid()) or public.is_admin());
create policy app_users_admin_write on public.app_users for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_admin_delete on public.clients;
drop policy if exists clients_read_assigned_or_admin on public.clients;
create policy clients_read_assigned_or_admin on public.clients for select to authenticated using (public.can_access_client(id));
create policy clients_admin_write on public.clients for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists client_assignments_admin_insert on public.client_assignments;
drop policy if exists client_assignments_admin_update on public.client_assignments;
drop policy if exists client_assignments_admin_delete on public.client_assignments;
drop policy if exists client_assignments_read_assigned_or_admin on public.client_assignments;
create policy client_assignments_read_assigned_or_admin on public.client_assignments for select to authenticated using (auth_user_id=(select auth.uid()) or public.is_admin());
create policy client_assignments_admin_write on public.client_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists routing_admin_insert on public.routing_setups;
drop policy if exists routing_admin_update on public.routing_setups;
drop policy if exists routing_admin_delete on public.routing_setups;
drop policy if exists routing_read_assigned_or_admin on public.routing_setups;
create policy routing_read_assigned_or_admin on public.routing_setups for select to authenticated using (public.can_access_client(client_id));
create policy routing_admin_write on public.routing_setups for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists blast_read_assigned_or_admin on public.blast_analyses;
drop policy if exists blast_operator_insert on public.blast_analyses;
create policy blast_read_assigned_or_admin on public.blast_analyses for select to authenticated using (public.can_access_client(client_id));
create policy blast_operator_insert on public.blast_analyses for insert to authenticated with check (public.can_access_client(client_id) and public.current_app_role() in ('admin','operator'));

drop policy if exists reports_operator_insert on public.monthly_reports;
drop policy if exists reports_operator_update on public.monthly_reports;
drop policy if exists reports_read_assigned_or_admin on public.monthly_reports;
create policy reports_read_assigned_or_admin on public.monthly_reports for select to authenticated using (public.can_access_client(client_id));
create policy reports_operator_write on public.monthly_reports for all to authenticated using (public.can_access_client(client_id) and public.current_app_role() in ('admin','operator')) with check (public.can_access_client(client_id) and public.current_app_role() in ('admin','operator'));

drop policy if exists audit_admin_read on public.api_audit_logs;
create policy audit_admin_read on public.api_audit_logs for select to authenticated using (public.is_admin());

grant execute on function public.current_app_role() to public, anon, authenticated;
grant execute on function public.is_admin() to public, anon, authenticated;
grant execute on function public.can_access_client(uuid) to public, anon, authenticated;
grant execute on function public.rls_auto_enable() to public, anon, authenticated;

grant select, insert, update on public.app_users to authenticated;
grant select, insert, update on public.client_assignments to authenticated;
grant select, insert, update on public.routing_setups to authenticated;
grant select, insert, update on public.blast_analyses to authenticated;
grant select, insert, update on public.monthly_reports to authenticated;
grant select on public.api_audit_logs to authenticated;
grant select (id, name, ghl_location_id, ghl_private_integration_token_preview, clickup_task_id, timezone, form_lead_tag, active_pipeline_name, active_pipeline_id, reply_stage_name, reply_stage_id, reply_stage_window_hours, status, created_at, updated_at) on public.clients to authenticated;
