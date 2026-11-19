-- STAGING ONLY: additive authorization primitives.
-- Depends on staging_workforce_auth_foundation.sql.
-- Do not deploy until authenticated login and all client/API callers are migrated.
begin;

create or replace function public.workforce_actor_employee_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select i.employee_record_id
  from public.workforce_auth_identities i
  join public.employees e on e.id = i.employee_record_id
  where i.auth_user_id = (select auth.uid())
    and lower(coalesce(e.status, '')) in ('active', 'activo')
  limit 1
$$;

create or replace function public.workforce_actor_is_hr_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workforce_auth_identities i
    join public.employees e on e.id = i.employee_record_id
    where i.auth_user_id = (select auth.uid())
      and lower(coalesce(e.status, '')) in ('active', 'activo')
      and lower(btrim(coalesce(e.access_level, ''))) in ('hr', 'admin')
  )
$$;

create or replace function public.workforce_can_manage_employee(target_employee_record_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with recursive descendants(employee_record_id, path) as (
    select l.employee_record_id, array[l.leader_record_id, l.employee_record_id]::uuid[]
    from public.workforce_reporting_lines l
    where l.leader_record_id = (select public.workforce_actor_employee_id())
      and current_date between l.effective_from and coalesce(l.effective_to, 'infinity'::date)
    union all
    select l.employee_record_id, d.path || l.employee_record_id
    from descendants d
    join public.workforce_reporting_lines l on l.leader_record_id = d.employee_record_id
    where current_date between l.effective_from and coalesce(l.effective_to, 'infinity'::date)
      and not l.employee_record_id = any(d.path)
  )
  select coalesce((select public.workforce_actor_is_hr_admin()),false)
    or (
      exists (
        select 1 from public.workforce_auth_identities i
        join public.employees e on e.id = i.employee_record_id
        where i.auth_user_id = (select auth.uid())
          and lower(coalesce(e.status,'')) in ('active','activo')
          and (
            lower(btrim(coalesce(e.access_level,''))) in ('tl','team lead','team leader','supervisor','manager')
            or lower(coalesce(e.access_level,'')) like '%supervisor%'
            or lower(coalesce(e.access_level,'')) like '%manager%'
          )
      )
      and exists (
        select 1 from descendants d
        join public.employees target on target.id = d.employee_record_id
        where d.employee_record_id = target_employee_record_id
          and lower(coalesce(target.status,'')) in ('active','activo')
      )
    )
$$;

-- These functions are authorization building blocks, NOT yet attached to time_logs RLS.
-- Restrict execution to authenticated sessions; unverified users resolve to false/null.
revoke all on function public.workforce_actor_employee_id() from public, anon;
revoke all on function public.workforce_actor_is_hr_admin() from public, anon;
revoke all on function public.workforce_can_manage_employee(uuid) from public, anon;
grant execute on function public.workforce_actor_employee_id() to authenticated;
grant execute on function public.workforce_actor_is_hr_admin() to authenticated;
grant execute on function public.workforce_can_manage_employee(uuid) to authenticated;
commit;
