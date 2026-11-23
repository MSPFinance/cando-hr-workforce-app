import React, { useEffect, useState } from "react";

const panel = { background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:24,marginBottom:20 };
const input = { width:"100%",padding:10,border:"1px solid #cbd5e1",borderRadius:7,marginTop:5,boxSizing:"border-box" };
const button = { padding:"10px 12px",border:0,borderRadius:7,color:"#fff",background:"#2563eb",cursor:"pointer" };
const cell = { textAlign:"left",padding:10,borderBottom:"1px solid #e2e8f0",verticalAlign:"top",fontSize:13 };
const empty = () => ({ actor:"",actor_name:"",actor_access:"",employee:"",action:"",source:"" });

async function checked(res) {
  if (res.ok) return res;
  let message = "Unable to load audit details.";
  try { const result = await res.json(); message = result.error || message; }
  catch { message += " (" + res.status + ")"; }
  throw Error(message);
}

export default function DeveloperUsageExplorer({ accessToken, email, appliedRange }) {
  const [mode, setMode] = useState("edits");
  const [draft, setDraft] = useState(empty);
  const [applied, setApplied] = useState(empty);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const mock = import.meta.env.DEV && ["localhost","127.0.0.1"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get("mockUsage") === "1";

  function params(format) {
    const p = new URLSearchParams({ mode,page:String(page),limit:"50",...applied });
    if (appliedRange.startDate) p.set("start_date",appliedRange.startDate);
    if (appliedRange.endDate) p.set("end_date",appliedRange.endDate);
    if (format) p.set("format",format);
    return p;
  }
  const headers = {
    "x-developer-email":email.trim().toLowerCase(),
    "x-usage-access-token":accessToken
  };

  useEffect(() => {
    if (mock) return undefined;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setError(""); setExpanded(null);
    fetch("/api/developer-audit?" + params(), {
      method:"GET",cache:"no-store",headers,signal:controller.signal
    }).then(checked).then((r) => r.json()).then((data) => {
      if (!active) return;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setMore(Boolean(data.has_more));
    }).catch((e) => {
      if (!active || e.name === "AbortError") return;
      setError(e.message); setRows([]); setMore(false);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active=false; controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode,applied,page,refresh,appliedRange.startDate,appliedRange.endDate,mock]);

  function chooseMode(next) {
    setMode(next); setDraft(empty()); setApplied(empty()); setPage(1);setExpanded(null);
  }
  async function downloadCsv() {
    if (!appliedRange.startDate || !appliedRange.endDate) {
      setError("Select a start and end date above and click Apply Filters before exporting.");return;
    }
    setExporting(true);setError("");
    try {
      const r = await fetch("/api/developer-audit?" + params("csv"), {
        method:"GET",cache:"no-store",headers
      });
      await checked(r);
      const url = URL.createObjectURL(await r.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "Magnemite_" + (mode==="edits" ? "Saved_Edits" : "Action_Details") +
        "_" + appliedRange.startDate + "_to_" + appliedRange.endDate + ".csv";
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url),1000);
    } catch (e) { setError(e.message || "Export failed."); }
    finally { setExporting(false); }
  }

  if (mock) return <section style={panel}><h2>Detailed Activity Explorer</h2>
    <p>Live saved edits are unavailable in simulated-data mode.</p></section>;

  return (
    <section style={panel}>
      <h2>Detailed Activity Explorer</h2>
      <p style={{color:"#64748b"}}>
        Filter application actions or inspect real saved changes with before-and-after values.
        The payroll-period summary above remains unfiltered.
      </p>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:18}}>
        {[
          ["edits","Saved Time-Log Edits"],["events","Application Actions"]
        ].map(([value,label])=>
          <button type="button" key={value} aria-pressed={mode===value}
            onClick={()=>chooseMode(value)}
            style={{...button,background:mode===value?"#2563eb":"#475569"}}>{label}</button>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginBottom:16}}>
        <label>Changed By — TL / Manager name
          <input style={input} type="search" value={draft.actor_name}
            onChange={e=>setDraft(f=>({...f,actor_name:e.target.value}))}
            placeholder="Search recorded editor name" /></label>
        <label>Changed By — current access level
          <select style={input} value={draft.actor_access}
            onChange={e=>setDraft(f=>({...f,actor_access:e.target.value}))}>
            <option value="">All access levels</option>
            {["TL / Manager","Team Leader","Manager","Operations Manager","Q&T Manager"].map(role=><option key={role} value={role}>{role}</option>)}
          </select></label>
        <label>User email (partial)
          <input style={input} type="search" value={draft.actor}
            onChange={e=>setDraft(f=>({...f,actor:e.target.value}))}
            placeholder="Email / domain" /></label>
        <label>{mode==="edits"?"Employee name or numeric ID":"Employee name or ID"}
          <input style={input} type="search" value={draft.employee}
            onChange={e=>setDraft(f=>({...f,employee:e.target.value}))}
            placeholder={mode==="edits"?"Name or numeric ID":"Name or ID"} /></label>
        <label>{mode==="edits"?"Database operation":"Action type"}
          <select style={input} value={draft.action}
            onChange={e=>setDraft(f=>({...f,action:e.target.value}))}>
            <option value="">All types</option>
            {(mode==="edits"
              ? ["UPDATE","INSERT","DELETE"]
              : ["Time Log Corrected","Bulk Time Logs Approved","Request Approved",
                "Request Denied","PTO Historical Balance Reconciled"]
            ).map(a=><option key={a} value={a}>{a}</option>)}
          </select></label>
        <label>Source (exact, optional)
          <input style={input} type="search" value={draft.source}
            onChange={e=>setDraft(f=>({...f,source:e.target.value}))}
            placeholder="Source identifier" /></label>
      </div>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:12}}>
        <button type="button" style={button} disabled={loading}
          onClick={()=>{setPage(1);setApplied({...draft});}}>Apply Detail Filters</button>
        <button type="button" style={{...button,background:"#475569"}} disabled={loading}
          onClick={()=>{setPage(1);setDraft(empty());setApplied(empty());}}>Clear Detail Filters</button>
        <button type="button" style={{...button,background:"#475569"}} disabled={loading}
          onClick={()=>setRefresh(n=>n+1)}>Refresh Details</button>
        <button type="button" style={{...button,background:"#047857"}} disabled={loading||exporting}
          onClick={downloadCsv}>{exporting?"Exporting...":"Download Filtered Detailed CSV"}</button>
      </div>
      <p style={{fontSize:12,color:"#64748b"}}>
        {mode==="edits"
          ? "These are persisted database audit records. The Changed By name and current access level are matched from the employee directory using the recorded actor email. This does not independently verify the historical editor. Some records have no recorded editor; automated changes remain separate by source. Saved edits support employee name or numeric ID."
          : "Activity records contain recorded action values, not necessarily the previous field values."}
        {" "}CSV includes every matching record for the selected dates (maximum 10,000 audit records).
      </p>
      {error && <p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
      {loading && <p style={{color:"#64748b"}}>Loading detailed records...</p>}
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr>{["Date / Time (CR)","Changed By","Action","Affected Employee","Source","Details"].map(h=>
            <th key={h} style={cell}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(row=>
            <React.Fragment key={mode+"-"+row.id}>
              <tr>
                <td style={cell}>{row.datetime}</td>
                <td style={cell}><strong>{row.actor_name||row.actor||"Not recorded / System"}</strong>
                  {row.actor_name&&row.actor_email&&<div style={{color:"#64748b"}}>{row.actor_email}</div>}
                  {row.actor_access&&<div style={{color:"#64748b"}}>Current access: {row.actor_access}</div>}
                  {row.actor_attribution&&<div style={{fontSize:11,color:"#64748b"}}>{row.actor_attribution}</div>}</td>
                <td style={cell}>{row.action}
                  {row.risk_flag && <div style={{color:"#b91c1c"}}>Risk flagged</div>}</td>
                <td style={cell}>{row.employee||"Not recorded"}
                  {row.employee_id && <div style={{color:"#64748b"}}>ID: {row.employee_id}</div>}</td>
                <td style={cell}>{row.source||"Not recorded"}</td>
                <td style={cell}><button type="button" style={button}
                  aria-expanded={expanded===row.id}
                  onClick={()=>setExpanded(x=>x===row.id?null:row.id)}>
                  {expanded===row.id?"Hide":"View"} {mode==="edits"?"Changes":"Details"}</button></td>
              </tr>
              {expanded===row.id && <tr><td colSpan={6} style={{...cell,background:"#f8fafc"}}>
                <strong>{mode==="edits"?"Saved before / after values":"Recorded action details"}</strong>
                <p style={{color:"#64748b",fontSize:12}}>Record ID: {row.record_id||"Not recorded"}
                  {row.risk_reason && " · Risk: "+row.risk_reason}</p>
                <div style={{overflowX:"auto"}}>
                  <table style={{borderCollapse:"collapse",width:"100%"}}>
                    <thead><tr>{(mode==="edits"?["Field","Before","After"]:["Field","Recorded Value"])
                      .map(h=><th key={h} style={cell}>{h}</th>)}</tr></thead>
                    <tbody>{mode==="edits"
                      ? row.changes?.map(d=><tr key={d.field}>
                          <td style={cell}>{d.field}</td>
                          <td style={{...cell,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{d.before||"—"}</td>
                          <td style={{...cell,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{d.after||"—"}</td>
                        </tr>)
                      : row.details?.map(d=><tr key={d.field}>
                          <td style={cell}>{d.field}</td>
                          <td style={{...cell,whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{d.recorded||"—"}</td>
                        </tr>)}</tbody>
                  </table>
                </div>
                {mode==="edits"&&!row.changes?.length && <p>No tracked fields changed.</p>}
                {mode==="events"&&!row.details?.length && <p>No additional action values were logged.</p>}
              </td></tr>}
            </React.Fragment>
          )}</tbody>
        </table>
        {!loading && !rows.length && !error &&
          <p style={{color:"#64748b"}}>No matching records found.</p>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginTop:16}}>
        <span style={{color:"#64748b",fontSize:13}}>Page {page} · Showing {rows.length} records</span>
        <div style={{display:"flex",gap:9}}>
          <button type="button" style={{...button,background:"#475569"}}
            disabled={loading||page===1} onClick={()=>setPage(n=>Math.max(1,n-1))}>Previous</button>
          <button type="button" style={button} disabled={loading||!more}
            onClick={()=>setPage(n=>n+1)}>Next</button>
        </div>
      </div>
    </section>
  );
}
