# Magnemite manager time-log loading optimization — 2026-11-23

## Functional changes
- Existing manager `time_logs` load still reads the most recent **5,000** rows, with the same date / employee filters, deterministic ordering, and realtime updates. `pageSize` increased from 500 to 1,000: for a full 5,000-row response, 5 paginated API requests instead of 10. Do not represent this as a measured 50% reduction in latency; only the number of requests is halved.
- Startup paths that concurrently fetch `employees` and `employee_balances` use a **single shared in-flight request**. Each caller still applies its own employee merge; completed responses are never cached. This avoids duplicate fetches but does not alter RLS or credentials.
- New `manager_time_logs_refresh_complete` and `manager_time_logs_refresh_failed` browser performance metrics. Export via `?perf=1`; these metrics begin accumulating only after release.

## Original measured baseline (pre-change)
- API `GET /rest/v1/time_logs`: original 149.4ms mean, 328.1ms p95 from 6,318 requests (Supabase origin time).
- Frontend `supabase_time_logs`: original 385.8ms mean across 9 samples; cumulative updated export 346ms across 12, **not independent after-sample**.
- `authenticated_startup_ready`: 9.391 seconds in one browser, not representative fleet P95.
- Manager completed-load metric: not available before this change.

## Safe rollout gates
1. Vercel preview READY and no runtime errors in authenticated agent/manager login.
2. Manager with no filters sees consistent recent logs; employee/date filtering and older logs still accessible.
3. Manager editing and bulk approval persists after refresh, matches Supabase and payroll.
4. Agent clock in/out, realtime updates, break/schedule views, and developer session remain functional.
5. Compare matched post-release operating periods. Leave final improvement un-certified until sufficient samples.
6. If Supabase PostgREST result-size cap is configured below 1000, reevaluate page size to prevent incomplete history.

## Scope exclusion
No employee, time-log, payroll, PTO, approval, audit or RLS data was changed. No schedule rules or database migrations.
