# Magnemite performance optimization — baseline and verification

Audit date: 2026-11-23. Source: production Supabase edge request logs for magnemite.app, origin_time (not full browser round trip), and cumulative pg_stat_statements. All timings milliseconds.

| Supabase endpoint and operation | Requests sampled | Average origin ms | P95 origin ms | Maximum origin ms |
|---|---:|---:|---:|---:|
| GET /rest/v1/time_logs | 6318 | 149.4 | 328.1 | 2325 |
| PATCH /rest/v1/time_logs | 180 | 127.1 | 330.6 | 536 |
| POST /rest/v1/time_logs | 10 | 95.9 | 145.6 | 156 |
| POST /rest/v1/rpc/process_time_log_status | 277 | 117.3 | 213.2 | 474 |
| GET /rest/v1/employees | 93 | 240.3 | 565 | 642 |
| GET /rest/v1/employee_schedule_versions | 131 | 184.2 | 496 | 879 |

These are measured historical samples and not controlled before/after comparisons. Browser initial-load and end-to-end save timing not yet instrumented; neither should be represented as observed.

## Changes in this branch

1. Lazy-load the workforce and developer application entrypoints, so Developer-only code is not eagerly included in regular workforce startup.
2. Run the independent activity page and period-summary reads concurrently for Developer Usage.
3. Skip the unchanged full-period summary computation for paginated Developer Usage pages beyond the first page.
4. Coalesce simultaneous agent initial and realtime-subscription reconciliation reads, while retaining a second reconciliation when the first has already completed to protect against missing events.

No database migrations, attendance formulas, time-log write logic, payroll calculations, or approval rules were changed.

## Verification / release gates

- Vercel preview deployment build is READY.
- Agent login and timer show latest open log on initial load; Realtime updates and manual refresh still work.
- Developer Usage page 1 displays selected-period totals; Next/Previous pages do not reset those totals; applying new filters recalculates totals.
- Agent clock in/out and manager edit and bulk approval persist after refresh and appear in payroll.
- Compare same endpoint over comparable work-hour window and request mix. Report request volumes, average, p95 and max, plus user-visible full navigation-to-interactive and click-to-confirm timing (not yet available).
- Do not deploy to production until smoke tests and approval of payroll-critical behavior.

## Future improvements

Add browser Real User Monitoring of navigation and save click-to-confirm. Inspect manager time-log loader for repeated 500-row pages up to 5,000 records, with preservation of historical filters. Activate app_usage_sessions and system_usage_snapshots only after verifying authorization and data ingestion. Avoid heavy frequent polling and store no secrets or raw payroll values in performance events.
