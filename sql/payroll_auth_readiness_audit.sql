-- Magnemite authentication migration readiness audit
-- READ ONLY: safe to run in production. No employee personal data or password fields returned.
-- Run with a privileged SQL editor; do not expose auth.users to the application.
with employee_email as (
  select id, lower(btrim(email)) as email_key
  from public.employees
), auth_email as (
  select id, lower(btrim(email)) as email_key
  from auth.users
)
select
  (select count(*) from employee_email) as employees_total,
  (select count(*) from auth_email) as auth_users_total,
  (select count(*) from employee_email where email_key is null or email_key = '') as employee_email_missing,
  (select count(*) from employee_email e where e.email_key <> '' and exists
    (select 1 from auth_email a where a.email_key = e.email_key)) as employees_with_auth_match,
  (select count(*) from (
    select email_key from employee_email where email_key is not null and email_key <> ''
    group by email_key having count(*) > 1
  ) duplicates) as duplicate_employee_email_groups,
  (select count(*) from auth_email a where a.email_key is not null and not exists
    (select 1 from employee_email e where e.email_key = a.email_key)) as auth_users_without_employee;
