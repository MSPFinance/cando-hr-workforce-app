-- Magnemite time-log save reconciliation: READ ONLY
-- Compares latest audit snapshot for each time log against the current row.
-- Does not establish whether every frontend save attempt succeeded.
with latest as (
 select distinct on (time_log_id) time_log_id, operation, new_data, changed_at
 from public.time_log_audit
 where changed_at >= now() - interval '7 days'
 order by time_log_id, changed_at desc, id desc
)
select count(*) as audited_ids,
 count(*) filter (where operation <> 'DELETE' and t.id is null) as audit_exists_but_row_missing,
 count(*) filter (where operation = 'DELETE' and t.id is not null) as deleted_but_row_present,
 count(*) filter (where operation <> 'DELETE' and t.id is not null and to_jsonb(t) is distinct from latest.new_data) as latest_snapshot_differs_from_live
from latest left join public.time_logs t on t.id::text = latest.time_log_id;

-- Actor attribution gap by source (including service-role operations).
select source, operation, count(*) as entries,
 count(*) filter (where nullif(btrim(actor_email),'') is null) as missing_actor
from public.time_log_audit
group by source, operation
order by entries desc;

-- Recommended end-to-end UAT (non-production employee/test record only):
-- 1. Capture original record ID and value via a read-only query.
-- 2. Save one change through the manager/TL frontend.
-- 3. Confirm the UI shows a server-acknowledged success, then refresh.
-- 4. Confirm the record ID and saved values match public.time_logs.
-- 5. Confirm a new public.time_log_audit UPDATE entry with correct old/new snapshots.
-- 6. Confirm the actor identity and payroll export reflect the approved/payable result.
-- 7. Repeat for bulk approval, edits, new logs, and concurrent saves.
-- Never change live payroll records merely to test this procedure.
