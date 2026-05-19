-- ADR-001: ProofLayer Phase 1 foundation (prooflayer schema)
-- No seeds. No demo data. Apply on a new Supabase project.

create extension if not exists "pgcrypto";

create schema if not exists prooflayer;

-- ─── updated_at trigger (all Phase 1 tables) ─────────────────────────────────
create or replace function prooflayer.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── organizations ───────────────────────────────────────────────────────────
create table prooflayer.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger organizations_set_updated_at
  before update on prooflayer.organizations
  for each row execute function prooflayer.set_updated_at();

-- ─── users (id mirrors auth.users.id — no default) ───────────────────────────
create table prooflayer.users (
  id               uuid primary key,
  organization_id  uuid not null references prooflayer.organizations (id) on delete restrict,
  email            text not null unique,
  full_name        text,
  role             text not null check (role in ('enterprise', 'field_worker')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_users_organization_id on prooflayer.users (organization_id);
create index idx_users_email on prooflayer.users (email);

create trigger users_set_updated_at
  before update on prooflayer.users
  for each row execute function prooflayer.set_updated_at();

-- ─── qc_cases ────────────────────────────────────────────────────────────────
create table prooflayer.qc_cases (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references prooflayer.organizations (id) on delete restrict,
  title            text not null,
  description      text,
  status           text not null default 'draft'
    check (status in ('draft', 'open', 'in_review', 'closed')),
  created_by       uuid not null references prooflayer.users (id) on delete restrict,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_qc_cases_organization_id on prooflayer.qc_cases (organization_id);
create index idx_qc_cases_created_by on prooflayer.qc_cases (created_by);
create index idx_qc_cases_status on prooflayer.qc_cases (status);

create trigger qc_cases_set_updated_at
  before update on prooflayer.qc_cases
  for each row execute function prooflayer.set_updated_at();

-- ─── assignments ─────────────────────────────────────────────────────────────
create table prooflayer.assignments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references prooflayer.organizations (id) on delete restrict,
  qc_case_id       uuid not null references prooflayer.qc_cases (id) on delete cascade,
  assigned_to      uuid not null references prooflayer.users (id) on delete restrict,
  assigned_by      uuid not null references prooflayer.users (id) on delete restrict,
  status           text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted', 'approved', 'rejected')),
  due_at           timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index idx_assignments_organization_id on prooflayer.assignments (organization_id);
create index idx_assignments_qc_case_id on prooflayer.assignments (qc_case_id);
create index idx_assignments_assigned_to on prooflayer.assignments (assigned_to);
create index idx_assignments_status on prooflayer.assignments (status);

create trigger assignments_set_updated_at
  before update on prooflayer.assignments
  for each row execute function prooflayer.set_updated_at();

-- Cross-table org consistency (ADR §3.4)
create or replace function prooflayer.validate_assignment_org_consistency()
returns trigger
language plpgsql
as $$
declare
  case_org uuid;
  assignee_org uuid;
  assigner_org uuid;
begin
  select organization_id into case_org from prooflayer.qc_cases where id = new.qc_case_id;
  select organization_id into assignee_org from prooflayer.users where id = new.assigned_to;
  select organization_id into assigner_org from prooflayer.users where id = new.assigned_by;

  if case_org is null then
    raise exception 'qc_case_not_found' using errcode = 'P0001';
  end if;

  if new.organization_id is distinct from case_org
     or assignee_org is distinct from new.organization_id
     or assigner_org is distinct from new.organization_id then
    raise exception 'assignment_organization_mismatch' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger assignments_validate_org
  before insert or update on prooflayer.assignments
  for each row execute function prooflayer.validate_assignment_org_consistency();

-- Expose schema to Supabase API (service role / PostgREST)
grant usage on schema prooflayer to postgres, service_role;
grant all on all tables in schema prooflayer to postgres, service_role;
grant all on all sequences in schema prooflayer to postgres, service_role;
alter default privileges in schema prooflayer grant all on tables to postgres, service_role;
