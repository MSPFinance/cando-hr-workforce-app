-- MAGNEMITE UAT ONLY: inspect and approve before executing in Supabase.
-- Creates an append-only record of time_logs row mutations. No existing time logs updated.
-- IMPORTANT: service-role operations may not carry the initiating manager identity.
-- The application must set a trusted actor context server-side, or capture actor separately.
begin;
create schema if not exists audit;
create table if not exists audit.time_log_changes (
  audit_id bigint generated always as identity primary key,
  time_log_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  changed_at timestamptz not null default clock_timestamp(),
  database_actor text not null default current_user,
  auth_user_id uuid,
  transaction_id bigint not null default txid_current(),
  before_record jsonb,
  after_record jsonb
);
revoke all on audit.time_log_changes from public, anon, authenticated;
create index if not exists time_log_changes_record_idx on audit.time_log_changes(time_log_id,changed_at desc);
create or replace function audit.capture_time_log_change() returns trigger
language plpgsql security definer set search_path = pg_catalog, public, audit
as $$
begin
  if TG_OP = 'INSERT' then
    insert into audit.time_log_changes(time_log_id,operation,auth_user_id,after_record)
    values (to_jsonb(NEW)->>'id',TG_OP,auth.uid(),to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if to_jsonb(OLD) is distinct from to_jsonb(NEW) then
      insert into audit.time_log_changes(time_log_id,operation,auth_user_id,before_record,after_record)
      values (to_jsonb(NEW)->>'id',TG_OP,auth.uid(),to_jsonb(OLD),to_jsonb(NEW));
    end if;
    return NEW;
  else
    insert into audit.time_log_changes(time_log_id,operation,auth_user_id,before_record)
    values (to_jsonb(OLD)->>'id',TG_OP,auth.uid(),to_jsonb(OLD));
    return OLD;
  end if;
end;
$$;
revoke all on function audit.capture_time_log_change() from public, anon, authenticated;
drop trigger if exists trg_audit_time_logs on public.time_logs;
create trigger trg_audit_time_logs
after insert or update or delete on public.time_logs
for each row execute function audit.capture_time_log_change();
commit;
-- Do not expose audit schema via PostgREST; restrict DB access and retention.
-- Before production: review PII, trigger performance, actor attribution, deletion policy,
-- transaction rollback behavior, RLS/permissions, and existing audit sources.
