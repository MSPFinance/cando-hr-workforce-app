# Payroll role-preserving access — implementation gate (2026-11-20)

## Approved scope
Keep existing TL, Team Leader, Supervisor, and Manager roles unchanged. Give leaders Payroll review, time-log edit, and approval capabilities **only for verified assigned employees**. Reserve final payroll exports for HR/Admin. Do not merge/deploy before security validation.

## Verified read-only production findings
- Active role values: 4 Team Leader, 5 Manager. These are not necessarily all intended access recipients; confirm roster and alternate manager titles.
- Six active employees have blank `employees.team_leader`; must be reconciled before team authorization.
- `normalizeAccessRole` maps Team Leader/Supervisor to TL; it maps strings containing manager to Manager.
- `payrollEmployeePeriodSummary` begins with roster and must be scoped before any leader display or detail.
- Existing `visibleTime` only filters for agent-only users; leaders may receive all time logs in the client.
- `payroll_tab_access` overrides can grant a tab but cannot secure data.
- Browser-side CSV restrictions are not a security boundary.
- Legacy employee/localStorage authentication and broad anonymous Supabase table policies remain a release blocker.

## Required acceptance gates
1. Create verified employee UUID-to-auth UID mapping for each eligible active leader and worker; no email-only guessing.
2. Resolve unassigned and multi-leader reporting relationships in the authoritative roster and in the authorization tables.
3. Implement a server-authorized **team-scoped payroll read endpoint**, including summary, detail and time logs. Deny access to unrelated employee IDs even when a caller changes query parameters.
4. Route edits and approvals through audited authenticated endpoints, with lock checks and concurrency protection. Preserve existing overtime and payroll reconciliation behavior.
5. Implement final export on the server with HR/Admin role checks; disable all alternative download routes for leaders.
6. Remove/replace anonymous read/update policies only in a coordinated migration after all existing time tracking, payroll, reporting and automation callers are ready.
7. Validate TL, Supervisor, Manager, HR, Admin, Agent and unrelated-team negative cases, bulk approval, refresh persistence, and regression workflows.
8. Pass build, API lint, frontend lint, secret checks, and staging UAT. Back up production and document rollback before release.

## Explicitly not authorized
- No bulk role change from TL to Manager.
- No direct production RLS replacement, user provisioning, or data mutation without validated staging migration.
- No production deployment until the above gates pass.
