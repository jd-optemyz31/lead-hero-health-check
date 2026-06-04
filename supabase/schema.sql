create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'viewer' check (role in ('admin', 'operator', 'viewer')),
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

alter table public.clients add column if not exists form_lead_tag text not null default 'form lead';
alter table public.clients add column if not exists active_pipeline_name text not null default '';
alter table public.clients add column if not exists active_pipeline_id text not null default '';
alter table public.clients add column if not exists reply_stage_name text not null default '';
alter table public.clients add column if not exists reply_stage_id text not null default '';
alter table public.clients add column if not exists reply_stage_window_hours integer not null default 24;
alter table public.clients drop constraint if exists clients_reply_stage_window_hours_check;
alter table public.clients add constraint clients_reply_stage_window_hours_check check (reply_stage_window_hours > 0);

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

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select role
      from public.app_users
      where auth_user_id = (select auth.uid())
        and active = true
      limit 1
    ),
    'viewer'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin()
    or exists (
      select 1
      from public.client_assignments
      where client_id = target_client_id
        and auth_user_id = (select auth.uid())
    );
$$;

alter table public.app_users enable row level security;
alter table public.clients enable row level security;
alter table public.client_assignments enable row level security;
alter table public.routing_setups enable row level security;
alter table public.blast_analyses enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.api_audit_logs enable row level security;

drop policy if exists app_users_read_self_or_admin on public.app_users;
create policy app_users_read_self_or_admin on public.app_users
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()) or public.is_admin());

drop policy if exists app_users_admin_write on public.app_users;
create policy app_users_admin_write on public.app_users
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists clients_read_assigned_or_admin on public.clients;
create policy clients_read_assigned_or_admin on public.clients
  for select
  to authenticated
  using (public.can_access_client(id));

drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists client_assignments_read_assigned_or_admin on public.client_assignments;
create policy client_assignments_read_assigned_or_admin on public.client_assignments
  for select
  to authenticated
  using (auth_user_id = (select auth.uid()) or public.is_admin());

drop policy if exists client_assignments_admin_write on public.client_assignments;
create policy client_assignments_admin_write on public.client_assignments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists routing_read_assigned_or_admin on public.routing_setups;
create policy routing_read_assigned_or_admin on public.routing_setups
  for select
  to authenticated
  using (public.can_access_client(client_id));

drop policy if exists routing_admin_write on public.routing_setups;
create policy routing_admin_write on public.routing_setups
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists blast_read_assigned_or_admin on public.blast_analyses;
create policy blast_read_assigned_or_admin on public.blast_analyses
  for select
  to authenticated
  using (public.can_access_client(client_id));

drop policy if exists blast_operator_insert on public.blast_analyses;
create policy blast_operator_insert on public.blast_analyses
  for insert
  to authenticated
  with check (public.can_access_client(client_id) and public.current_app_role() in ('admin', 'operator'));

drop policy if exists reports_read_assigned_or_admin on public.monthly_reports;
create policy reports_read_assigned_or_admin on public.monthly_reports
  for select
  to authenticated
  using (public.can_access_client(client_id));

drop policy if exists reports_operator_write on public.monthly_reports;
create policy reports_operator_write on public.monthly_reports
  for all
  to authenticated
  using (public.can_access_client(client_id) and public.current_app_role() in ('admin', 'operator'))
  with check (public.can_access_client(client_id) and public.current_app_role() in ('admin', 'operator'));

drop policy if exists audit_admin_read on public.api_audit_logs;
create policy audit_admin_read on public.api_audit_logs
  for select
  to authenticated
  using (public.is_admin());

revoke all on public.clients from anon, authenticated;
grant select (id, name, ghl_location_id, ghl_private_integration_token_preview, clickup_task_id, timezone, form_lead_tag, active_pipeline_name, active_pipeline_id, reply_stage_name, reply_stage_id, reply_stage_window_hours, status, created_at, updated_at)
  on public.clients to authenticated;
grant select, insert, update on public.app_users to authenticated;
grant select, insert, update on public.client_assignments to authenticated;
grant select, insert, update on public.routing_setups to authenticated;
grant select, insert, update on public.blast_analyses to authenticated;
grant select, insert, update on public.monthly_reports to authenticated;
grant select on public.api_audit_logs to authenticated;
