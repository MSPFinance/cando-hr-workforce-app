-- MAGNEMITE: READ-ONLY VERIFICATION (NOT A MIGRATION)
-- Production already has public.time_log_audit and trg_audit_time_logs.
-- DO NOT DROP OR REPLACE THE EXISTING TRIGGER.
-- These statements only inspect existing objects; they do not mutate employee records.
select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid = 'public.time_logs'::regclass and not tgisinternal;

select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'time_log_audit'
order by ordinal_position;

select operation, count(*) as entries, max(changed_at) as latest_entry
from public.time_log_audit
group by operation order by operation;

select count(*) as total_entries,
       count(*) filter (where actor_email is null or btrim(actor_email) = '') as missing_actor_email,
       count(*) filter (where operation = 'UPDATE' and (old_data is null or new_data is null)) as missing_update_snapshots
from public.time_log_audit;

-- Further work: validate the existing trigger function, permissions and audit retention,
-- and ensure front-end writes check returned rows. Do not infer persisted changes
-- from click events. Existing audit table is the authoritative change-history source.
