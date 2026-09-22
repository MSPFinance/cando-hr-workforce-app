
/*
 * MAGNEMITE — DEVELOPER DASHBOARD TEST DATA
 *
 * Local development only.
 * All records are simulated.
 * No Supabase connection or credentials are required.
 */

const TEST_USERS = [
  { name: "Test Team Leader A", role: "Team Leader" },
  { name: "Test Team Leader B", role: "Team Leader" },
  { name: "Test Manager A", role: "Manager" },
  { name: "Test Manager B", role: "Manager" },
];

// Generate 1,250 simulated application actions.
const MOCK_ACTIONS = Array.from(
  { length: 1250 },
  (_, index) => {
    const user = TEST_USERS[index % TEST_USERS.length];

    const isApproval = index % 2 === 0;

        const activityDate =
      index < 625
        ? "2026-09-19"
        : "2026-09-18";

    const hour = String(
      8 + (index % 10)
    ).padStart(2, "0");

    const minute = String(
      index % 60
    ).padStart(2, "0");

    return {
      id: `MOCK-${index + 1}`,

      activity_date: activityDate,

      activity_datetime:
        `${activityDate} ${hour}:${minute}:00`,

      actor_name: user.name,

      actor_email:
        `test-user-${index % TEST_USERS.length + 1}@example.invalid`,

      actor_role: user.role,

      action_type: isApproval
        ? "Bulk Time Logs Approved"
        : "Time Log Corrected",

      action_category: isApproval
        ? "Manager Approval"
        : "Manager Edit",

      employee_name:
        `Test Employee ${(index % 20) + 1}`,

      employee_id:
        `TEST-${(index % 20) + 1}`,

      records_affected: isApproval
        ? 3
        : 1,

      employees_affected: 1,

      self_action_flag: false,

      source: "development_mock",
    };
  }
);

// Return a simulated API response.
export function getMockUsage({
  startDate = "",
  endDate = "",
  page = 1,
  pageSize = 100,
} = {}) {
  const filteredRows = MOCK_ACTIONS.filter((row) => {
    if (startDate && row.activity_date < startDate) {
      return false;
    }

    if (endDate && row.activity_date > endDate) {
      return false;
    }

    return true;
  });

  const offset = (page - 1) * pageSize;

  const pageRows = filteredRows.slice(
    offset,
    offset + pageSize
  );

  const summary =
    startDate && endDate
      ? {
          total_actions: filteredRows.length,

          active_users: new Set(
            filteredRows.map((row) => row.actor_email)
          ).size,

          approval_actions: filteredRows.filter(
            (row) =>
              row.action_category === "Manager Approval"
          ).length,

          manual_corrections: filteredRows.filter(
            (row) =>
              row.action_type === "Time Log Corrected"
          ).length,

          records_affected: filteredRows.reduce(
            (total, row) =>
              total + row.records_affected,
            0
          ),

          self_action_flags: filteredRows.filter(
            (row) => row.self_action_flag
          ).length,
        }
      : null;

  return {
    success: true,
    summary,
    page,
    page_size: pageSize,
    row_count: pageRows.length,
    has_more:
      offset + pageSize < filteredRows.length,
    rows: pageRows,
  };
}