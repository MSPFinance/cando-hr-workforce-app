# Payroll team-scoped access — security rollout gate

Status: **STAGED ONLY — DO NOT MERGE OR DEPLOY**

## Verified 2026-11-19

- UI role map in `src/App.jsx` now includes `payroll` for TL, Team Lead, and Supervisor; Manager already had access.
- CSV export buttons and functions now check HR/Admin **in the browser only**. This is not a security boundary.
- Production `public.employees` and `public.time_logs` have RLS enabled, but existing `anon` policies allow broad reads/updates; the `employees` table also contains sensitive authentication-related columns.
- The app stores `candoHrUserEmail` in localStorage and uses that value to resolve the current employee. Supabase Auth sign-in was **not found** in the login path; `supabase.auth.signUp` exists for account creation.
- The browser loads `employees.select('*')` and `time_logs.select('*')`. Tightening RLS without updating these paths may break production.
- Thus neither the staged UI access nor export guards should be deployed before server-side authorization exists.

## Required before merge

1. Inventory all current clients, scheduled jobs, Apps Script synchronizations, and API callers that use the anon key or service role; document a safe migration.
2. Implement actual Supabase Auth login/session handling; do not authorize by localStorage email or client-supplied role. Move passwords and temporary-password state out of public employee reads. Do not derive permissions from user-editable metadata.
3. Define a stable `auth.uid()` ↔ employee identity mapping and authoritative HR/Admin/TL/Supervisor/Manager role assignments.
4. Model team hierarchy with stable employee IDs (not names), including Manager → TL → assigned employees, and verify changes on transfers/inactive users.
5. Add server-enforced scoped SELECT/UPDATE/approval permissions for time logs, with field-level safeguards, immutable audit history and an authenticated RPC/endpoint for approvals. Do not permit clients to self-approve their own logs or edit payroll/export privileges.
6. Replace permissive anon RLS policies in a staged transaction after clients are migrated; do not disable RLS or grant `authenticated USING (true)`. Secure all dependent tables, views, RPCs and storage.
7. Move final payroll exports to an authenticated server endpoint that verifies HR/Admin; browser-only CSV guards do not prevent extraction via the Data API.
8. Verify role matrix (agent, TL, Supervisor, Manager, HR, Admin), unrelated-team denial, inactive accounts, direct REST requests, normal time punches, PTO and existing automations. Test both SELECT and UPDATE because UPDATE requires a matching SELECT policy.
9. Run build, lint, database advisors and UAT before merge/deployment; keep a rollback plan.

**Deployment gate:** No production release until all above are verified. No production database policy changes were made as part of this branch.
