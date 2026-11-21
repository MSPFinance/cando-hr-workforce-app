/*
 * Developer-only, read-only explorer of saved Magnemite activity and time-log
 * audit records. The service key never leaves the server.
 */
import { timingSafeEqual } from "node:crypto";

const SUPABASE_URL = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const ACCESS_TOKEN = String(process.env.APPLICATION_USAGE_ACCESS_TOKEN || "").trim();
const API_ENABLED = process.env.APPLICATION_USAGE_API_ENABLED === "true";
const ALLOWED_EMAILS = new Set(
  String(process.env.APPLICATION_USAGE_ALLOWED_EMAILS || "")
    .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean)
);
const FIELDS = [
  "date", "status", "sub_status", "category", "category_start", "category_end",
  "clock_in", "clock_out", "clock_in_text", "clock_out_text", "break_start",
  "break_end", "duration_minutes", "approved", "approval_status", "approved_by",
  "approved_at", "payable_status", "edited_at", "edited_by", "locked", "notes",
  "disposition_note", "scheduled_start", "scheduled_end", "schedule_break_1",
  "schedule_break_2", "schedule_lunch", "schedule_off_days", "schedule_source",
  "auto_rule", "lob", "department"
];
const EVENT_DETAILS = [
  "date", "correctedStart", "correctedEnd", "durationMinutes", "appLogId",
  "approvalStatus", "payableStatus", "category", "employeeNames",
  "employeesAffected", "recordsAffected", "requestedCount", "failedCount",
  "startDate", "endDate", "requestType", "decision", "approvedAt"
];
const AUDIT_COLUMNS = [
  "id", "time_log_id", "employee_id", "operation", "actor_email",
  "actor_role", "old_data", "new_data", "changed_at", "source",
  "risk_flag", "risk_reason"
];
const EVENT_COLUMNS = [
  "id", "activity_datetime", "activity_date", "actor_email", "actor_name",
  "actor_role", "action_type", "employee_id", "employee_name",
  "target_record_id", "target_table", "records_affected", "source", "metadata"
];
const MAX_EXPORT_RECORDS = 10000;

function authorized(req) {
  const email = String(req.headers["x-developer-email"] || "").trim().toLowerCase();
  const supplied = String(req.headers["x-usage-access-token"] || "").trim();
  if (!email || !ALLOWED_EMAILS.has(email) || !ACCESS_TOKEN || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(ACCESS_TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const t = Date.parse(value + "T00:00:00-06:00");
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value;
}

function safeText(value, label) {
  const text = String(value || "").trim();
  // No PostgREST expression delimiters, wildcards or control characters.
  if (text.length > 100 || !/^[\p{L}\p{N} .@_'/-]*$/u.test(text)) {
    throw new Error("Invalid " + label + " filter.");
  }
  return text;
}

function normalized(value) {
  if (value === undefined || value === null) return null;
  return value;
}

function humanValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function crDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Costa_Rica",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).format(new Date(value));
}

function mapRow(row, mode) {
  if (mode === "events") {
    const meta = row.metadata && typeof row.metadata === "object" &&
      !Array.isArray(row.metadata) ? row.metadata : {};
    const details = EVENT_DETAILS.filter((key) => meta[key] !== undefined)
      .map((field) => ({ field, recorded: humanValue(meta[field]) }));
    return {
      id: row.id, datetime: row.activity_datetime, actor: row.actor_name ||
        row.actor_email || "Not recorded", actor_email: row.actor_email || "",
      role: row.actor_role || "", action: row.action_type || "",
      employee: row.employee_name || "", employee_id: row.employee_id || "",
      record_id: row.target_record_id || "", source: row.source || "",
      count: row.records_affected ?? 1, details
    };
  }
  const before = row.old_data && typeof row.old_data === "object" ? row.old_data : {};
  const after = row.new_data && typeof row.new_data === "object" ? row.new_data : {};
  const changes = FIELDS.filter((field) =>
    JSON.stringify(normalized(before[field])) !== JSON.stringify(normalized(after[field]))
  ).map((field) => ({
    field, before: humanValue(before[field]), after: humanValue(after[field])
  }));
  return {
    id: row.id, datetime: crDateTime(row.changed_at),
    datetime_utc: row.changed_at, actor: row.actor_email || "Not recorded / System",
    actor_email: row.actor_email || "", role: row.actor_role || "",
    action: row.operation || "", employee: after.employee_name ||
      before.employee_name || "", employee_id: row.employee_id || "",
    record_id: row.time_log_id || "", source: row.source || "",
    count: 1, risk_flag: Boolean(row.risk_flag),
    risk_reason: row.risk_reason || "", changes
  };
}

function filtersForRequest(req) {
  const mode = String(req.query?.mode || "edits");
  if (!["events", "edits"].includes(mode)) throw new Error("Invalid view.");
  const start = String(req.query?.start_date || "");
  const end = String(req.query?.end_date || "");
  if ((start && !validDate(start)) || (end && !validDate(end)) ||
      (start && end && start > end)) throw new Error("Invalid date range.");
  const actor = safeText(req.query?.actor, "user");
  const employee = safeText(req.query?.employee, "employee");
  const action = safeText(req.query?.action, "action");
  const source = safeText(req.query?.source, "source");
  if (action && !((mode === "edits" && ["UPDATE", "INSERT", "DELETE"].includes(action)) ||
      (mode === "events" && [
        "Time Log Corrected", "Bulk Time Logs Approved", "Request Approved",
        "Request Denied", "PTO Historical Balance Reconciled"
      ].includes(action)))) throw new Error("Invalid action type.");
  return { mode, start, end, actor, employee, action, source };
}

function buildParams(f, offset, count) {
  const p = new URLSearchParams();
  const edits = f.mode === "edits";
  p.set("select", (edits ? AUDIT_COLUMNS : EVENT_COLUMNS).join(","));
  p.set("order", edits ? "changed_at.desc,id.desc" : "activity_datetime.desc,id.desc");
  p.set("limit", String(count));
  p.set("offset", String(offset));
  if (edits) {
    if (f.start) p.append("changed_at", "gte." + new Date(f.start + "T00:00:00-06:00").toISOString());
    if (f.end) p.append("changed_at", "lt." + new Date(Date.parse(f.end + "T00:00:00-06:00") + 86400000).toISOString());
  } else {
    if (f.start) p.append("activity_date", "gte." + f.start);
    if (f.end) p.append("activity_date", "lte." + f.end);
  }
  if (f.actor) p.set("actor_email", "ilike.*" + f.actor + "*");
  if (f.employee) {
    if (edits) {
      // Numeric searches use employee_id; names use the saved JSON snapshot.
      // This keeps filtering server-side before pagination and CSV exports.
      if (/^\d+$/.test(f.employee)) {
        p.set("employee_id", "ilike.*" + f.employee + "*");
      } else {
        p.set("new_data->>employee_name", "ilike.*" + f.employee + "*");
      }
    } else {
      p.set("or", "(employee_name.ilike.*" + f.employee +
        "*,employee_id.ilike.*" + f.employee + "*)");
    }
  }
  if (f.action) p.set(edits ? "operation" : "action_type", "eq." + f.action);
  if (f.source) p.set("source", "eq." + f.source);
  return p;
}

async function queryRows(f, offset, limit) {
  const table = f.mode === "edits" ? "time_log_audit" : "v_app_usage_activity";
  const url = SUPABASE_URL + "/rest/v1/" + table + "?" + buildParams(f, offset, limit);
  const result = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: "Bearer " + SERVICE_KEY,
      Accept: "application/json"
    },
    cache: "no-store"
  });
  if (!result.ok) {
    // Never echo provider errors containing account or database details to callers.
    console.error("Developer audit upstream request failed", result.status,
      (await result.text()).slice(0, 300));
    throw new Error("Unable to load protected audit records.");
  }
  const data = await result.json();
  if (!Array.isArray(data)) throw new Error("Unexpected audit response.");
  return data.map((row) => mapRow(row, f.mode));
}

