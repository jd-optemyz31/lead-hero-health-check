-- Final server-only schema. Apply committed migrations in supabase/migrations/ in production.

create extension if not exists pgcrypto;
create schema if not exists private;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'user' check (role in ('admin', 'user')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  ghl_location_id text not null,
  ghl_private_integration_token_encrypted text not null,
  ghl_private_integration_token_preview text not null default '',
  clickup_task_id text not null default '',
  timezone text not null default 'America/New_York',
  form_lead_tag text not null default 'form lead',
  active_pipeline_name text not null default '',
  active_pipeline_id text not null default '',
  reply_stage_name text not null default '',
  reply_stage_id text not null default '',
  reply_stage_window_hours integer not null default 24 check (reply_stage_window_hours > 0),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.client_assignments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, auth_user_id)
);

create table if not exists public.routing_setups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  staff_contact_id text not null default '',
  staff_phone text not null default '',
  expected_phrase text not null default 'New form submission',
  expected_delay_minutes integer not null default 10 check (expected_delay_minutes > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blast_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date_start date not null,
  date_end date not null,
  reply_tag text not null default '',
  source text not null default 'live',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  date_start date not null,
  date_end date not null,
  status text not null check (status in ('Green', 'Yellow', 'Red')),
  source text not null default 'live',
  posted_to_clickup boolean not null default false,
  clickup_comment_id text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.api_audit_logs (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  action text not null,
  target_type text not null default '',
  target_id text not null default '',
  status text not null default 'success',
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists app_users_auth_user_id_idx on public.app_users (auth_user_id);
create index if not exists app_users_role_active_idx on public.app_users (role, active);
create index if not exists client_assignments_auth_user_id_idx on public.client_assignments (auth_user_id);
create index if not exists client_assignments_client_id_idx on public.client_assignments (client_id);
create index if not exists routing_setups_client_id_idx on public.routing_setups (client_id);
create index if not exists blast_analyses_client_date_idx on public.blast_analyses (client_id, date_start, date_end);
create index if not exists monthly_reports_client_date_idx on public.monthly_reports (client_id, date_start, date_end);
create index if not exists api_audit_logs_client_id_created_at_idx on public.api_audit_logs (client_id, created_at desc);
create index if not exists api_audit_logs_auth_user_id_created_at_idx on public.api_audit_logs (auth_user_id, created_at desc);

create or replace function private.current_app_role()
returns text language sql stable security definer set search_path = pg_catalog, public
as $$
  select (select role from public.app_users where auth_user_id=(select auth.uid()) and active=true limit 1);
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select private.current_app_role() = 'admin'; $$;

create or replace function private.can_access_client(target_client_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select private.current_app_role() in ('admin','user');
$$;

create or replace function private.preserve_active_admin()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if old.role = 'admin' and old.active then
    if tg_op = 'DELETE'
      or (tg_op = 'UPDATE' and (new.role <> 'admin' or not new.active))
    then
      perform pg_advisory_xact_lock(hashtext('lead_hero_active_admin_guard'));
      if not exists (
        select 1 from public.app_users
        where id <> old.id and role = 'admin' and active = true
      ) then
        raise exception 'At least one active Admin must remain.' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists preserve_active_admin on public.app_users;
create trigger preserve_active_admin
  before update of role, active or delete on public.app_users
  for each row execute function private.preserve_active_admin();

create or replace function public.rls_auto_enable()
returns event_trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
    if cmd.schema_name is not null and cmd.schema_name in ('public')
      and cmd.schema_name not in ('pg_catalog','information_schema')
      and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%'
    then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception when others then
        raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$$;

do $$ begin
  if not exists (select 1 from pg_event_trigger where evtname='ensure_rls') then
    create event trigger ensure_rls on ddl_command_end execute function public.rls_auto_enable();
  end if;
end $$;

alter table public.app_users enable row level security;
alter table public.clients enable row level security;
alter table public.client_assignments enable row level security;
alter table public.routing_setups enable row level security;
alter table public.blast_analyses enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.api_audit_logs enable row level security;

drop policy if exists app_users_read_self_or_admin on public.app_users;
drop policy if exists app_users_admin_write on public.app_users;
drop policy if exists app_users_admin_insert on public.app_users;
drop policy if exists app_users_admin_update on public.app_users;
drop policy if exists app_users_admin_delete on public.app_users;
create policy app_users_read_self_or_admin on public.app_users for select to authenticated using (auth_user_id=(select auth.uid()) or private.is_admin());
create policy app_users_admin_insert on public.app_users for insert to authenticated with check (private.is_admin());
create policy app_users_admin_update on public.app_users for update to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists clients_read_assigned_or_admin on public.clients;
drop policy if exists clients_admin_write on public.clients;
drop policy if exists clients_admin_insert on public.clients;
drop policy if exists clients_admin_update on public.clients;
drop policy if exists clients_admin_delete on public.clients;
drop policy if exists clients_active_user_insert on public.clients;
drop policy if exists clients_active_user_update on public.clients;
drop policy if exists clients_active_user_delete on public.clients;
create policy clients_read_assigned_or_admin on public.clients for select to authenticated using (private.can_access_client(id));
create policy clients_active_user_insert on public.clients for insert to authenticated with check (private.current_app_role() in ('admin','user'));
create policy clients_active_user_update on public.clients for update to authenticated using (private.current_app_role() in ('admin','user')) with check (private.current_app_role() in ('admin','user'));
create policy clients_active_user_delete on public.clients for delete to authenticated using (private.current_app_role() in ('admin','user'));

drop policy if exists client_assignments_read_assigned_or_admin on public.client_assignments;
drop policy if exists client_assignments_admin_write on public.client_assignments;
drop policy if exists client_assignments_admin_insert on public.client_assignments;
drop policy if exists client_assignments_admin_update on public.client_assignments;
drop policy if exists client_assignments_admin_delete on public.client_assignments;
create policy client_assignments_read_assigned_or_admin on public.client_assignments for select to authenticated using (auth_user_id=(select auth.uid()) or private.is_admin());
create policy client_assignments_admin_insert on public.client_assignments for insert to authenticated with check (private.is_admin());
create policy client_assignments_admin_update on public.client_assignments for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy client_assignments_admin_delete on public.client_assignments for delete to authenticated using (private.is_admin());

drop policy if exists routing_read_assigned_or_admin on public.routing_setups;
drop policy if exists routing_admin_write on public.routing_setups;
drop policy if exists routing_admin_insert on public.routing_setups;
drop policy if exists routing_admin_update on public.routing_setups;
drop policy if exists routing_admin_delete on public.routing_setups;
drop policy if exists routing_active_user_insert on public.routing_setups;
drop policy if exists routing_active_user_update on public.routing_setups;
drop policy if exists routing_active_user_delete on public.routing_setups;
create policy routing_read_assigned_or_admin on public.routing_setups for select to authenticated using (private.can_access_client(client_id));
create policy routing_active_user_insert on public.routing_setups for insert to authenticated with check (private.can_access_client(client_id));
create policy routing_active_user_update on public.routing_setups for update to authenticated using (private.can_access_client(client_id)) with check (private.can_access_client(client_id));
create policy routing_active_user_delete on public.routing_setups for delete to authenticated using (private.can_access_client(client_id));

drop policy if exists blast_read_assigned_or_admin on public.blast_analyses;
drop policy if exists blast_operator_insert on public.blast_analyses;
drop policy if exists blast_active_user_insert on public.blast_analyses;
create policy blast_read_assigned_or_admin on public.blast_analyses for select to authenticated using (private.can_access_client(client_id));
create policy blast_active_user_insert on public.blast_analyses for insert to authenticated with check (private.can_access_client(client_id));

drop policy if exists reports_read_assigned_or_admin on public.monthly_reports;
drop policy if exists reports_operator_write on public.monthly_reports;
drop policy if exists reports_operator_insert on public.monthly_reports;
drop policy if exists reports_operator_update on public.monthly_reports;
drop policy if exists reports_active_user_insert on public.monthly_reports;
drop policy if exists reports_active_user_update on public.monthly_reports;
create policy reports_read_assigned_or_admin on public.monthly_reports for select to authenticated using (private.can_access_client(client_id));
create policy reports_active_user_insert on public.monthly_reports for insert to authenticated with check (private.can_access_client(client_id));
create policy reports_active_user_update on public.monthly_reports for update to authenticated using (private.can_access_client(client_id)) with check (private.can_access_client(client_id));

drop policy if exists audit_admin_read on public.api_audit_logs;
create policy audit_admin_read on public.api_audit_logs for select to authenticated using (private.is_admin());

drop function if exists public.can_access_client(uuid);
drop function if exists public.is_admin();
drop function if exists public.current_app_role();

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.can_access_client(uuid) from public, anon;
revoke all on function private.preserve_active_admin() from public, anon, authenticated;
grant execute on function private.current_app_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.can_access_client(uuid) to authenticated, service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

revoke all privileges on table public.app_users from anon, authenticated;
revoke all privileges on table public.clients from anon, authenticated;
revoke all privileges on table public.client_assignments from anon, authenticated;
revoke all privileges on table public.routing_setups from anon, authenticated;
revoke all privileges on table public.blast_analyses from anon, authenticated;
revoke all privileges on table public.monthly_reports from anon, authenticated;
revoke all privileges on table public.api_audit_logs from anon, authenticated;
grant all privileges on table public.app_users, public.clients, public.client_assignments, public.routing_setups, public.blast_analyses, public.monthly_reports, public.api_audit_logs to service_role;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
