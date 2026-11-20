# Emergency Payroll UI access — release checklist

**Scope:** Temporary broad Payroll visibility for authorized Team Leaders, without changing employee roles. This is NOT a database access-control solution.

## Production access audit
- Abril Ruiz, Fernanda Alfaro, Jeannette Rodriguez, Kevin Oseguera: active Team Leaders with `payroll_tab_access=true` in the production employee roster as of 2026-11-20.
- Existing operational Managers have Payroll access; an active `Sample Manager` test account also exists and must be reviewed before rollout.
- Production `employees` and `time_logs` have broad anonymous SELECT/UPDATE policies. Frontend role checks and export guards cannot protect these records from direct API calls.

## UAT before merge/deployment
- Log in as each of four Team Leaders; verify Payroll tab appears and time-log edits and approvals persist after refresh.
- Log in as a Manager; verify existing Payroll workflows continue to function.
- Log in as Agent and Employee; verify Payroll tab is inaccessible even if `payroll_tab_access=true`.
- Verify TL cannot export Payroll summary, country, all-period, or employee detail CSV through the UI; HR/Admin can.
- Verify browser console and network errors; confirm no regression in clock-in/out, PTO, overtime, payroll reconciliation, and bulk approval.
- Explicitly record temporary broad-visibility acceptance and list authorized users.
- **Security:** Test direct API access as anon and unrelated employees. Expected to fail under a secure model; currently broad anon policies are a known blocker. Do not claim these tests pass.
- Confirm deployment diff includes only the isolated hotfix, not the unfinished authentication/RLS branch.

## Rollback
Revert hotfix commit or redeploy prior known-good Vercel deployment. Keep database unchanged. Verify original Payroll, Agent Portal, time logs, and approval flows.

## Release status
Draft PR, no production deployment. UI-only mitigation, not security isolation.