function csvCell(value) {
  const raw = humanValue(value);
  const safe = /^[\s\uFEFF]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function csvFile(rows, mode) {
  const columns = [
    "Date / Time (Costa Rica)", "User", "User Email", "Role", "Action",
    "Affected Employee", "Employee ID", "Saved Record ID", "Source",
    "Records Affected", "Detail Type", "Field", "Before", "After / Recorded",
    "Risk Flag", "Risk Reason"
  ];
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    const details = mode === "edits"
      ? row.changes.map((d) => ({
          type: "Saved field change", field: d.field,
          before: d.before, after: d.after
        }))
      : row.details.map((d) => ({
          type: "Action metadata (previous value not captured)", field: d.field,
          before: "Not captured", after: d.recorded
        }));
    for (const d of details.length ? details : [{ type: mode === "edits" ?
      "Saved audit event (no tracked fields changed)" : "Activity event",
      field: "", before: "", after: "" }]) {
      lines.push([
        row.datetime, row.actor, row.actor_email, row.role, row.action,
        row.employee, row.employee_id, row.record_id, row.source, row.count,
        d.type, d.field, d.before, d.after, row.risk_flag || false,
        row.risk_reason || ""
      ].map(csvCell).join(","));
    }
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!API_ENABLED || !SUPABASE_URL || !SERVICE_KEY || !ACCESS_TOKEN || !ALLOWED_EMAILS.size)
    return res.status(503).json({ success: false, error: "Developer reporting unavailable." });
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }
  if (!authorized(req))
    return res.status(403).json({ success: false, error: "Developer access not authorized." });
  let f;
  try {
    f = filtersForRequest(req);
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
  try {
    if (req.query?.format === "csv") {
      if (!f.start || !f.end) return res.status(400).json({
        success: false, error: "Select a start and end date before exporting."
      });
      const all = [];
      while (true) {
        const batch = await queryRows(f, all.length, 500);
        if (all.length + batch.length > MAX_EXPORT_RECORDS)
          return res.status(413).json({
            success: false,
            error: "More than 10,000 saved records match. Narrow the date or employee filter."
          });
        all.push(...batch);
        if (batch.length < 500) break;
      }
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition",
        'attachment; filename="Magnemite_' + (f.mode === "edits" ? "Saved_Edits" : "Activity_Details") +
          "_" + f.start + "_to_" + f.end + '.csv"');
      return res.status(200).send(csvFile(all, f.mode));
    }
    const page = Math.min(5000, Math.max(1, Math.floor(Number(req.query?.page) || 1)));
    const requested = Math.min(100, Math.max(1, Math.floor(Number(req.query?.limit) || 50)));
    const rows = await queryRows(f, (page - 1) * requested, requested + 1);
    return res.status(200).json({
      success: true, mode: f.mode, page, page_size: requested,
      has_more: rows.length > requested, rows: rows.slice(0, requested)
    });
  } catch (error) {
    console.error("Developer audit explorer:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
