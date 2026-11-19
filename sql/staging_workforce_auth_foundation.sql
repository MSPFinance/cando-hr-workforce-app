-- STAGING ONLY. Do not run in production without a migration/rollback window.
-- Identity and reporting-line schema; does not change existing production policies.
begin;

create table if not exists public.workforce_auth_identities (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  employee_record_id uuid not null unique references public.employees(id) on delete restrict,
  verified_at timestamptz not null default now(),
  verified_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.workforce_reporting_lines (
  employee_record_id uuid not null references public.employees(id) on delete cascade,
  leader_record_id uuid not null references public.employees(id) on delete cascade,
  relationship text not null check (relationship in ('direct','manager')),
  effective_from date not null default current_date,
  effective_to date,
  created_at timestamptz not null default now(),
  primary key (employee_record_id, leader_record_id, relationship, effective_from),
  constraint no_self_reporting check (employee_record_id <> leader_record_id),
  constraint valid_reporting_window check (effective_to is null or effective_to >= effective_from)
);

create index if not exists workforce_reporting_lines_leader_idx
  on public.workforce_reporting_lines(leader_record_id,effective_from,effective_to);

alter table public.workforce_auth_identities enable row level security;
alter table public.workforce_reporting_lines enable row level security;

-- No client access to mapping tables until scoped policies/RPCs are implemented.
revoke all on public.workforce_auth_identities from anon, authenticated;
revoke all on public.workforce_reporting_lines from anon, authenticated;

comment on table public.workforce_auth_identities is
  'HR-verified mapping from Supabase Auth identity to employee UUID. Never infer from client-supplied email.';
comment on table public.workforce_reporting_lines is
  'Stable UUID-based employee/leader relationships for future authorization policies.';

commit;
