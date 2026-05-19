-- ProofLayer Phase 1 — sole migration (apply on a new Supabase project)

create extension if not exists "pgcrypto";

create table public.organizations (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.users (
  id                text primary key,
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  email             text not null,
  name              text not null,
  role              text not null check (role in ('enterprise', 'field')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint users_email_org_unique unique (organization_id, email)
);

create index idx_users_org on public.users (organization_id);

create table public.qc_cases (
  id                       text primary key,
  organization_id          uuid not null references public.organizations (id) on delete restrict,
  title                    text not null,
  store_name               text not null,
  store_address            text not null,
  geofence_lat             double precision not null,
  geofence_lng             double precision not null,
  geofence_radius_meters   int not null default 100,
  item_name                text not null,
  barcode_sku              text not null,
  time_window_start        timestamptz not null,
  time_window_end          timestamptz not null,
  status                   text not null default 'open'
    check (status in ('open', 'active', 'closed')),
  created_by               text not null references public.users (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_qc_cases_org_status on public.qc_cases (organization_id, status);
create index idx_qc_cases_org_created on public.qc_cases (organization_id, created_at desc);

create table public.assignments (
  id           text primary key,
  case_id      text not null references public.qc_cases (id) on delete cascade,
  worker_id    text not null references public.users (id),
  status       text not null default 'accepted' check (status in ('accepted')),
  assigned_at  timestamptz not null default now(),
  accepted_at  timestamptz not null default now()
);

create unique index uq_assignments_one_per_case on public.assignments (case_id);
create index idx_assignments_worker on public.assignments (worker_id, accepted_at desc);

create or replace function public.pl_accept_assignment(
  p_assignment_id text,
  p_case_id text,
  p_worker_id text,
  p_org_id uuid,
  p_assigned_at timestamptz,
  p_accepted_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  updated int;
begin
  insert into public.assignments (id, case_id, worker_id, status, assigned_at, accepted_at)
  values (p_assignment_id, p_case_id, p_worker_id, 'accepted', p_assigned_at, p_accepted_at);

  update public.qc_cases
  set status = 'active', updated_at = now()
  where id = p_case_id and organization_id = p_org_id;

  get diagnostics updated = row_count;
  if updated <> 1 then
    raise exception 'qc_case_not_updated_for_assignment'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.pl_accept_assignment(text, text, text, uuid, timestamptz, timestamptz) from public;
grant execute on function public.pl_accept_assignment(text, text, text, uuid, timestamptz, timestamptz) to postgres;
grant execute on function public.pl_accept_assignment(text, text, text, uuid, timestamptz, timestamptz) to service_role;

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'ProofLayer Demo', 'prooflayer-demo')
on conflict (id) do nothing;

insert into public.users (id, organization_id, email, name, role)
values
  ('user_alex_001', '00000000-0000-4000-8000-000000000001', 'alex@prooflayer.ai', 'Alex Chen', 'enterprise'),
  ('user_jordan_002', '00000000-0000-4000-8000-000000000001', 'jordan@prooflayer.ai', 'Jordan Rivera', 'field')
on conflict (id) do update set
  organization_id = excluded.organization_id,
  email = excluded.email,
  name = excluded.name,
  role = excluded.role,
  updated_at = now();
