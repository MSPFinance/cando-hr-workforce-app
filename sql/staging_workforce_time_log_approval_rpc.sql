-- STAGING ONLY. Requires previous workforce auth foundation and authorization functions.
-- This RPC is NOT wired into the frontend and must not be deployed in production
-- until legacy anonymous writes are removed and role/identity migration is complete.
begin;

create table if not exists public.workforce_time_log_approval_audit (
  audit_id bigint generated always as identity primary key,
  time_log_id uuid not null references public.time_logs(id),
  actor_auth_user_id uuid not null references auth.users(id),
  actor_employee_record_id uuid not null references public.employees(id),
  previous_approved text,
  previous_approval_status text,
  previous_payable_status text,
  new_approved text not null,
  new_approval_status text not null,
  new_payable_status text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table public.workforce_time_log_approval_audit enable row level security;
revoke all on public.workforce_time_log_approval_audit from anon, authenticated;

create or replace function public.workforce_approve_time_log(p_time_log_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_log public.time_logs%rowtype;
  v_actor_id uuid;
  v_actor_employee_id uuid;
  v_actor_email text;
  v_target_employee_record_id uuid;
  v_audit_id bigint;
begin
  v_actor_id := (select auth.uid());
  v_actor_employee_id := (select public.workforce_actor_employee_id());
  if v_actor_id is null or v_actor_employee_id is null then
    raise exception 'Authenticated active workforce identity required' using errcode = '42501';
  end if;

  select * into v_log from public.time_logs where id = p_time_log_id for update;
  if not found then
    raise exception 'Time log not found' using errcode = 'P0002';
  end if;

  select id into v_target_employee_record_id
  from public.employees where employee_id = v_log.employee_id;
  if v_target_employee_record_id is null
    or v_target_employee_record_id = v_actor_employee_id
    or not (select public.workforce_can_manage_employee(v_target_employee_record_id)) then
    raise exception 'Time log approval not permitted' using errcode = '42501';
  end if;
  if coalesce(v_log.locked, false) then
    raise exception 'Locked time log cannot be approved' using errcode = '23514';
  end if;
  if lower(coalesce(v_log.approval_status,'')) = 'approved'
    and lower(coalesce(v_log.approved,'')) = 'approved' then
    return jsonb_build_object('time_log_id', p_time_log_id, 'result', 'already_approved');
  end if;

  select email into v_actor_email from public.employees where id = v_actor_employee_id;
  update public.time_logs
  set approved = 'Approved',
      approval_status = 'Approved',
      payable_status = 'Approved Payable',
      approved_by = v_actor_email,
      approved_at = clock_timestamp(),
      edited_by = v_actor_email,
      edited_at = clock_timestamp()
  where id = p_time_log_id;

  insert into public.workforce_time_log_approval_audit (
    time_log_id, actor_auth_user_id, actor_employee_record_id,
    previous_approved, previous_approval_status, previous_payable_status,
    new_approved, new_approval_status, new_payable_status
  ) values (
    p_time_log_id, v_actor_id, v_actor_employee_id,
    v_log.approved, v_log.approval_status, v_log.payable_status,
    'Approved', 'Approved', 'Approved Payable'
  ) returning audit_id into v_audit_id;

  return jsonb_build_object('time_log_id', p_time_log_id, 'result', 'approved', 'audit_id', v_audit_id);
end;
$$;

revoke all on function public.workforce_approve_time_log(uuid) from public, anon;
grant execute on function public.workforce_approve_time_log(uuid) to authenticated;
commit;
