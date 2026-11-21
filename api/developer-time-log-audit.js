import { verifyDeveloper } from "./_developer-auth.js";
// Read-only committed time-log audit history; developer-only, no raw row snapshots.
const BASE=(process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||"").replace(/\/$/,"");
const KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOKEN=(process.env.APPLICATION_USAGE_ACCESS_TOKEN||"").trim();
const ALLOWED=new Set((process.env.APPLICATION_USAGE_ALLOWED_EMAILS||"").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean));
const COLUMNS=["id","changed_at","time_log_id","employee_id","operation","actor_email","actor_role","source","changed_fields","risk_flag","risk_reason"];
const CSV_COLUMNS=[...COLUMNS,"change_details"];
const FETCH_COLUMNS=[...COLUMNS,"old_data","new_data"];
const SAFE_FIELDS=new Set(["date","status","category","category_start","category_end","clock_in","clock_out","break_start","break_end","duration_minutes","approved","approval_status","approved_by","approved_at","payable_status","locked","edited_at","edited_by","scheduled_start","scheduled_end","sub_status","auto_rule"]);
function sanitize(row){const {old_data,new_data,...safe}=row; if(row.operation==="UPDATE"){const before=old_data||{},after=new_data||{};safe.changed_fields=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>SAFE_FIELDS.has(k)&&JSON.stringify(before[k])!==JSON.stringify(after[k]));safe.change_details=safe.changed_fields.filter(k=>SAFE_FIELDS.has(k)).map(k=>({field:k,before:before[k]??null,after:after[k]??null}));}else{safe.change_details=[];}return safe;}
const DATE=/^\d{4}-\d{2}-\d{2}$/;
function fail(res,status,error){return res.status(status).json({success:false,error});}
function csvCell(v){const s=Array.isArray(v)?v.join("; "):String(v??"");const safe=/^[\s\uFEFF]*[=+\-@]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"';}
export default async function handler(req,res){
 res.setHeader("Cache-Control","no-store, max-age=0");
 if(req.method!=="GET"){res.setHeader("Allow","GET");return fail(res,405,"Method not allowed");}
 if(process.env.APPLICATION_USAGE_API_ENABLED!=="true"||!BASE||!KEY||!TOKEN||!ALLOWED.size)return fail(res,503,"Audit unavailable");
  const developer=await verifyDeveloper(req).catch(()=>null);
  if(!developer)return fail(res,403,"Verified developer sign-in required");
 const q=req.query||{},start=String(q.start_date||""),end=String(q.end_date||"");
 if(!DATE.test(start)||!DATE.test(end)||start>end||Number.isNaN(Date.parse(start))||Number.isNaN(Date.parse(end)))return fail(res,400,"Valid dates required");
 if(q.format&&!["csv","json"].includes(q.format))return fail(res,400,"Unsupported format");
 const spanDays=(Date.parse(end)-Date.parse(start))/86400000;if(spanDays>31)return fail(res,400,"Limit audit queries to 32 calendar days.");
 const csv=q.format==="csv",size=csv?500:Math.max(1,Math.min(200,Math.floor(Number(q.limit)||100))),page=Math.max(1,Math.min(10000,Math.floor(Number(q.page)||1)));
 const filters={actor_email:"actor_email",actor_role:"actor_role",employee_id:"employee_id",operation:"operation",source:"source",time_log_id:"time_log_id"};
 const paramsBase=new URLSearchParams({select:FETCH_COLUMNS.join(","),order:"changed_at.desc,id.desc"});
 paramsBase.append("changed_at","gte."+start+"T00:00:00Z");
 const dayAfter=new Date(end+"T00:00:00Z");dayAfter.setUTCDate(dayAfter.getUTCDate()+1);
 paramsBase.append("changed_at","lt."+dayAfter.toISOString());
 for(const [key,col] of Object.entries(filters)){const value=String(q[key]||"").trim();if(value){if(value.length>160||/[\r\n]/.test(value))return fail(res,400,"Invalid filter: "+key);paramsBase.set(col,"eq."+value);}}
 const rows=[];
 try{
  for(let offset=csv?0:(page-1)*size;;offset+=size){
   const params=new URLSearchParams(paramsBase);params.set("limit",String(csv?size:size+1));params.set("offset",String(offset));
   const response=await fetch(BASE+"/rest/v1/time_log_audit?"+params.toString(),{headers:{apikey:KEY,Authorization:"Bearer "+KEY},cache:"no-store"});
   if(!response.ok)throw new Error("Audit query HTTP "+response.status);
   const raw=await response.json();if(!Array.isArray(raw))throw new Error("Invalid audit result");const batch=raw.map(sanitize);
   if(!csv)return res.status(200).json({success:true,rows:batch.slice(0,size),has_more:batch.length>size,page,note:"Database trigger history; actor attribution may be inferred or missing."});
   if(rows.length+batch.length>20000)return fail(res,413,"Export exceeds 20,000 records; narrow filters.");
   rows.push(...batch);if(batch.length<size)break;
  }
  const data=[CSV_COLUMNS.map(csvCell).join(","),...rows.map(row=>CSV_COLUMNS.map(col=>csvCell(col==="change_details"?JSON.stringify(row.change_details):row[col])).join(","))].join("\r\n");
  res.setHeader("Content-Type","text/csv; charset=utf-8");
  res.setHeader("Content-Disposition",'attachment; filename="Magnemite_Time_Log_Changes_'+start+'_to_'+end+'.csv"');
  res.setHeader("X-Content-Type-Options","nosniff");
  return res.status(200).send("\uFEFF"+data+"\r\n");
 }catch(err){console.error("Time-log audit query failed",err);return fail(res,502,"Unable to retrieve time-log audit");}
}
