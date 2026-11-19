-- STAGING ONLY. Depends on staging_workforce_auth_foundation.sql and
-- staging_workforce_authorization_functions.sql.
-- Adds a read-only, authenticated permission check for a time log.
-- This is NOT an approval/write endpoint and does not change existing RLS.
begin;

create or replace function public.workforce_can_manage_time_log(p_time_log_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((
    select public.workforce_can_manage_employee(e.id)
    from public.time_logs t
    join public.employees e on e.employee_id = t.employee_id
    where t.id = p_time_log_id
    limit 1
  ), false)
$$;

revoke all on function public.workforce_can_manage_time_log(uuid) from public, anon;
grant execute on function public.workforce_can_manage_time_log(uuid) to authenticated;

comment on function public.workforce_can_manage_time_log(uuid) is
  'Authenticated team/HR authorization predicate for an existing time log. Does not expose row data or authorize a write.';

commit;

-- SECURITY NOTE: This predicate is not sufficient to secure time_logs.
-- Before activating RLS, migrate legacy clients and implement separate
-- server-controlled approval and editing endpoints with immutable audit logs.
