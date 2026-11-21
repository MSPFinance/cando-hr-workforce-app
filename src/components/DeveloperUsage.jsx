
import React, { useState } from "react";
import { createClient } from "@supabase/supabase-js";
async function developerAuthHeader(){const {data}=await developerSupabase.auth.getSession();const token=data?.session?.access_token;if(!token)throw new Error("Developer session expired. Sign in again.");return {"Authorization":"Bearer "+token};}
const developerSupabase=import.meta.env.VITE_SUPABASE_URL&&import.meta.env.VITE_SUPABASE_ANON_KEY?createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_ANON_KEY):null;


function DetailedAuditPanel({ email, accessToken, sessionToken }) {
  const [filters, setFilters] = useState({start_date:"",end_date:"",actor_email:"",actor_role:"",action_type:"",employee_id:"",decision:"",payable_status:"",source:""});
  const [applied, setApplied] = useState(null);
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fields = [["start_date","Start date","date"],["end_date","End date","date"],["actor_email","Changed by (email)","text"],["actor_role","User role","text"],["action_type","Action type","text"],["employee_id","Employee ID","text"],["decision","Decision","text"],["payable_status","Payable status","text"],["source","Source","text"]];
  const headers = {"x-developer-email":email.trim().toLowerCase(),"x-usage-access-token":accessToken};
  async function retrieve(nextFilters, nextPage=1) {
    setBusy(true);setError("");
    try {
      const params = new URLSearchParams({ ...Object.fromEntries(Object.entries(nextFilters).filter(([,v])=>v)),page:String(nextPage),limit:"100" });
      const response = await fetch("/api/developer-activity-audit?"+params.toString(),{headers:{...headers,...await developerAuthHeader()},cache:"no-store"});
      const data = await response.json();
      if(!response.ok || !data.success) throw new Error(data.error || "Unable to retrieve audit records");
      setRecords(data.rows || []);setPage(nextPage);setHasMore(Boolean(data.has_more));setApplied(nextFilters);
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  async function download() {
    if(!applied) return;
    setBusy(true);setError("");
    try {
      const params = new URLSearchParams({...Object.fromEntries(Object.entries(applied).filter(([,v])=>v)),format:"csv"});
      const response = await fetch("/api/developer-activity-audit?"+params.toString(),{headers:{...headers,...await developerAuthHeader()},cache:"no-store"});
      if(!response.ok) {const data=await response.json().catch(()=>({}));throw new Error(data.error || "Export failed");}
      const blob = await response.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
      a.href=url;a.download="Magnemite_Developer_Audit_"+applied.start_date+"_to_"+applied.end_date+".csv";
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  return <section style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:20}}>
    <h2>Detailed Activity Audit</h2>
    <p style={{color:"#64748b"}}>Read-only Supabase activity. An activity event does not prove a time-log edit was successfully saved. Before/after values are not yet available.</p>
    <form onSubmit={e=>{e.preventDefault();retrieve({...filters},1);}} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
      {fields.map(([key,label,type])=><label key={key} style={{fontSize:13}}>{label}<input type={type} value={filters[key]} onChange={e=>setFilters(old=>({...old,[key]:e.target.value}))} style={{width:"100%",boxSizing:"border-box",padding:9,border:"1px solid #cbd5e1",borderRadius:6}} /></label>)}
      <button disabled={busy || !filters.start_date || !filters.end_date || filters.start_date>filters.end_date} type="submit">Apply audit filters</button>
      <button disabled={busy || !applied} type="button" onClick={download}>Export filtered audit CSV</button>
    </form>
    {error && <p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
    {applied && <><p>Showing {records.length} activity records on page {page}.</p>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Date/time","User","Action","Employee","Decision","Payable","Record ID","Source"].map(h=><th key={h} style={{padding:8,textAlign:"left",borderBottom:"1px solid #ddd"}}>{h}</th>)}</tr></thead><tbody>
        {records.map((r,i)=><tr key={r.id || i}>{[r.activity_datetime,r.actor_email,r.action_type,r.employee_name || r.employee_id,r.decision,r.payable_status,r.target_record_id,r.source].map((v,j)=><td key={j} style={{padding:8,borderBottom:"1px solid #eee"}}>{v ?? ""}</td>)}</tr>)}
      </tbody></table></div>
      <div style={{display:"flex",gap:12,marginTop:12}}><button disabled={busy || page===1} onClick={()=>retrieve(applied,page-1)}>Previous</button><button disabled={busy || !hasMore} onClick={()=>retrieve(applied,page+1)}>Next</button></div>
    </>}
  </section>;
}


function TimeLogAuditPanel({ email, accessToken, sessionToken }) {
  const [filters,setFilters]=useState({start_date:"",end_date:"",employee_id:"",actor_email:"",operation:"",time_log_id:""});
  const [applied,setApplied]=useState(null);
  const [rows,setRows]=useState([]);
  const [page,setPage]=useState(1);
  const [hasMore,setHasMore]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const fields=[["start_date","Start date","date"],["end_date","End date","date"],["employee_id","Employee ID","text"],["actor_email","Changed by email","text"],["operation","Operation (INSERT, UPDATE, DELETE)","text"],["time_log_id","Time log ID","text"]];
  const headers={"x-developer-email":email.trim().toLowerCase(),"x-usage-access-token":accessToken};
  async function load(next,pageNumber=1){
    setBusy(true);setError("");
    try{
      const p=new URLSearchParams({...Object.fromEntries(Object.entries(next).filter(([,v])=>v)),page:String(pageNumber),limit:"100"});
      const response=await fetch("/api/developer-time-log-audit?"+p,{headers:{...headers,...await developerAuthHeader()},cache:"no-store"});
      const data=await response.json();
      if(!response.ok||!data.success)throw new Error(data.error||"Audit query failed");
      setRows(data.rows||[]);setHasMore(Boolean(data.has_more));setPage(pageNumber);setApplied(next);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function exportCsv(){
    if(!applied)return;setBusy(true);setError("");
    try{
      const p=new URLSearchParams({...Object.fromEntries(Object.entries(applied).filter(([,v])=>v)),format:"csv"});
      const response=await fetch("/api/developer-time-log-audit?"+p,{headers:{...headers,...await developerAuthHeader()},cache:"no-store"});
      if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||"Export failed");}
      const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");
      a.href=url;a.download="Magnemite_Time_Log_Changes.csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  return <section style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:20}}>
    <h2>Persisted Time-Log Changes</h2>
    <p style={{color:"#64748b"}}>Rows from Supabase time_log_audit, recorded by the database trigger. This is separate from application usage events. Actor email may be missing or inferred; compare the record ID and values before certifying a payroll edit.</p>
    <form onSubmit={e=>{e.preventDefault();load({...filters});}} style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:12}}>
      {fields.map(([key,label,type])=><label key={key} style={{fontSize:13}}>{label}<input type={type} value={filters[key]} onChange={e=>setFilters(old=>({...old,[key]:e.target.value}))} style={{width:"100%",boxSizing:"border-box",padding:9,border:"1px solid #cbd5e1",borderRadius:6}} /></label>)}
      <button type="submit" disabled={busy||!filters.start_date||!filters.end_date||filters.start_date>filters.end_date}>Search saved changes</button>
      <button type="button" disabled={busy||!applied} onClick={exportCsv}>Download change-history CSV</button>
    </form>
    {error&&<p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
    {applied&&<><p>{rows.length} audit entries shown on page {page}.</p><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}><thead><tr>{["Changed at (UTC)","Operation","Employee","Actor","Role","Time log ID","Changed fields","Before → After","Source"].map(v=><th key={v} style={{padding:8,textAlign:"left",borderBottom:"1px solid #ddd"}}>{v}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.id}>{[r.changed_at,r.operation,r.employee_id,r.actor_email||"Unknown",r.actor_role,r.time_log_id,Array.isArray(r.changed_fields)?r.changed_fields.join(", "):"",Array.isArray(r.change_details)?r.change_details.map(d=>`${d.field}: ${String(d.before??"—")} → ${String(d.after??"—")}`).join("; "):"",r.source].map((v,i)=><td key={i} style={{padding:8,borderBottom:"1px solid #eee"}}>{v??""}</td>)}</tr>)}</tbody></table></div><div style={{display:"flex",gap:12,marginTop:12}}><button disabled={busy||page===1} onClick={()=>load(applied,page-1)}>Previous</button><button disabled={busy||!hasMore} onClick={()=>load(applied,page+1)}>Next</button></div></>}
  </section>;
}

export default function DeveloperUsage() {
  const [email, setEmail] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [developerPassword,setDeveloperPassword]=useState("");
  const [sessionToken,setSessionToken]=useState("");

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
          ...await developerAuthHeader(),
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

      if(!developerSupabase)throw new Error("Supabase Auth is not configured.");
      const {data:authData,error:authError}=await developerSupabase.auth.signInWithPassword({email:developerEmail,password:developerPassword});
      if(authError||!authData?.session?.access_token)throw new Error("Supabase developer sign-in failed.");
      setSessionToken(authData.session.access_token);
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
            ...await developerAuthHeader(),
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

              <div style={{ marginBottom: "18px" }}><label htmlFor="developerPassword">Supabase account password</label><input id="developerPassword" type="password" autoComplete="current-password" required value={developerPassword} onChange={event=>setDeveloperPassword(event.target.value)} style={inputStyle} /></div>
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


            <DetailedAuditPanel email={email} accessToken={accessToken} sessionToken={sessionToken} />
            <TimeLogAuditPanel email={email} accessToken={accessToken} sessionToken={sessionToken} />

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