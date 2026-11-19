-- STAGING ONLY / READ-ONLY DIAGNOSTICS.
-- Run after applying staging_workforce_auth_foundation.sql.
-- No personal identifiers are returned.
with active_employees as (
 select id, lower(btrim(coalesce(email,''))) email_key, lower(btrim(coalesce(status,''))) employee_status
 from public.employees
), identity_summary as (
 select
  count(*) as identity_links,
  count(*) filter (where e.id is null) as missing_employee_links,
  count(*) filter (where a.id is null) as missing_auth_links,
  count(*) filter (where e.employee_status not in ('active','activo')) as inactive_employee_links
 from public.workforce_auth_identities i
 left join active_employees e on e.id=i.employee_record_id
 left join auth.users a on a.id=i.auth_user_id
), hierarchy_summary as (
 select count(*) as reporting_edges,
 count(*) filter (where l.effective_to is null or l.effective_to >= current_date) as current_reporting_edges,
 count(*) filter (where leader.id is null or member.id is null) as invalid_employee_links
 from public.workforce_reporting_lines l
 left join public.employees leader on leader.id=l.leader_record_id
 left join public.employees member on member.id=l.employee_record_id
)
select * from identity_summary cross join hierarchy_summary;

-- Additional diagnostic: number of active workforce records without verified Auth mapping.
select count(*) as active_employees_without_verified_auth
from public.employees e
where lower(btrim(coalesce(e.status,''))) in ('active','activo')
  and not exists (
    select 1 from public.workforce_auth_identities i where i.employee_record_id=e.id
  );
