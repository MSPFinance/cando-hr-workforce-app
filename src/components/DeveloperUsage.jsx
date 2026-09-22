
import React, { useState } from "react";

export default function DeveloperUsage() {
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);


  // Selected payroll period or custom date range.
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [periodPreset, setPeriodPreset] = useState("custom");

    // Reporting period currently displayed in the dashboard.
  // This changes only after Apply Filters succeeds.
  const [appliedRange, setAppliedRange] = useState({
    startDate: "",
    endDate: "",
  });

  // Complete summary for the selected date range.
  const [summary, setSummary] = useState(null);

  // Detailed activity pagination.
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const PAGE_SIZE = 100;


  function selectPayrollPeriod(selectedPeriod) {
    setPeriodPreset(selectedPeriod);

    if (selectedPeriod === "custom") {
      return;
    }

    const today = new Date();

    const year = today.getFullYear();

    const month = String(
      today.getMonth() + 1
    ).padStart(2, "0");

    const lastDay = String(
      new Date(
        year,
        today.getMonth() + 1,
        0
      ).getDate()
    ).padStart(2, "0");

    const monthPrefix = `${year}-${month}`;

    if (selectedPeriod === "first") {
      setStartDate(`${monthPrefix}-01`);
      setEndDate(`${monthPrefix}-15`);
    }

    if (selectedPeriod === "second") {
      setStartDate(`${monthPrefix}-16`);
      setEndDate(`${monthPrefix}-${lastDay}`);
    }
  }

    async function loadActivity(
    token,
    developerEmail,
    requestedPage = 1,
    reportRange = appliedRange
  ) {

    // Explicit local development test mode.
    // Never use simulated records in a production build.
    if (
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      ) &&
      new URLSearchParams(
        window.location.search
      ).get("mockUsage") === "1"
    ) {
      const { getMockUsage } = await import(
        "./DeveloperUsageMock.js"
      );

      const result = getMockUsage({
        startDate: reportRange.startDate,
        endDate: reportRange.endDate,
        page: requestedPage,
        pageSize: PAGE_SIZE,
      });

      setSummary(result.summary);
      setPage(result.page);
      setHasMore(result.has_more);

      return result.rows;
    }

    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      page: String(requestedPage),
    });

        // Use the reporting period currently applied.
    if (reportRange.startDate && reportRange.endDate) {
      params.set("start_date", reportRange.startDate);
      params.set("end_date", reportRange.endDate);
    }

    const response = await fetch(
      `/api/application-usage?${params.toString()}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "x-developer-email": developerEmail,
          "x-usage-access-token": token,
        },
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.error || "Unable to load activity."
      );
    }

    // Complete totals for the selected payroll period.
    setSummary(result.summary ?? null);

    // Current page and availability of additional records.
    setPage(result.page ?? requestedPage);
    setHasMore(Boolean(result.has_more));

    // Return only the current page of activity.
    return Array.isArray(result.rows)
      ? result.rows
      : [];
  }


  async function handleConnect(event) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const developerEmail = email.trim().toLowerCase();

      if (!developerEmail || !accessToken) {
        throw new Error(
          "Enter your approved email and access token."
        );
      }

      const activity = await loadActivity(
        accessToken,
        developerEmail
      );

      setRows(activity);
      setConnected(true);
    } catch (err) {
      setError(err.message || "Connection failed.");
      setConnected(false);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

    async function handleConnectWithTestData() {
    // Allow this connection only in local development.
    const isLocalTest =
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      ) &&
      new URLSearchParams(
        window.location.search
      ).get("mockUsage") === "1";

    if (!isLocalTest) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const activity = await loadActivity(
        "",
        "mock-developer@example.invalid",
        1,
        { startDate: "", endDate: "" }
      );

      setRows(activity);
      setConnected(true);
      setAppliedRange({
        startDate: "",
        endDate: "",
      });
    } catch (err) {
      setError(
        err.message || "Unable to load test data."
      );
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    setConnected(false);
    setAccessToken("");
    setRows([]);
    setError("");
  }

  async function handleRefresh() {
    setLoading(true);
    setError("");

    try {
      const activity = await loadActivity(
        accessToken,
        email.trim().toLowerCase()
      );

      setRows(activity);
    } catch (err) {
      setError(err.message || "Unable to refresh activity.");
    } finally {
      setLoading(false);
    }
  }


  async function handleApplyFilters() {
    if (
      loading ||
      !connected ||
      !startDate ||
      !endDate ||
      startDate > endDate
    ) {
      return;
    }

    setLoading(true);
    setError("");

    const nextRange = {
      startDate,
      endDate,
    };

    try {
      const activity = await loadActivity(
        accessToken,
        email.trim().toLowerCase(),
        1,
        nextRange
      );

      // Update the displayed report only after
      // the new reporting period loads successfully.
      setRows(activity);
      setAppliedRange(nextRange);
    } catch (err) {
      setError(
        err.message || "Unable to apply payroll-period filters."
      );
    } finally {
      setLoading(false);
    }
  }


  async function handlePageChange(nextPage) {
    if (
      loading ||
      nextPage < 1 ||
      (nextPage > page && !hasMore)
    ) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const activity = await loadActivity(
        accessToken,
        email.trim().toLowerCase(),
        nextPage
      );

      setRows(activity);
    } catch (err) {
      setError(
        err.message || "Unable to load activity page."
      );
    } finally {
      setLoading(false);
    }
  }


  async function handleExportMockCsv() {
    // Mock exports are allowed only in local development.
    const isLocalMock =
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      ) &&
      new URLSearchParams(
        window.location.search
      ).get("mockUsage") === "1";

    if (!isLocalMock || !connected || loading) {
      return;
    }

    setError("");

    try {
      const { getMockUsage } = await import(
        "./DeveloperUsageMock.js"
      );

      // Retrieve ALL records in the applied reporting period,
      // not just the 100 displayed on the current page.
      const allRows = [];
      let exportPage = 1;
      let hasMoreRecords = true;

      while (hasMoreRecords) {
        const result = getMockUsage({
          startDate: appliedRange.startDate,
          endDate: appliedRange.endDate,
          page: exportPage,
          pageSize: PAGE_SIZE,
        });

        allRows.push(...result.rows);

        hasMoreRecords = result.has_more;
        exportPage += 1;
      }

      // Define the CSV columns.
      const columns = [
        ["Activity Date", "activity_date"],
        ["Date / Time", "activity_datetime"],
        ["User", "actor_name"],
        ["User Email", "actor_email"],
        ["Role", "actor_role"],
        ["Action", "action_type"],
        ["Action Category", "action_category"],
        ["Employee ID", "employee_id"],
        ["Affected Employee", "employee_name"],
        ["Records Affected", "records_affected"],
        ["Employees Affected", "employees_affected"],
        ["Self-Action Flag", "self_action_flag"],
        ["Source", "source"],
      ];

      // Escape values for CSV, including potentially unsafe
      // spreadsheet formulas in imported text.
      function csvCell(value) {
        const text = String(value ?? "");

        const safeText =
          /^[\s]*[=+\-@]/.test(text)
            ? "'" + text
            : text;

        return '"' +
          safeText.replace(/"/g, '""') +
          '"';
      }

      const csvLines = [
        columns
          .map(([heading]) => csvCell(heading))
          .join(","),

        ...allRows.map((row) =>
          columns
            .map(([, key]) => csvCell(row[key]))
            .join(",")
        ),
      ];

      const csvContent = csvLines.join("\r\n");

      const blob = new Blob(
        ["\uFEFF", csvContent],
        { type: "text/csv;charset=utf-8;" }
      );

      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = downloadUrl;

      link.download =
        `Magnemite_Usage_MOCK_` +
        `${appliedRange.startDate || "All"}_to_` +
        `${appliedRange.endDate || "All"}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err) {
      setError(
        err.message || "Unable to export test activity."
      );
    }
  }


  async function handleExportUsageCsv() {
    if (!connected || loading) {
      return;
    }

    // Keep the existing simulated-data export
    // available for local testing.
    const isLocalMock =
      import.meta.env.DEV &&
      ["localhost", "127.0.0.1"].includes(
        window.location.hostname
      ) &&
      new URLSearchParams(
        window.location.search
      ).get("mockUsage") === "1";

    if (isLocalMock) {
      await handleExportMockCsv();
      return;
    }

    // Export the reporting period that was
    // successfully applied to the dashboard.
    const { startDate, endDate } = appliedRange;

    if (!startDate || !endDate) {
      setError(
        "Select a start date and end date, then click Apply Filters before exporting."
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        format: "csv",
        start_date: startDate,
        end_date: endDate,
      });

      const response = await fetch(
        `/api/application-usage?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "x-developer-email":
              email.trim().toLowerCase(),
            "x-usage-access-token": accessToken,
          },
        }
      );

      if (!response.ok) {
        const result = await response
          .json()
          .catch(() => null);

        throw new Error(
          result?.error ||
            `CSV export failed (${response.status}).`
        );
      }

      const csvBlob = await response.blob();
      const downloadUrl =
        URL.createObjectURL(csvBlob);

      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download =
        `Magnemite_Usage_${startDate}_to_${endDate}.csv`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 1000);
    } catch (err) {
      setError(
        err.message || "Unable to export application usage."
      );
    } finally {
      setLoading(false);
    }
  }

  const panelStyle = {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
  };

  const inputStyle = {
    width: "100%",
    padding: "12px",
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    marginTop: "6px",
    boxSizing: "border-box",
  };

  const buttonStyle = {
    padding: "12px 18px",
    border: "none",
    borderRadius: "8px",
    background: "#2563eb",
    color: "#ffffff",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "32px 20px",
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <header style={{ marginBottom: "28px" }}>
          <p
            style={{
              color: "#64748b",
              fontSize: "12px",
              fontWeight: "bold",
              letterSpacing: "1px",
            }}
          >
            MAGNEMITE / DEVELOPER WORKSPACE
          </p>

          <h1>Application Usage</h1>

          <p style={{ color: "#64748b" }}>
            Private activity monitoring and reporting.
          </p>
        </header>

        {!connected ? (
          <section style={panelStyle}>
            <h2>Developer Access</h2>

            <p style={{ color: "#64748b" }}>
              Enter your approved developer email and
              private access token to connect.
            </p>

            <form onSubmit={handleConnect}>
              <div style={{ marginBottom: "18px" }}>
                <label htmlFor="developerEmail">
                  Developer email
                </label>

                <input
                  id="developerEmail"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  style={inputStyle}
                  placeholder="Your approved email"
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label htmlFor="developerToken">
                  Private access token
                </label>

                <input
                  id="developerToken"
                  type="password"
                  autoComplete="off"
                  required
                  value={accessToken}
                  onChange={(event) =>
                    setAccessToken(event.target.value)
                  }
                  style={inputStyle}
                  placeholder="Enter your private token"
                />
              </div>

              {error && (
                <p role="alert" style={{ color: "#b91c1c" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={buttonStyle}
              >
                {loading
                  ? "Connecting..."
                  : "Connect to Dashboard"}
              </button>
                            {import.meta.env.DEV &&
                ["localhost", "127.0.0.1"].includes(
                  window.location.hostname
                ) &&
                new URLSearchParams(
                  window.location.search
                ).get("mockUsage") === "1" && (
                  <button
                    type="button"
                    onClick={handleConnectWithTestData}
                    disabled={loading}
                    style={{
                      ...buttonStyle,
                      background: "#475569",
                      marginLeft: "12px",
                      marginTop: "12px",
                    }}
                  >
                    Connect with Test Data
                  </button>
                )}
            </form>
          </section>
        ) : (
          <>
            <section style={panelStyle}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                }}
              >
                <div>
                  <h2>Activity Overview</h2>

                  <p style={{ color: "#64748b" }}>
                    Connected as {email}
                  </p>
                </div>


                <div
                  style={{
                    display: "flex",
                    gap: "10px",
                    flexWrap: "wrap",
                  }}
                >

                  <button
                    type="button"
                    onClick={handleExportUsageCsv}
                    disabled={loading}
                    style={{
                      ...buttonStyle,
                      background: "#047857",
                    }}
                  >
                    {loading ? "Please wait..." : "Download CSV"}
                  </button>

                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading}
                    style={buttonStyle}
                  >
                    {loading ? "Loading..." : "Refresh"}
                  </button>

                  <button
                    type="button"
                    onClick={handleDisconnect}
                    style={{
                      ...buttonStyle,
                      background: "#475569",
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" style={{ color: "#b91c1c" }}>
                  {error}
                </p>
              )}

              <p>
                <strong>{rows.length}</strong> recent
                activity records loaded.
              </p>
            </section>


            {/* Payroll-period reporting filters */}
            <section style={panelStyle}>
              <h2>Payroll Period</h2>

              <p style={{ color: "#64748b" }}>
                Select a payroll period or enter a custom
                date range to review application activity.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  flexWrap: "wrap",
                  alignItems: "flex-end",
                  marginBottom: "16px",
                }}
              >
                <div style={{ minWidth: "200px", flex: 1 }}>
                  <label htmlFor="periodPreset">
                    Payroll period
                  </label>

                  <select
                    id="periodPreset"
                    value={periodPreset}
                    onChange={(event) =>
                      selectPayrollPeriod(event.target.value)
                    }
                    style={inputStyle}
                  >
                    <option value="custom">
                      Custom date range
                    </option>

                    <option value="first">
                      Current month: 1st–15th
                    </option>

                    <option value="second">
                      Current month: 16th–end
                    </option>
                  </select>
                </div>

                <div style={{ minWidth: "180px", flex: 1 }}>
                  <label htmlFor="usageStartDate">
                    Start date
                  </label>

                  <input
                    id="usageStartDate"
                    type="date"
                    value={startDate}
                    onChange={(event) => {
                      setStartDate(event.target.value);
                      setPeriodPreset("custom");
                    }}
                    style={inputStyle}
                  />
                </div>

                <div style={{ minWidth: "180px", flex: 1 }}>
                  <label htmlFor="usageEndDate">
                    End date
                  </label>

                  <input
                    id="usageEndDate"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => {
                      setEndDate(event.target.value);
                      setPeriodPreset("custom");
                    }}
                    style={inputStyle}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleApplyFilters}
                  disabled={
                    loading ||
                    !startDate ||
                    !endDate ||
                    startDate > endDate
                  }
                  style={buttonStyle}
                >
                  {loading ? "Loading..." : "Apply Filters"}
                </button>
              </div>

              {appliedRange.startDate && appliedRange.endDate && (
  <p
    style={{
      color: "#64748b",
      fontSize: "13px",
    }}
  >
    Displayed reporting period: {appliedRange.startDate} to{" "}
    {appliedRange.endDate}
  </p>
)}
            </section>


            {/* Full payroll-period summary */}
            <section style={panelStyle}>
              <h2>Application Usage Summary</h2>

              <p style={{ color: "#64748b" }}>
                Complete activity totals for the selected
                payroll period, including records that are
                not displayed on the current page.
              </p>

              {summary ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "16px",
                    marginTop: "20px",
                  }}
                >
                  {[
                    {
                      label: "Total Actions",
                      value: summary.total_actions,
                    },
                    {
                      label: "Active Users",
                      value: summary.active_users,
                    },
                    {
                      label: "Approval Actions",
                      value: summary.approval_actions,
                    },
                    {
                      label: "Manual Corrections",
                      value: summary.manual_corrections,
                    },
                    {
                      label: "Records Affected",
                      value: summary.records_affected,
                    },
                    {
                      label: "Self-Action Flags",
                      value: summary.self_action_flags,
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "20px",
                      }}
                    >
                      <p
                        style={{
                          color: "#64748b",
                          fontSize: "13px",
                          margin: "0 0 10px",
                        }}
                      >
                        {metric.label}
                      </p>

                      <strong
                        style={{
                          fontSize: "28px",
                          color: "#172033",
                        }}
                      >
                        {Number(
                          metric.value ?? 0
                        ).toLocaleString()}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#64748b" }}>
                  Select a start date and end date,
                  then click Apply Filters to load
                  the complete payroll-period summary.
                </p>
              )}
            </section>

            <section style={panelStyle}>
              <h2>Recent Application Activity</h2>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr>
                      {[
                        "Date / Time",
                        "User",
                        "Role",
                        "Action",
                        "Affected Employee",
                        "Records",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            padding: "12px",
                            borderBottom:
                              "1px solid #e2e8f0",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: "12px" }}>
                          {row.activity_datetime || ""}
                        </td>

                        <td style={{ padding: "12px" }}>
                          {row.actor_name ||
                            row.actor_email ||
                            "Unknown"}
                        </td>

                        <td style={{ padding: "12px" }}>
                          {row.actor_role || ""}
                        </td>

                        <td style={{ padding: "12px" }}>
                          {row.action_type || ""}
                        </td>

                        <td style={{ padding: "12px" }}>
                          {row.employee_name ||
                            "Multiple / Not specified"}
                        </td>

                        <td style={{ padding: "12px" }}>
                          {row.records_affected ?? 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!rows.length && (
                  <p style={{ color: "#64748b" }}>
                    No activity records were returned.
                  </p>
                )}
              </div>

                            {/* Activity table pagination */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    color: "#64748b",
                    fontSize: "14px",
                    margin: 0,
                  }}
                >
                  Page {page} · Showing {rows.length} records
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handlePageChange(page - 1)}
                    disabled={loading || page === 1}
                    style={{
                      ...buttonStyle,
                      background: "#475569",
                      opacity:
                        loading || page === 1 ? 0.5 : 1,
                      cursor:
                        loading || page === 1
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Previous
                  </button>

                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: "bold",
                    }}
                  >
                    {page}
                  </span>

                  <button
                    type="button"
                    onClick={() => handlePageChange(page + 1)}
                    disabled={loading || !hasMore}
                    style={{
                      ...buttonStyle,
                      opacity:
                        loading || !hasMore ? 0.5 : 1,
                      cursor:
                        loading || !hasMore
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>

            </section>
          </>
        )}
      </div>
    </main>
  );
}