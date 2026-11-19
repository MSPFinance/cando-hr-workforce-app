# Payroll Access — UAT execution and release checklist

**Release status: BLOCKED.** This branch must not be merged/deployed until server-side authentication and team scoping are implemented.

## Identity migration readiness (production aggregate counts, 2026-11-19)
- 205 public employee records; 2 Supabase Auth users; 2 matched by email.
- 36 employee records with missing/blank email.
- 4 duplicate normalized employee email groups.
- 0 Auth users without an employee match.
- Never auto-provision users or bind an Auth identity to duplicate emails. Resolve duplicates and missing identities through HR verification.

## Test matrix — run in staging with synthetic records
| Actor | Assigned employee | Unassigned employee | Final payroll export |
|---|---|---|---|
| Agent | Own punches only; no administrative edits | Denied | Denied |
| TL | View/edit/approve authorized logs | Denied (including direct REST) | Denied |
| Supervisor | View/edit/approve authorized logs | Denied (including direct REST) | Denied |
| Manager | View/edit/approve descendants | Denied (including direct REST) | Denied |
| HR | Authorized company-wide access | Authorized company-wide access | Allowed |
| Admin | Authorized company-wide access | Authorized company-wide access | Allowed |
| Inactive employee | Denied | Denied | Denied |

For each actor verify SELECT, INSERT, UPDATE, DELETE, approval RPC, direct REST calls, filter bypass, forged localStorage email, expired JWT, employee reassignment, and audit attribution. Also verify payroll reports do not expose unauthorized employees through aggregate data.

## Regression tests
1. Clock in, break, resume, clock out, midnight/overnight shift.
2. Schedule edits and approved exceptions.
3. PTO/VTO/sick/prize leave, overtime, and payroll reconciliation.
4. Bulk time-log approvals with save confirmation and retry behavior.
5. Apps Script/Sheets synchronization and scheduled automations.
6. Final CSV exports for HR/Admin only.
7. Auth session persistence, password reset, first login and logout.

## Gate
- No production policy changes until all legacy callers are migrated.
- No frontend-only security claims.
- Require successful automated build, staging tests, database RLS tests, and documented rollback before approving release.
