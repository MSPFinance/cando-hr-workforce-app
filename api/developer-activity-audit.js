import { verifyDeveloper } from "./_developer-auth.js";
// Read-only, developer-restricted activity detail endpoint.
// Uses the existing v_app_usage_activity view. It does not claim that
// an activity entry proves a time-log mutation was committed.
const URL_BASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS_TOKEN = (process.env.APPLICATION_USAGE_ACCESS_TOKEN || "").trim();
const ALLOWED = new Set((process.env.APPLICATION_USAGE_ALLOWED_EMAILS || "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean));
const FIELDS = ["id","activity_date","activity_datetime","created_at_utc","actor_email","actor_name","actor_role","action_type","action_category","employee_id","employee_name","target_table","target_record_id","records_affected","employees_affected","decision","request_type","time_category","payable_status","self_action_flag","source"];
const FILTERS = { actor_email:"actor_email",actor_role:"actor_role",action_type:"action_type",action_category:"action_category",employee_id:"employee_id",target_table:"target_table",decision:"decision",payable_status:"payable_status",source:"source" };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function csvCell(value) {
  const s = String(value ?? "");
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(s) ? "'" + s : s;
  return '"' + safe.replace(/"/g, '""') + '"';
}
function fail(res, code, error) { return res.status(code).json({success:false,error}); }
export default async function handler(req,res) {
  res.setHeader("Cache-Control","no-store, max-age=0");
  if(req.method !== "GET") {res.setHeader("Allow","GET");return fail(res,405,"Method not allowed");}
  if(process.env.APPLICATION_USAGE_API_ENABLED !== "true" || !URL_BASE || !SERVICE_KEY || !ACCESS_TOKEN || !ALLOWED.size) return fail(res,503,"Developer audit API unavailable");
  const developer=await verifyDeveloper(req).catch(()=>null);
  if(!developer)return fail(res,403,"Verified developer sign-in required");
  const q = req.query || {};
  const start = String(q.start_date || "");
  const end = String(q.end_date || "");
  if(!DATE.test(start) || !DATE.test(end) || start > end || Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end))) return fail(res,400,"Valid start_date and end_date are required");
  const csv = q.format === "csv";
  if(q.format && !["csv","json"].includes(q.format)) return fail(res,400,"Unsupported format");
  const page = Math.max(1,Math.min(10000,Math.floor(Number(q.page)||1)));
  const size = csv ? 500 : Math.max(1,Math.min(200,Math.floor(Number(q.limit)||100)));
  const maxExport = 20000;
  const records = [];
  try {
    for(let offset = csv ? 0 : (page-1)*size; ; offset += size) {
      const params = new URLSearchParams({select:FIELDS.join(","),order:"activity_datetime.desc,id.desc",limit:String(csv ? size : size+1),offset:String(offset)});
      params.append("activity_date","gte."+start);
      params.append("activity_date","lte."+end);
      for(const [key,column] of Object.entries(FILTERS)) {
        const value = String(q[key] || "").trim();
        if(value) {
          if(value.length > 160 || /[\r\n]/.test(value)) return fail(res,400,"Invalid filter: "+key);
          params.set(column,"eq."+value);
        }
      }
      const response = await fetch(URL_BASE.replace(/\/$/,"")+"/rest/v1/v_app_usage_activity?"+params.toString(),{
        headers:{apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,"Content-Type":"application/json"},cache:"no-store"
      });
      if(!response.ok) throw new Error("Supabase activity query failed ("+response.status+")");
      const batch = await response.json();
      if(!Array.isArray(batch)) throw new Error("Invalid activity response");
      if(!csv) return res.status(200).json({success:true,rows:batch.slice(0,size),page,page_size:size,has_more:batch.length>size,generated_at:new Date().toISOString(),note:"Activity entries are not proof of persisted time-log changes."});
      if(records.length+batch.length>maxExport) return fail(res,413,"Export exceeds 20,000 rows; narrow the date range or filters.");
      records.push(...batch);
      if(batch.length<size) break;
    }
    const lines = [FIELDS.map(csvCell).join(","),...records.map(row=>FIELDS.map(key=>csvCell(row[key])).join(","))];
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="Magnemite_Developer_Audit_'+start+'_to_'+end+'.csv"');
    res.setHeader("X-Content-Type-Options","nosniff");
    return res.status(200).send("\uFEFF"+lines.join("\r\n")+"\r\n");
  } catch(err) {
    console.error("Developer audit read failed",err);
    return fail(res,502,"Unable to retrieve activity from Supabase");
  }
}
