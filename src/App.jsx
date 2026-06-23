import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BarChart3,
  CalendarDays,
  CheckCircle,
  Clock,
  Database,
  Download,
  FileCheck,
  Search,
  Upload,
  Users,
  XCircle,
  Settings,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const today = new Date().toISOString().slice(0, 10);
const DAILY_TIMER_STOP_TIME = "23:59";
const LOGO = "/cando-logo.png";

// DEMO MODE CONFIGURATION
// For demo/testing purposes this is intentionally blank so the app uses the built-in demo users below.
// When you are ready to reconnect live Google Sheets, replace "" with your working /exec Apps Script URL.
const GOOGLE_API_URL = import.meta.env.VITE_GOOGLE_API_URL || "";

// WORKFORCE PLANNING SHEET SYNC
// Source: Google Sheet tab "New Team Roster(Lucho)" in GoDay & LC Team Schedules.
// This reads approved operational fields from the shared workforce sheet while protecting identity/auth fields.
// Protected fields that are NEVER overwritten by this sync: email, password/temp_password, role, access_level, hire_date, birthday, and employee id.
const WORKFORCE_SYNC_SHEET_ID = "1cmYlztzC9oc8z6LSD6ER_UqU2F17Lq7fiMAAWLnMy5s";
const WORKFORCE_SYNC_SHEET_NAMES = ["Roster"];
const WORKFORCE_BREAKS_SHEET_NAMES = ["Breaks"];
const WORKFORCE_BALANCES_SHEET_NAMES = ["employee_balances"];
const WORKFORCE_SYNC_AUTOMATIC_ENABLED = true;
const WORKFORCE_SYNC_SCHEDULE_DAY = 6; // Saturday, based on local browser time.
const WORKFORCE_SYNC_SCHEDULE_TIME = "05:00"; // Saturday morning sync window.
const WORKFORCE_SYNC_LAST_RUN_KEY = "candoHrLastSaturdayWorkforceSync";
const ATTENDANCE_DAILY_EMAILS_ENABLED = true;
const DEFAULT_ATTENDANCE_EMAIL_SETTINGS = {
  enabled: true,
  deliveryMode: "Daily Summary",
  sendTime: "09:00",
  sendOnFirstLog: true,
  includeManager: true,
  includeSupervisor: true,
  includeHrWfm: true,
  hrWfmEmails: "",
  lobFilter: "All",
};
const WORKFORCE_SYNC_ALLOWED_FIELDS = [
  "country",
  "lob",
  "department",
  "sub_department",
  "supervisor",
  "manager",
  "employment_status",
  "employment_type",
  "off_days",
  "shift_start",
  "shift_end",
  "break_start",
  "break_end",
  "lunch_start",
  "lunch_end",
  "second_break_start",
  "second_break_end",
  "break_minutes",
  "lunch_minutes",
  "breaks_by_day",
  "pto_balance",
  "sick_balance",
  "vto_balance",
  "pto_balance_days",
  "sick_balance_days",
  "vto_balance_days",
];

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isWeeklyWorkforceSyncWindow(date = new Date()) {
  if (!WORKFORCE_SYNC_AUTOMATIC_ENABLED) return false;
  const currentTime = date.toTimeString().slice(0, 5);
  return date.getDay() === WORKFORCE_SYNC_SCHEDULE_DAY && currentTime >= WORKFORCE_SYNC_SCHEDULE_TIME;
}

// LOGIN + ROLE ACCESS
// Production path: this uses the Employees database to identify the user and role.
// For full enterprise security later, connect this to Google SSO or Supabase Auth.
const DEFAULT_LOGIN_EMAIL = "agent1@goday.ca";
const DEFAULT_LOGIN_PASSWORD = "Welcome2026!";
const ADMIN_ACCESS_LEVELS = ["TL", "Team Lead", "Supervisor", "Manager", "Approvals", "Reporting", "HR", "Payroll", "Admin", "Executive"];
const OT_REQUESTS_ENABLED = false;
const EARLY_SHIFT_START_GRACE_MINUTES = 5;
const REQUEST_TYPE_OPTIONS = ["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave"];

const ROLE_PROFILE_OPTIONS = ["Employee", "TL", "Manager", "Approvals", "Reporting", "HR", "Payroll", "Admin", "Executive"];

const ROLE_ACCESS_PROFILES = {
  Employee: { label: "Agent", tasks: ["My Portal", "Start/End Shift", "Status Logs", "PTO/VTO/Sick Requests"], tabs: ["agent"] },
  TL: { label: "Supervisor / Team Lead", tasks: ["Team Review", "Time Edits", "Approvals Queue", "Live Floor View", "Basic Reporting"], tabs: ["agent", "dashboard", "schedule", "time", "requests", "manager", "reporting"] },
  Manager: { label: "Approvals", tasks: ["Approvals Queue", "Schedule Review", "Payroll Review", "Reporting", "Rules"], tabs: ["agent", "dashboard", "employees", "schedule", "time", "requests", "manager", "payroll", "reporting", "rules"] },
  HR: { label: "HR", tasks: ["Employee Records", "Status Review", "Reporting"], tabs: ["agent", "dashboard", "employees", "reporting"] },
  Payroll: { label: "Payroll", tasks: ["Payroll Review", "Approved Time", "Country/Holiday Review"], tabs: ["agent", "dashboard", "payroll", "reporting"] },
  Admin: { label: "Admin", tasks: ["Full Admin Access", "Settings", "Rules", "Schedules", "Approvals", "Payroll"], tabs: ["agent", "dashboard", "employees", "schedule", "time", "requests", "manager", "payroll", "reporting", "rules"] },
  Executive: { label: "Executive", tasks: ["Executive Dashboard", "Reporting", "Productivity"], tabs: ["agent", "dashboard", "reporting"] },
  Reporting: { label: "Reporting", tasks: ["Reports", "Payroll Planning", "Schedule Visibility"], tabs: ["agent", "dashboard", "payroll", "reporting", "schedule"] },
};

// Schedule fields are treated as the employee's fixed master schedule.
// Agent clicks can create actual time logs, but they must never overwrite these fields.
const SCHEDULE_FIELDS = [
  "shift_start",
  "shift_end",
  "break_start",
  "break_end",
  "lunch_start",
  "lunch_end",
  "second_break_start",
  "second_break_end",
  "off_days",
  "sub_department",
];

const DEMO_ACCOUNTS = [
  { label: "Agent", email: "agent1@goday.ca", password: "Cando123!", access: "Employee portal only" },
  { label: "Team Lead", email: "tl@goday.ca", password: "Cando123!", access: "Team lead / admin access" },
  { label: "Approvals", email: "manager@goday.ca", password: "Cando123!", access: "Approvals, reporting, rules" },
  { label: "HR", email: "hr@goday.ca", password: "Cando123!", access: "Employee records and HR review" },
  { label: "Payroll", email: "payroll@goday.ca", password: "Cando123!", access: "Payroll review and exceptions" },
  { label: "Admin", email: "admin@goday.ca", password: "Cando123!", access: "Full admin access" },
  { label: "Executive", email: "executive@goday.ca", password: "Cando123!", access: "Executive reporting view" },
];

const lobSeed = ["GoDay", "Lending Creative"];
const departmentSeed = ["Operations", "Customer Service", "Collections", "QA", "Training", "Compliance", "HR", "Payroll"];
const operationsSubDepartmentSeed = ["Customer Service", "Collections", "CLS", "Documents", "SME"];

const countryHolidaySeed = [
  { country: "Costa Rica", holiday_name: "New Year", holiday_date: `${new Date().getFullYear()}-01-01`, is_paid: true },
  { country: "Canada", holiday_name: "New Year", holiday_date: `${new Date().getFullYear()}-01-01`, is_paid: true },
];
const defaultOffDays = "Saturday, Sunday";

const employeesSeed = [
  {
    id: "EMP-001",
    full_name: "Sample Agent One",
    email: "agent1@goday.ca",
    country: "Costa Rica",
    department: "Operations",
    sub_department: "Customer Service",
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "Sample TL",
    manager: "Operations Manager",
    hire_date: "2024-03-15",
    birthday: "1995-06-12",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:00",
    break_end: "10:15",
    lunch_start: "12:00",
    lunch_end: "13:00",
    second_break_start: "15:00",
    second_break_end: "15:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 40,
    sick_balance: 16,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-002",
    full_name: "Sample Team Lead",
    email: "tl@goday.ca",
    country: "Canada",
    department: "Operations",
    sub_department: "Collections",
    lob: "Lending Creative",
    role: "Team Lead",
    access_level: "TL",
    supervisor: "Operations Manager",
    manager: "Director of Operations",
    hire_date: "2022-09-01",
    birthday: "1990-11-02",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "09:00",
    shift_end: "18:00",
    break_start: "11:00",
    break_end: "11:15",
    lunch_start: "13:00",
    lunch_end: "14:00",
    second_break_start: "16:00",
    second_break_end: "16:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 80,
    sick_balance: 24,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-003",
    full_name: "Sample Agent Two",
    email: "agent2@goday.ca",
    country: "Costa Rica",
    department: "Operations",
    sub_department: "Customer Service",
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "Sample TL",
    manager: "Operations Manager",
    hire_date: "2023-01-10",
    birthday: "1994-08-20",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:15",
    break_end: "10:30",
    lunch_start: "12:30",
    lunch_end: "13:30",
    second_break_start: "15:15",
    second_break_end: "15:30",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 56,
    sick_balance: 24,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-004",
    full_name: "Sample Manager",
    email: "manager@goday.ca",
    country: "Canada",
    department: "Operations",
    sub_department: "Customer Service",
    lob: "GoDay",
    role: "Approvals",
    access_level: "Approvals",
    supervisor: "Director of Operations",
    manager: "Executive Team",
    hire_date: "2021-05-03",
    birthday: "1988-04-15",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:00",
    break_end: "10:15",
    lunch_start: "12:00",
    lunch_end: "13:00",
    second_break_start: "15:00",
    second_break_end: "15:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 96,
    sick_balance: 32,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-005",
    full_name: "Sample HR",
    email: "hr@goday.ca",
    country: "Costa Rica",
    department: "HR",
    sub_department: "HR",
    lob: "GoDay",
    role: "HR",
    access_level: "HR",
    supervisor: "Executive Team",
    manager: "Executive Team",
    hire_date: "2020-02-10",
    birthday: "1987-09-18",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:00",
    break_end: "10:15",
    lunch_start: "12:00",
    lunch_end: "13:00",
    second_break_start: "15:00",
    second_break_end: "15:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 120,
    sick_balance: 40,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-006",
    full_name: "Sample Payroll",
    email: "payroll@goday.ca",
    country: "Canada",
    department: "Payroll",
    sub_department: "Payroll",
    lob: "Lending Creative",
    role: "Payroll",
    access_level: "Payroll",
    supervisor: "Finance Manager",
    manager: "Executive Team",
    hire_date: "2019-07-22",
    birthday: "1985-12-05",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "09:00",
    shift_end: "18:00",
    break_start: "11:00",
    break_end: "11:15",
    lunch_start: "13:00",
    lunch_end: "14:00",
    second_break_start: "16:00",
    second_break_end: "16:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 88,
    sick_balance: 24,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-007",
    full_name: "System Admin",
    email: "admin@goday.ca",
    country: "Costa Rica",
    department: "Compliance",
    sub_department: "Compliance",
    lob: "GoDay",
    role: "Admin",
    access_level: "Admin",
    supervisor: "Executive Team",
    manager: "Executive Team",
    hire_date: "2018-01-08",
    birthday: "1984-03-30",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:00",
    break_end: "10:15",
    lunch_start: "12:00",
    lunch_end: "13:00",
    second_break_start: "15:00",
    second_break_end: "15:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 120,
    sick_balance: 40,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
  {
    id: "EMP-008",
    full_name: "Executive User",
    email: "executive@goday.ca",
    country: "Canada",
    department: "Executive",
    sub_department: "Executive",
    lob: "Lending Creative",
    role: "Executive",
    access_level: "Executive",
    supervisor: "Board",
    manager: "Board",
    hire_date: "2017-11-01",
    birthday: "1980-01-22",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "09:00",
    shift_end: "18:00",
    break_start: "11:00",
    break_end: "11:15",
    lunch_start: "13:00",
    lunch_end: "14:00",
    second_break_start: "16:00",
    second_break_end: "16:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 160,
    sick_balance: 40,
    vto_balance: 0,
    temp_password: "Cando123!",
  },
];

const rulesSeed = [
  {
    id: "RULE-001",
    department: "Operations",
    sub_department: "Customer Service",
    lob: "GoDay",
    shift_start: "08:00",
    shift_end: "17:00",
    max_pto_out: 2,
    max_vto_out: 1,
    max_sick_out: 3,
    min_staff_required: 8,
    notes: "Default weekday staffing rule",
  },
  {
    id: "RULE-002",
    department: "Operations",
    sub_department: "Collections",
    lob: "Lending Creative",
    shift_start: "09:00",
    shift_end: "18:00",
    max_pto_out: 1,
    max_vto_out: 1,
    max_sick_out: 2,
    min_staff_required: 6,
    start_date: today,
    end_date: "",
    recurrence: "Daily",
    notes: "Default LC staffing rule",
  },
];

const timeCategories = [
  "Working",
  "Break",
  "Lunch",
  "Meeting",
  "Training",
  "Bathroom",
  "Coaching",
  "System Issue",
  "PTO",
  "VTO",
  "Other",
  // System-managed categories below are intentionally kept in code for reporting and automation,
  // but disabled from manual selection in the UI.
  "Overtime",
  "Early Unscheduled",
  "Off-Day Unscheduled",
];

const SYSTEM_MANAGED_TIME_CATEGORIES = ["Overtime", "Early Unscheduled", "Off-Day Unscheduled"];

const ROLE_ACCESS = {
  Employee: ["portal"],
  Agent: ["portal"],
  Supervisor: ["portal", "dashboard", "schedule", "time", "requests", "approvals", "reporting"],
  "Team Lead": ["portal", "dashboard", "schedule", "time", "requests", "approvals", "reporting"],
  Manager: ["portal", "dashboard", "employees", "schedule", "time", "requests", "approvals", "payroll", "reporting", "rules"],
  Reporting: ["portal", "dashboard", "employees", "schedule", "time", "requests", "approvals", "payroll", "reporting"],
  HR: ["portal", "dashboard", "employees", "schedule", "time", "requests", "approvals", "payroll", "reporting", "rules"],
  Payroll: ["portal", "dashboard", "payroll", "reporting"],
  Admin: ["portal", "dashboard", "employees", "schedule", "time", "requests", "approvals", "payroll", "reporting", "rules"],
};

function canAccess(role, area) {
  return (ROLE_ACCESS[role] || []).includes(area);
}

function canEditSchedules(role) {
  return ["TL", "Team Lead", "Supervisor", "Manager", "Reporting", "HR", "Admin"].includes(role);
}

function canEditTimeLogs(role) {
  return ["TL", "Team Lead", "Supervisor", "Manager", "Reporting", "HR", "Payroll", "Admin"].includes(role);
}

function isSystemManagedTimeCategory(category) {
  return SYSTEM_MANAGED_TIME_CATEGORIES.includes(category);
}
function TimeCategoryOptions() {
  return timeCategories.map((category) => (
    <option key={category} value={category} disabled={isSystemManagedTimeCategory(category)}>
      {isSystemManagedTimeCategory(category) ? `${category} (Automatic only)` : category}
    </option>
  ));
}

const timeSeed = [
  {
    id: "TIME-001",
    employee_id: "EMP-001",
    employee_name: "Sample Agent One",
    date: today,
    scheduled_start: "08:00",
    scheduled_end: "17:00",
    clock_in: "08:04",
    clock_out: "17:01",
    category: "Working",
    category_start: "08:04",
    category_end: "10:00",
    approved: "Pending",
    lob: "GoDay",
    department: "Operations",
    notes: "Production time",
  },
  {
    id: "TIME-002",
    employee_id: "EMP-001",
    employee_name: "Sample Agent One",
    date: today,
    scheduled_start: "08:00",
    scheduled_end: "17:00",
    clock_in: "08:04",
    clock_out: "17:01",
    category: "Break",
    category_start: "10:00",
    category_end: "10:15",
    approved: "Approved",
    lob: "GoDay",
    department: "Operations",
    notes: "Morning break",
  },
  {
    id: "TIME-003",
    employee_id: "EMP-002",
    employee_name: "Sample Team Lead",
    date: today,
    scheduled_start: "09:00",
    scheduled_end: "18:00",
    clock_in: "09:00",
    clock_out: "18:00",
    category: "Meeting",
    category_start: "11:00",
    category_end: "11:45",
    approved: "Approved",
    lob: "Lending Creative",
    department: "Operations",
    notes: "Team meeting",
  },
  {
    id: "TIME-004",
    employee_id: "EMP-003",
    employee_name: "Sample Agent Two",
    date: today,
    scheduled_start: "08:00",
    scheduled_end: "17:00",
    clock_in: "08:01",
    clock_out: "17:30",
    category: "Overtime",
    category_start: "17:00",
    category_end: "17:30",
    approved: "Pending",
    lob: "GoDay",
    department: "Customer Service",
    notes: "End of day support",
  },
];

const activitySeed = [
  {
    id: "ACT-001",
    employee_id: "EMP-001",
    employee_name: "Sample Agent One",
    date: today,
    action: "Shift Started",
    time: "08:04",
    status: "Working",
    lob: "GoDay",
    department: "Operations",
  },
];

const requestsSeed = [
  {
    id: "REQ-001",
    employee_id: "EMP-001",
    employee_name: "Sample Agent One",
    type: "PTO",
    start_date: today,
    end_date: today,
    hours: 8,
    reason: "Personal time off",
    status: "Pending",
    manager: "Sample TL",
    current_balance: 40,
    projected_balance: 32,
    requested_days: 1,
  },
];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === null || value === undefined) return false;
  const normalized = String(value).trim().toLowerCase();
  return ["true", "yes", "y", "1", "required", "pending"].includes(normalized);
}

function timeToMinutes(value) {
  const formatted = formatMilitaryTime(value);
  if (!formatted || typeof formatted !== "string") return null;
  const match = formatted.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function minutesBetween(start, end) {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return 0;
  const diff = endMinutes - startMinutes;
  return Number.isFinite(diff) ? Math.max(0, diff) : 0;
}

function formatMinutes(minutes) {
  return `${safeNumber(minutes, 0)} min`;
}

function formatHours(minutes) {
  const value = safeNumber(minutes, 0);
  const hours = value / 60;
  return `${hours.toFixed(hours % 1 === 0 ? 0 : 2)}h`;
}

function csv(rows, headers) {
  const safe = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((h) => safe(row[h])).join(","))].join("\n");
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function tenure(hireDate) {
  if (!hireDate) return "N/A";
  const start = new Date(hireDate);
  const now = new Date();
  const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
  return `${Math.floor(months / 12)}y ${months % 12}m`;
}

function formatMilitaryTime(value) {
  if (value === null || value === undefined || value === "") return "";
  const textValue = String(value).trim();
  if (!textValue || textValue.toLowerCase() === "not available" || textValue.toLowerCase() === "n/a") return "Not Available";

  if (typeof value === "number") {
    const fraction = value >= 1 ? value % 1 : value;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const raw = textValue;
  const ampm = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (ampm) {
    let hours = Number(ampm[1]);
    const minutes = String(Number(ampm[2] || 0)).padStart(2, "0");
    const meridian = ampm[3].toUpperCase();
    if (meridian === "PM" && hours < 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  const cleanTime = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (cleanTime) {
    const hours = String(Number(cleanTime[1])).padStart(2, "0");
    return `${hours}:${cleanTime[2]}`;
  }

  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  return raw;
}

function formatTimeRange(start, end) {
  const formattedStart = formatMilitaryTime(start);
  const formattedEnd = formatMilitaryTime(end);
  if (!formattedStart || !formattedEnd || formattedStart === "Not Available" || formattedEnd === "Not Available") return "Not Available";
  return `${formattedStart} - ${formattedEnd}`;
}

function formatDateOnly(value) {
  if (!value) return "";
  if (typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toISOString().slice(0, 10);
}

function requestDaysInclusive(startDate, endDate) {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function calculateRequestHours(request) {
  // PTO/VTO/Sick approvals are tracked as full days.
  // The existing Hours_Requested field is retained for Google Sheets compatibility,
  // but the value now represents requested days in the UI and approval workflow.
  return requestDaysInclusive(request.start_date, request.end_date);
}

function getBalance(employee, type) {
  if (type === "PTO") return balanceDays(employee, "PTO");
  if (type === "Sick Leave") return balanceDays(employee, "Sick Leave");
  if (type === "VTO") return balanceDays(employee, "VTO");
  return null;
}

function balanceField(type) {
  if (type === "PTO") return "pto_balance_days";
  if (type === "Sick Leave") return "sick_balance_days";
  if (type === "VTO") return "vto_balance_days";
  return null;
}

function groupBy(items, keyGetter) {
  const map = new Map();
  items.forEach((item) => {
    const key = keyGetter(item) || "Unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return map;
}

function cleanId(prefix) {
  return `${prefix}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsvText(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  if (!lines.length) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function firstValue(row, keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    const value = row?.[normalized];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function normalizeNameKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeIdKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDayName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  const match = WEEK_DAYS.find((day) => day.toLowerCase() === raw || day.slice(0, 3).toLowerCase() === raw.slice(0, 3));
  return match || raw.charAt(0).toUpperCase() + raw.slice(1);
}

function splitTimeRange(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.toLowerCase() === "not available" || raw.toLowerCase() === "n/a") return { start: "", end: "" };
  const parts = raw.split(/\s*[-–—]\s*/).map((part) => part.trim()).filter(Boolean);
  return { start: parts[0] || "", end: parts[1] || "" };
}

function mapWorkforceSyncRow(row) {
  const employeeId = String(firstValue(row, ["Employee_ID", "Employee ID", "ID", "employee_id", "Employee Id"]) || "").trim();
  const fullName = String(firstValue(row, ["Full_Name", "Full Name", "Employee", "Employee Name", "Name", "Agent", "Agent Name"]) || "").trim();
  const sourceEmail = String(firstValue(row, ["Email", "Auth_Email", "Work Email", "Company Email"]) || "").trim();

  if (!employeeId && !fullName && !sourceEmail) return null;

  const payload = {};

  const setText = (field, keys) => {
    const value = firstValue(row, keys);
    if (String(value || "").trim() !== "") payload[field] = String(value).trim();
  };

  const setTime = (field, keys) => {
    const value = firstValue(row, keys);
    if (String(value || "").trim() !== "") payload[field] = formatMilitaryTime(value);
  };

  const setNumber = (field, keys) => {
    const value = firstValue(row, keys);
    if (String(value || "").trim() === "") return;
    const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numericValue)) payload[field] = numericValue;
  };

  setText("country", ["Country", "Site", "Location"]);
  setText("lob", ["LOB", "Line of Business", "Line_Of_Business", "Client"]);
  setText("department", ["Department", "Team", "Area"]);
  setText("sub_department", ["Sub_Department", "Sub Department", "SubDepartment", "Sub Team", "Queue", "Role"]);
  setText("supervisor", ["Supervisor", "TL", "Team_Leader", "Team Leader", "Team Lead", "Direct Supervisor"]);
  setText("manager", ["Manager", "Operations Manager", "OM"]);
  setText("employment_status", ["Employment_Status", "Employment Status", "Status"]);
  setText("employment_type", ["Employment_Type", "Employment Type"]);
  setText("off_days", ["Off_Days", "Off Days", "Rest Days", "Days Off"]);

  setTime("shift_start", ["Start Time (EST)", "Shift_Start", "Shift Start", "Scheduled_Shift_Start", "Scheduled Shift Start", "Start Time"]);
  setTime("shift_end", ["End Time (EST)", "Shift_End", "Shift End", "Scheduled_Shift_End", "Scheduled Shift End", "End Time"]);

  const shiftRange = splitTimeRange(firstValue(row, ["Shift", "Schedule", "Scheduled Shift"]));
  if (!payload.shift_start && shiftRange.start) payload.shift_start = formatMilitaryTime(shiftRange.start);
  if (!payload.shift_end && shiftRange.end) payload.shift_end = formatMilitaryTime(shiftRange.end);

  setNumber("pto_balance_days", ["Available days", "Available Days", "PTO_Balance_Days", "PTO Balance Days", "Vacation Balance", "Vacation_Balance"]);
  setNumber("pto_balance", ["PTO_Balance", "PTO Balance", "PTO Hours"]);
  if (payload.pto_balance_days !== undefined && payload.pto_balance === undefined) payload.pto_balance = payload.pto_balance_days * 8;

  setNumber("sick_balance_days", ["Sick_Balance_Days", "Sick Balance Days", "Sick Days"]);
  setNumber("vto_balance_days", ["VTO_Balance_Days", "VTO Balance Days", "VTO Days"]);

  setNumber("break_minutes", ["Break_Minutes", "Break Minutes", "Break Min"]);
  setNumber("lunch_minutes", ["Lunch_Minutes", "Lunch Minutes", "Lunch Min"]);

  return { employeeId, fullName, sourceEmail, payload };
}

async function fetchWorkforceSheetRows() {
  if (!WORKFORCE_SYNC_SHEET_ID) return [];

  for (const sheetName of WORKFORCE_SYNC_SHEET_NAMES) {
    const url = `https://docs.google.com/spreadsheets/d/${WORKFORCE_SYNC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const text = await response.text();
      if (!text || text.toLowerCase().includes("html")) continue;

      const rows = parseCsvText(text);
      const mappedRows = rows.map(mapWorkforceSyncRow).filter(Boolean);
      if (mappedRows.length) return mappedRows;
    } catch (error) {
      console.warn(`Workforce sync sheet ${sheetName} failed:`, error?.message || error);
    }
  }

  return [];
}

function mapBreaksSyncRow(row) {
  const employeeId = String(
  firstValue(row, ["ID", "Employee_ID", "Employee ID", "Employee Id", "employee_id", "F"])
  || row.F
  || row[5]
  || ""
).trim();

const fullName = String(
  firstValue(row, ["Name", "Employee", "Employee Name", "Full Name", "A"])
  || row.A
  || row[0]
  || ""
).trim();

const day = normalizeDayName(
  firstValue(row, ["Day", "B"]) || row.B || row[1]
);

const firstBreak = splitTimeRange(
  firstValue(row, ["First Break", "Break 1", "C"]) || row.C || row[2]
);

const secondBreak = splitTimeRange(
  firstValue(row, ["Second Break", "Lunch", "Lunch Break", "Break 2", "D"]) || row.D || row[3]
);

const thirdBreak = splitTimeRange(
  firstValue(row, ["Third Break", "Break 3", "E"]) || row.E || row[4]
);
  const unavailable = "Not Available";

  return {
    employeeId,
    fullName,
    sourceEmail: "",
    payload: {
      breaks_by_day: {
        [day]: {
          first_break_start: firstBreak.start ? formatMilitaryTime(firstBreak.start) : unavailable,
          first_break_end: firstBreak.end ? formatMilitaryTime(firstBreak.end) : unavailable,
          lunch_start: secondBreak.start ? formatMilitaryTime(secondBreak.start) : unavailable,
          lunch_end: secondBreak.end ? formatMilitaryTime(secondBreak.end) : unavailable,
          second_break_start: thirdBreak.start ? formatMilitaryTime(thirdBreak.start) : unavailable,
          second_break_end: thirdBreak.end ? formatMilitaryTime(thirdBreak.end) : unavailable,
        },
      },
    },
  };
}

async function fetchBreaksSheetRows() {
  if (!WORKFORCE_SYNC_SHEET_ID) return [];

  for (const sheetName of WORKFORCE_BREAKS_SHEET_NAMES) {
    const url = `https://docs.google.com/spreadsheets/d/${WORKFORCE_SYNC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const text = await response.text();
      if (!text || text.toLowerCase().includes("html")) continue;

      const rows = parseCsvText(text);
      const mappedRows = rows.map(mapBreaksSyncRow).filter(Boolean);
      if (mappedRows.length) return mappedRows;
    } catch (error) {
      console.warn(`Breaks sync sheet ${sheetName} failed:`, error?.message || error);
    }
  }

  return [];
}

function mapBalanceSyncRow(row) {
  const employeeId = String(firstValue(row, ["Employee_ID", "Employee ID", "ID"]) || "").trim();
  const fullName = String(firstValue(row, ["Full_Name", "Full Name", "Employee", "Employee Name", "Name"]) || "").trim();
  const sourceEmail = String(firstValue(row, ["Email", "Auth_Email", "Work Email"]) || "").trim();

  if (!employeeId && !fullName && !sourceEmail) return null;

  const payload = {};
  const setNumber = (field, keys) => {
    const value = firstValue(row, keys);
    if (String(value || "").trim() === "") return;
    const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(numericValue)) payload[field] = numericValue;
  };

  setNumber("pto_balance_days", ["Available days", "Available Days", "PTO_Balance_Days", "PTO Balance Days", "PTO Days", "Vacation Balance", "Vacation_Balance"]);
  setNumber("sick_balance_days", ["Sick_Balance_Days", "Sick Balance Days", "Sick Days"]);
  setNumber("vto_balance_days", ["VTO_Balance_Days", "VTO Balance Days", "VTO Days"]);
  setNumber("pto_balance", ["PTO_Balance", "PTO Balance", "PTO Hours"]);
  setNumber("sick_balance", ["Sick_Balance", "Sick Balance", "Sick Hours"]);
  setNumber("vto_balance", ["VTO_Balance", "VTO Balance", "VTO Hours"]);

  if (payload.pto_balance_days !== undefined && payload.pto_balance === undefined) payload.pto_balance = payload.pto_balance_days * 8;
  if (payload.sick_balance_days !== undefined && payload.sick_balance === undefined) payload.sick_balance = payload.sick_balance_days * 8;
  if (payload.vto_balance_days !== undefined && payload.vto_balance === undefined) payload.vto_balance = payload.vto_balance_days * 8;

  return { employeeId, fullName, sourceEmail, payload };
}

async function fetchBalanceSheetRows() {
  if (!WORKFORCE_SYNC_SHEET_ID) return [];

  for (const sheetName of WORKFORCE_BALANCES_SHEET_NAMES) {
    const url = `https://docs.google.com/spreadsheets/d/${WORKFORCE_SYNC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) continue;

      const text = await response.text();
      if (!text || text.toLowerCase().includes("html")) continue;

      const rows = parseCsvText(text);
      const mappedRows = rows.map(mapBalanceSyncRow).filter(Boolean);
      if (mappedRows.length) return mappedRows;
    } catch (error) {
      console.warn(`Balance sync sheet ${sheetName} failed:`, error?.message || error);
    }
  }

  return [];
}

function buildEmployeeBreakRowsForSupabase(employeesList = []) {
  const rows = [];

  const cleanBreakTime = (value) => {
  if (!value || value === "Not Available" || value === "00:00" || value === "00:00:00") {
    return null;
  }
  return String(value).trim();
};

  employeesList.forEach((employee) => {
    const breaksByDay = employee.breaks_by_day || {};

    WEEK_DAYS.forEach((day) => {
      const dayBreaks = breaksByDay[day] || {};

      rows.push({
        employee_id: String(employee.id || employee.employee_id || ""),
        employee_name: employee.full_name || "",
        day_name: day,

        first_break_start: cleanBreakTime(dayBreaks.first_break_start),
first_break_end: cleanBreakTime(dayBreaks.first_break_end),

lunch_start: cleanBreakTime(dayBreaks.second_break_start),
lunch_end: cleanBreakTime(dayBreaks.second_break_end),

second_break_start: cleanBreakTime(dayBreaks.third_break_start),
second_break_end: cleanBreakTime(dayBreaks.third_break_end),

        source: "Google Sheet bBreaks Tab",
        updated_at: new Date().toISOString(),
      });
    });
  });

  return rows.filter((row) => row.employee_id);
}

function mergeWorkforceRowsIntoEmployees(currentEmployees, workforceRows, options = {}) {
  const { importMissing = true } = options;

  if (!Array.isArray(workforceRows) || !workforceRows.length) {
    return { employees: currentEmployees, updatedCount: 0, importedCount: 0, missingCount: 0 };
  }

  let updatedCount = 0;
  let importedCount = 0;
  const matchedRosterKeys = new Set();
  const usedEmployeeIds = new Set(currentEmployees.map((employee) => String(employee.id || "").trim()).filter(Boolean));

  const normalizeName = (value) => String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  const normalizeKey = (value) => String(value || "").trim().toLowerCase();
  const makeRosterKey = (row) => normalizeKey(row.employeeId) || normalizeName(row.fullName) || normalizeKey(row.sourceEmail);

  const byId = new Map();
  const byName = new Map();
  const byEmail = new Map();

  workforceRows.forEach((row) => {
    if (row.employeeId) byId.set(normalizeKey(row.employeeId), row);
    if (row.fullName) byName.set(normalizeName(row.fullName), row);
    if (row.sourceEmail) byEmail.set(normalizeKey(row.sourceEmail), row);
  });

  const buildSafePayload = (payload = {}) =>
    WORKFORCE_SYNC_ALLOWED_FIELDS.reduce((clean, field) => {
      if (payload[field] !== undefined && payload[field] !== null && payload[field] !== "") {
        clean[field] = payload[field];
      }
      return clean;
    }, {});

  const employees = currentEmployees.map((employee) => {
    const matchedRow =
      byId.get(normalizeKey(employee.id)) ||
      byName.get(normalizeName(employee.full_name)) ||
      byEmail.get(normalizeKey(employee.email));

    if (!matchedRow) return employee;

    matchedRosterKeys.add(makeRosterKey(matchedRow));
    const safePayload = buildSafePayload(matchedRow.payload);
    if (!Object.keys(safePayload).length) return employee;

    updatedCount += 1;

    return {
      ...employee,
      ...safePayload,
      full_name: employee.full_name || matchedRow.fullName || employee.full_name,
      // Protected identity/auth fields below intentionally remain from the app database.
      id: employee.id,
      email: employee.email,
      temp_password: employee.temp_password,
      role: employee.role,
      access_level: employee.access_level,
      hire_date: employee.hire_date,
      birthday: employee.birthday,
      last_sync_date: getLocalDateKey(new Date()),
      last_sync_source: "New Team Roster(Lucho)",
    };
  });

  if (importMissing) {
    workforceRows.forEach((row) => {
      const rosterKey = makeRosterKey(row);
      if (!rosterKey || matchedRosterKeys.has(rosterKey)) return;

      const safePayload = buildSafePayload(row.payload);
      const generatedIdBase = row.employeeId || `ROSTER-${String(row.fullName || "EMPLOYEE").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}`;
      let generatedId = generatedIdBase;
      let counter = 1;
      while (usedEmployeeIds.has(String(generatedId).trim())) {
        counter += 1;
        generatedId = `${generatedIdBase}-${counter}`;
      }
      usedEmployeeIds.add(String(generatedId).trim());

      employees.push({
        id: generatedId,
        full_name: row.fullName || "Roster Employee Pending Name",
        email: "", // Protected identity field. Complete manually before login access is granted.
        country: safePayload.country || "",
        lob: safePayload.lob || "",
        department: safePayload.department || "",
        sub_department: safePayload.sub_department || "",
        role: "Agent",
        access_level: "Employee",
        supervisor: safePayload.supervisor || "",
        manager: safePayload.manager || "",
        hire_date: "",
        birthday: "",
        employment_status: safePayload.employment_status || "Active",
        employment_type: safePayload.employment_type || "Full-Time",
        off_days: safePayload.off_days || defaultOffDays,
        shift_start: safePayload.shift_start || "08:00",
        shift_end: safePayload.shift_end || "17:00",
        break_start: safePayload.break_start || "10:00",
        break_end: safePayload.break_end || "10:15",
        lunch_start: safePayload.lunch_start || "12:00",
        lunch_end: safePayload.lunch_end || "13:00",
        second_break_start: safePayload.second_break_start || "15:00",
        second_break_end: safePayload.second_break_end || "15:15",
        break_minutes: safeNumber(safePayload.break_minutes, 30),
        lunch_minutes: safeNumber(safePayload.lunch_minutes, 60),
        pto_balance: 0,
        sick_balance: 0,
        vto_balance: 0,
        pto_balance_days: 0,
        sick_balance_days: 0,
        vto_balance_days: 0,
        temp_password: "",
        notes: "Imported from New Team Roster(Lucho). Add email/access details manually before production login.",
        last_sync_date: getLocalDateKey(new Date()),
        last_sync_source: "New Team Roster(Lucho)",
        ...safePayload,
      });

      importedCount += 1;
      matchedRosterKeys.add(rosterKey);
    });
  }

  return {
    employees,
    updatedCount,
    importedCount,
    missingCount: Math.max(0, workforceRows.length - matchedRosterKeys.size),
  };
}
function mergeBreakRowsIntoEmployees(currentEmployees, breakRows) {
  if (!Array.isArray(breakRows) || !breakRows.length) {
    return { employees: currentEmployees, updatedCount: 0, missingCount: 0 };
  }

  const byId = new Map();
  const byName = new Map();

  breakRows.forEach((row) => {
    if (row.employeeId) {
      const key = normalizeIdKey(row.employeeId);
      byId.set(key, [...(byId.get(key) || []), row]);
    }
    const rowName = row.fullName || row.employee_name || row.name;

if (rowName) {
      const key = normalizeNameKey(rowName);
      byName.set(key, [...(byName.get(key) || []), row]);
    }
  });

  let updatedCount = 0;
  let matchedCount = 0;

  const employees = currentEmployees.map((employee) => {
    const rows = byId.get(normalizeIdKey(employee.id)) || byName.get(normalizeNameKey(employee.full_name)) || [];
    if (!rows.length) return employee;

    matchedCount += rows.length;
    updatedCount += 1;

    const mergedBreaks = { ...(employee.breaks_by_day || {}) };
    rows.forEach((row) => {
      Object.entries(row.payload?.breaks_by_day || {}).forEach(([day, values]) => {
        const normalizedDay = normalizeDayName(day);
        if (normalizedDay) {
          mergedBreaks[normalizedDay] = { ...(mergedBreaks[normalizedDay] || {}), ...values };
        }
      });
    });

    return { ...employee, breaks_by_day: mergedBreaks, last_break_sync_date: getLocalDateKey(new Date()) };
  });

  return { employees, updatedCount, missingCount: Math.max(0, breakRows.length - matchedCount) };
}

function mergeBalanceRowsIntoEmployees(currentEmployees, balanceRows) {
  if (!Array.isArray(balanceRows) || !balanceRows.length) {
    return { employees: currentEmployees, updatedCount: 0, missingCount: 0 };
  }

  const byId = new Map();
  const byName = new Map();
  const byEmail = new Map();

  balanceRows.forEach((row) => {
    if (row.employeeId) byId.set(normalizeIdKey(row.employeeId), row);
    if (row.fullName) byName.set(normalizeNameKey(row.fullName), row);
    if (row.sourceEmail) byEmail.set(normalizeEmail(row.sourceEmail), row);
  });

  let updatedCount = 0;
  let matchedCount = 0;

  const employees = currentEmployees.map((employee) => {
    const row =
      byId.get(normalizeIdKey(employee.id)) ||
      byName.get(normalizeNameKey(employee.full_name)) ||
      byEmail.get(normalizeEmail(employee.email));

    if (!row) return employee;
    matchedCount += 1;
    updatedCount += 1;

    return { ...employee, ...row.payload, last_balance_sync_date: getLocalDateKey(new Date()) };
  });

  return { employees, updatedCount, missingCount: Math.max(0, balanceRows.length - matchedCount) };
}


const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function normalizeOffDays(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[,|;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatOffDays(value) {
  const days = normalizeOffDays(value);
  return days.length ? days.join(", ") : "None assigned";
}

function convertESTToEmployeeLocal(timeValue, employee) {
  const formatted = formatMilitaryTime(timeValue);

  if (!formatted || formatted === "Not Available") {
    return formatted;
  }

  const country = String(employee?.country || "")
    .trim()
    .toUpperCase();

// CR and MX operate one hour behind EST.
// Accept both country codes and full country names from Google Sheets/Supabase.
const countriesOneHourBehindEST = [
  "CR",
  "COSTA RICA",
  "MX",
  "MEXICO",
];

if (!countriesOneHourBehindEST.includes(country)) {
  return formatted;
}

  const [h, m] = formatted.split(":").map(Number);

  let total = h * 60 + m - 60;

  while (total < 0) total += 1440;
  total %= 1440;

  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");

  return `${hh}:${mm}`;
}

function getStableSchedule(employee, schedules = [], dayName = todayDayName()) {
  const normalizedDay = normalizeDayName(dayName);
  const breaksByDay = employee?.breaks_by_day || {};

  const dayBreaks =
    breaksByDay[normalizedDay] ||
    breaksByDay[dayName] ||
    breaksByDay[String(dayName || "").trim()] ||
    {};

  const valueOrDefault = (value, defaultValue = "Not Available") => {
    if (value === null || value === undefined || value === "") return defaultValue;
    return value;
  };

  return {
  shift_start: convertESTToEmployeeLocal(employee?.shift_start || "08:00", employee),
  shift_end: convertESTToEmployeeLocal(employee?.shift_end || "17:00", employee),

 break_start: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.first_break_start), employee),
break_end: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.first_break_end), employee),

lunch_start: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.lunch_start), employee),
lunch_end: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.lunch_end), employee),

second_break_start: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.second_break_start), employee),
second_break_end: convertESTToEmployeeLocal(valueOrDefault(dayBreaks.second_break_end), employee),

  off_days: employee?.off_days || "",
  sub_department: employee?.sub_department || "",
};
}

function getScheduleChangePayload(request) {
  if (!request || request.type !== "Schedule Change") return {};

  // Future-proofing: if a schedule-change request is later submitted with explicit
  // schedule fields, only these approved fields can update the employee master schedule.
  return SCHEDULE_FIELDS.reduce((payload, field) => {
    if (request[field] !== undefined && request[field] !== "") payload[field] = request[field];
    return payload;
  }, {});
}

function todayDayName() {
  return WEEK_DAYS[new Date().getDay()];
}

function isTodayOffDay(employee) {
  const todayName = todayDayName().toLowerCase();
  return normalizeOffDays(employee?.off_days).some((day) => day.toLowerCase() === todayName);
}

function getAutoWorkClassification(employee, currentTime) {
  if (!employee) {
    return { category: "Working", approval: "Auto Logged", payableStatus: "Regular", locked: false, reason: "No employee selected" };
  }

  const nowMinutes = timeToMinutes(currentTime);
  const shiftStart = timeToMinutes(employee.shift_start);
  const shiftEnd = timeToMinutes(employee.shift_end);

  if (isTodayOffDay(employee)) {
    return {
      category: "Off-Day Unscheduled",
      approval: "Pending Approval",
      payableStatus: "Pending Manager Approval",
      locked: true,
      reason: "Employee is scheduled off today",
    };
  }

  if (nowMinutes !== null && shiftStart !== null && nowMinutes < shiftStart - EARLY_SHIFT_START_GRACE_MINUTES) {
    return {
      category: "Early Unscheduled",
      approval: "Pending Approval",
      payableStatus: "Pending Manager Approval",
      locked: true,
      reason: `Employee started more than ${EARLY_SHIFT_START_GRACE_MINUTES} minutes before scheduled shift`,
    };
  }

  if (nowMinutes !== null && shiftEnd !== null && nowMinutes > shiftEnd) {
    return {
      category: "Overtime",
      approval: "Pending",
      payableStatus: "Pending Manager Approval",
      locked: false,
      reason: "Auto overtime after scheduled shift end",
    };
  }

  return { category: "Working", approval: "Auto Logged", payableStatus: "Regular", locked: false, reason: "Within scheduled shift" };
}

function shouldSplitAutoOvertime(employee, endTime) {
  if (!employee || isTodayOffDay(employee)) return false;
  const endMinutes = timeToMinutes(endTime);
  const shiftEnd = timeToMinutes(employee.shift_end);
  return endMinutes !== null && shiftEnd !== null && endMinutes > shiftEnd;
}

function getShiftStartOrNow(employee, time) {
  if (!employee) return time;
  const nowMinutes = timeToMinutes(time);
  const shiftStart = timeToMinutes(employee.shift_start);
  if (nowMinutes !== null && shiftStart !== null && nowMinutes < shiftStart) return time;
  return employee.shift_start || time;
}

function getTodayShiftSummary(employee) {
  if (!employee) {
    return {
      isOff: false,
      label: "No schedule",
      detail: "No employee selected."
    };
  }

  const schedule = getStableSchedule(employee, [], todayDayName());

  if (isTodayOffDay(employee)) {
    return {
      isOff: true,
      label: `OFF · ${todayDayName()}`,
      detail: `Assigned off days: ${formatOffDays(schedule.off_days)}`
    };
  }

  return {
    isOff: false,
    label: formatTimeRange(schedule.shift_start, schedule.shift_end),
    detail:
  `Break 1: ${formatTimeRange(schedule.break_start, schedule.break_end)} · ` +
  `Lunch: ${formatTimeRange(schedule.lunch_start, schedule.lunch_end)} · ` +
  `Break 2: ${formatTimeRange(schedule.second_break_start, schedule.second_break_end)}`
  };
}


function hasPendingScheduleOverride(requestsList, employeeId) {
  return requestsList.some(
    (request) =>
      request.employee_id === employeeId &&
      request.type === "Schedule Override" &&
      ["Pending", "Pending Manager Approval"].includes(request.status)
  );
}

function buildScheduleOverrideRequest(employee, reason) {
  return {
    id: cleanId("REQ"),
    employee_id: employee.id,
    employee_name: employee.full_name,
    type: "Schedule Override",
    start_date: today,
    end_date: today,
    hours: 0,
    requested_days: 0,
    reason,
    status: "Pending Manager Approval",
    manager: employee.supervisor || employee.manager || "",
    current_balance: "N/A",
    projected_balance: "N/A",
    requested_at: new Date().toISOString(),
  };
}

function requestCoversDate(request, dateValue) {
  const startDate = String(request.start_date || request.requested_at || "").slice(0, 10);
  const endDate = String(request.end_date || request.start_date || request.requested_at || "").slice(0, 10);
  if (!startDate) return false;
  return dateValue >= startDate && dateValue <= (endDate || startDate);
}

function hasApprovedScheduleOverride(requestsList, employeeId, dateValue = today) {
  return requestsList.some(
    (request) =>
      request.employee_id === employeeId &&
      request.type === "Schedule Override" &&
      request.status === "Approved" &&
      requestCoversDate(request, dateValue)
  );
}

function showSickBalanceForCountry(country) {
  return String(country || "").toLowerCase() === "canada";
}

function requestDaysValue(request) {
  return safeNumber(request?.requested_days ?? request?.days ?? request?.hours ?? request?.requested_hours, 0);
}

function employeeMonthlyAttendance(employee, timeEntries = [], requests = []) {
  const monthKey = today.slice(0, 7);
  const entries = timeEntries.filter((entry) => entry.employee_id === employee?.id && String(entry.date || "").startsWith(monthKey));
  const approvedRequests = requests.filter((request) => request.employee_id === employee?.id && request.status === "Approved" && String(request.start_date || "").startsWith(monthKey));
  const sickApproved = approvedRequests.filter((request) => request.type === "Sick Leave");
  const ptoApproved = approvedRequests.filter((request) => request.type === "PTO");
  const vtoApproved = approvedRequests.filter((request) => request.type === "VTO");
  return {
    monthLabel: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    workingHours: entries.filter((entry) => entry.category === "Working").reduce((sum, entry) => sum + minutesBetween(entry.category_start, entry.category_end), 0) / 60,
    sickApprovedDays: sickApproved.reduce((sum, request) => sum + requestDaysValue(request), 0),
    ptoApprovedDays: ptoApproved.reduce((sum, request) => sum + requestDaysValue(request), 0),
    vtoApprovedDays: vtoApproved.reduce((sum, request) => sum + requestDaysValue(request), 0),
    approvedRequests: approvedRequests.slice(0, 6),
  };
}

function hasAdminAccess(employee) {
  return ADMIN_ACCESS_LEVELS.includes(employee?.access_level || employee?.role || "");
}

function getAccessProfile(employee) {
  const key = employee?.access_level || employee?.role || "Employee";
  return ROLE_ACCESS_PROFILES[key] || ROLE_ACCESS_PROFILES.Employee;
}

function balanceDays(employee, type) {
  if (!employee) return 0;
  if (type === "PTO") return safeNumber(employee.pto_balance_days ?? safeNumber(employee.pto_balance, 0) / 8, 0);
  if (type === "Sick Leave") return safeNumber(employee.sick_balance_days ?? safeNumber(employee.sick_balance, 0) / 8, 0);
  if (type === "VTO") return safeNumber(employee.vto_balance_days ?? safeNumber(employee.vto_balance, 0) / 8, 0);
  return 0;
}

function balanceFieldDays(type) {
  if (type === "PTO") return "pto_balance_days";
  if (type === "Sick Leave") return "sick_balance_days";
  if (type === "VTO") return "vto_balance_days";
  return null;
}

function isHolidayForCountry(country, date, holidays = countryHolidaySeed) {
  return holidays.find((holiday) => holiday.country === country && formatDateOnly(holiday.holiday_date) === formatDateOnly(date));
}

function employeeLiveStatus(employee, timeEntries = [], activityLog = []) {
  const latestActivity = activityLog.find((a) => a.employee_id === employee.id);
  const latestTime = timeEntries.find((t) => t.employee_id === employee.id);
  const status = latestActivity?.status || latestTime?.category || "Offline";
  const schedule = getStableSchedule(employee);
  if (isTodayOffDay(employee)) return { status: "Off Day", color: "gray", note: "Scheduled off" };
  if (status === "Working") return { status, color: "green", note: formatTimeRange(schedule.shift_start, schedule.shift_end) };
  if (["Break", "Lunch"].includes(status)) return { status, color: "yellow", note: "Away from production" };
  if (["Meeting", "Training", "Coaching"].includes(status)) return { status, color: "blue", note: "Scheduled task" };
  if (["Overtime", "Early Unscheduled", "Off-Day Unscheduled"].includes(status)) return { status, color: "red", note: "Requires review" };
  return { status, color: "gray", note: "No current status" };
}

function requestStatusSummary(requestsList = []) {
  return {
    total: requestsList.length,
    pending: requestsList.filter((r) => ["Pending", "Pending Manager Approval"].includes(r.status)).length,
    approved: requestsList.filter((r) => r.status === "Approved").length,
    denied: requestsList.filter((r) => r.status === "Denied").length,
  };
}

function buildGoogleUrl(params = {}) {
  const base = String(GOOGLE_API_URL || "").trim();
  const connector = base.includes("?") ? "&" : "?";
  return `${base}${connector}${new URLSearchParams(params).toString()}`;
}

function googleJsonp(params = {}) {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_API_URL) {
      reject(new Error("Google API URL is missing."));
      return;
    }

    const callbackName =
      "candoHrCallback_" +
      Date.now() +
      "_" +
      Math.floor(Math.random() * 100000);

    window[callbackName] = (data) => {
      clearTimeout(timeout);

      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      resolve(data);
    };

    const script = document.createElement("script");

    const separator = GOOGLE_API_URL.includes("?") ? "&" : "?";

    const query = new URLSearchParams({
      ...params,
      callback: callbackName,
    }).toString();

    const timeout = setTimeout(() => {
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      reject(new Error("Google Sheets request timed out."));
    }, 30000);

    script.onerror = () => {
      clearTimeout(timeout);

      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      reject(new Error("Google Sheets JSONP request failed."));
    };

    script.src = `${GOOGLE_API_URL}${separator}${query}`;

    document.body.appendChild(script);
  });
}

async function googleJsonpWithRetry(params = {}, attempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await googleJsonp(params);
    } catch (error) {
      lastError = error;
      console.warn(`Google Sheets attempt ${attempt} failed:`, error?.message || error);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
      }
    }
  }
  throw lastError || new Error("Google Sheets request failed.");
}

async function googleGetDatabase() {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) return null;
  try {
    const responseData = await googleJsonpWithRetry({ action: "getAll" }, 2);
    console.log("Google Sheets GET result:", responseData);
    return responseData?.success ? responseData.data : null;
  } catch (error) {
    console.error("Google Sheets GET error:", error);
    return null;
  }
}

async function googleAddRow(tab, data) {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) {
    console.warn("Google API URL is missing. Running in local demo mode.");
    return null;
  }

  try {
    const result = await googleJsonp({
      action: "addRow",
      tab,
      payload: JSON.stringify(data),
    });

    console.log("Google Sheets addRow result:", result);

    if (!result?.success) {
      console.warn(`Google Sheets write failed: ${result?.message || "Unknown error"}`);
    }

    return result;
  } catch (error) {
    console.error("Google Sheets addRow error:", error);
    alert(`Google Sheets connection error: ${error.message}`);
    return null;
  }
}

async function googleUpdateRow(tab, idColumn, idValue, data) {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) {
    console.warn("Google API URL is missing. Running in local demo mode.");
    return null;
  }

  try {
    const result = await googleJsonp({
      action: "updateRow",
      tab,
      idColumn,
      idValue,
      payload: JSON.stringify(data),
    });

    console.log("Google Sheets updateRow result:", result);

    if (!result?.success) {
      alert(`Google Sheets update failed: ${result?.message || "Unknown error"}`);
    }

    return result;
  } catch (error) {
    console.error("Google Sheets updateRow error:", error);
    alert(`Google Sheets connection error: ${error.message}`);
    return null;
  }
}

async function googleDeleteRow(tab, idColumn, idValue) {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) {
    console.warn("Google API URL is missing. Running in local demo mode.");
    return null;
  }

  try {
    const result = await googleJsonp({
      action: "deleteRow",
      tab,
      idColumn,
      idValue,
    });

    console.log("Google Sheets deleteRow result:", result);

    if (!result?.success) {
      alert(`Google Sheets delete failed: ${result?.message || "Unknown error"}`);
    }

    return result;
  } catch (error) {
    console.error("Google Sheets deleteRow error:", error);
    alert(`Google Sheets connection error: ${error.message}`);
    return null;
  }
}


async function supabaseInsert(table, payload, context = "Supabase insert") {
  if (!supabase) {
    console.warn(`${context}: Supabase client is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.`);
    return null;
  }

  const rows = Array.isArray(payload) ? payload : [payload];
  const { data, error } = await supabase.from(table).insert(rows).select();

  if (error) {
    console.error(`${context} failed on ${table}:`, error);
    return null;
  }

  console.log(`${context} saved to ${table}:`, data);
  return data;
}

function toSupabaseTimestamp(dateValue, timeValue) {
  const cleanDate = formatDateOnly(dateValue || today) || today;
  const cleanTime = formatMilitaryTime(timeValue || "00:00") || "00:00";
  return `${cleanDate}T${cleanTime}:00`;
}

function mapTimeEntryToSupabaseLog(entry, employee = {}) {
  return {
    app_log_id: String(entry.id || ""),
    employee_id: String(entry.employee_id || employee.id || ""),
    employee_email: employee.email || entry.employee_email || "",
    employee_name: entry.employee_name || employee.full_name || "",
    status: entry.category || entry.status || "Working",
    clock_in: toSupabaseTimestamp(entry.date, entry.clock_in || entry.category_start),
    clock_out: entry.clock_out || entry.category_end ? toSupabaseTimestamp(entry.date, entry.clock_out || entry.category_end) : null,
    break_start: entry.category === "Break" ? toSupabaseTimestamp(entry.date, entry.category_start) : null,
    break_end: entry.category === "Break" ? toSupabaseTimestamp(entry.date, entry.category_end) : null,
    category_start: entry.category_start ? toSupabaseTimestamp(entry.date, entry.category_start) : null,
    category_end: entry.category_end ? toSupabaseTimestamp(entry.date, entry.category_end) : null,
    duration_minutes: minutesBetween(entry.category_start, entry.category_end),
    approval_status: entry.approved || "Pending",
    payable_status: entry.payable_status || "",
    notes: entry.notes || "",
    lob: entry.lob || employee.lob || "",
    department: entry.department || employee.department || "",
    sub_department: entry.sub_department || employee.sub_department || "",
  };
}

function mapRequestToSupabaseRequest(item, employee = {}) {
  return {
    app_request_id: String(item.id || ""),
    employee_id: String(item.employee_id || employee.id || ""),
    employee_email: employee.email || item.employee_email || "",
    employee_name: item.employee_name || employee.full_name || "",
    request_type: item.type || item.request_type || "PTO",
    start_date: formatDateOnly(item.start_date || today),
    end_date: formatDateOnly(item.end_date || item.start_date || today),
    requested_hours: null,
    requested_days: safeNumber(item.requested_days ?? item.days ?? item.hours ?? item.requested_hours, 0),
    reason: item.reason || "",
    status: item.status || "Pending",
    manager_notes: item.reason || item.manager_notes || "",
    approved_at: item.status === "Approved" ? new Date().toISOString() : null,
    approved_by: item.status === "Approved" ? item.manager || "" : null,
  };
}

function mapEmailToSupabaseQueue({ recipient, subject, body, status = "Pending" }) {
  return {
    recipient: recipient || "",
    subject: subject || "HR Workforce Notification",
    body: body || "",
    status,
  };
}


async function updateSupabaseRequestDecision(localRequest, status, approverEmail, notes = "") {
  if (!supabase || !localRequest) return null;

  const updatePayload = {
    status,
    manager_notes: notes || localRequest.reason || "",
    approved_at: new Date().toISOString(),
    approved_by: approverEmail || "",
  };

  const matchByAppId = await supabase
    .from("requests")
    .update(updatePayload)
    .eq("app_request_id", String(localRequest.id || ""))
    .select();

  if (!matchByAppId.error && matchByAppId.data?.length) {
    console.log("Supabase request status updated by app_request_id:", matchByAppId.data);
    return matchByAppId.data;
  }

  const matchByFields = await supabase
    .from("requests")
    .update(updatePayload)
    .eq("employee_email", String(localRequest.employee_email || localRequest.email || "").toLowerCase() || String(localRequest.employee_email || ""))
    .eq("request_type", localRequest.type || localRequest.request_type || "PTO")
    .eq("start_date", formatDateOnly(localRequest.start_date || today))
    .eq("end_date", formatDateOnly(localRequest.end_date || localRequest.start_date || today))
    .eq("status", "Pending")
    .select();

  if (matchByFields.error) {
    console.error("Supabase request status update failed:", matchByFields.error);
    return null;
  }

  console.log("Supabase request status updated by fallback fields:", matchByFields.data);
  return matchByFields.data;
}

function mapApprovalToSupabaseApproval({ request, approverEmail, status, notes }) {
  return {
    app_request_id: String(request?.id || ""),
    employee_id: String(request?.employee_id || ""),
    employee_email: String(request?.employee_email || request?.email || ""),
    employee_name: request?.employee_name || "",
    request_type: request?.type || request?.request_type || "Request",
    approver_email: approverEmail || "",
    action: status || "Updated",
    notes: notes || "",
  };
}

function firstKnownValue(row, keys, fallback = "") {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
  }
  return fallback;
}

function keyForEmployeeRecord(row = {}) {
  return normalizeEmail(row.email || row.employee_email || row.Auth_Email) || String(row.employee_id || row.Employee_ID || row.id || "").trim().toLowerCase() || String(row.full_name || row.Full_Name || row.name || "").trim().toLowerCase();
}

function buildIndex(rows = []) {
  const index = new Map();
  rows.forEach((row) => {
    const keys = [
      normalizeEmail(row.email || row.employee_email || row.Auth_Email),
      String(row.employee_id || row.Employee_ID || row.id || "").trim().toLowerCase(),
      String(row.full_name || row.Full_Name || row.name || "").trim().toLowerCase(),
    ].filter(Boolean);
    keys.forEach((key) => index.set(key, row));
  });
  return index;
}

function mapSupabaseEmployee(row = {}, balance = {}, schedule = {}, base = {}) {
  const accessLevel = firstKnownValue(row, ["access_level", "role", "profile"], firstKnownValue(base, ["access_level", "role"], "Employee"));
  const role = accessLevel === "Employee" ? "Agent" : accessLevel;
  const appEmployeeId = firstKnownValue(base, ["id", "employee_id", "Employee_ID"], firstKnownValue(row, ["employee_id", "Employee_ID"], row.id || cleanId("EMP")));
  return {
    id: appEmployeeId,
    employee_id: appEmployeeId,
    supabase_employee_id: firstKnownValue(row, ["employee_id", "Employee_ID"], row.id || ""),
    full_name: firstKnownValue(row, ["full_name", "name", "employee_name", "Full_Name"], "Unnamed Employee"),
    email: firstKnownValue(row, ["email", "employee_email", "Auth_Email"], ""),
    country: firstKnownValue(row, ["country", "site", "location"], "Costa Rica"),
    lob: firstKnownValue(row, ["lob", "LOB"], "GoDay"),
    department: firstKnownValue(row, ["department", "area"], firstKnownValue(row, ["team"], "Operations")),
    sub_department: firstKnownValue(row, ["sub_department", "subDepartment", "queue", "team"], ""),
    role,
    access_level: accessLevel,
    supervisor: firstKnownValue(row, ["supervisor", "team_leader", "team_lead", "tl"], ""),
    manager: firstKnownValue(row, ["manager", "operations_manager"], ""),
    hire_date: formatDateOnly(firstKnownValue(row, ["hire_date", "start_date", "date_of_hire"], "")),
    birthday: formatDateOnly(firstKnownValue(row, ["birthday", "birth_date", "date_of_birth"], "")),
    employment_status: firstKnownValue(row, ["employment_status", "status"], "Active"),
    termination_date: formatDateOnly(firstKnownValue(row, ["termination_date"], "")),
    employment_type: firstKnownValue(row, ["employment_type", "type"], "Full-Time"),
    off_days: firstKnownValue(schedule, ["off_days", "Off_Days"], firstKnownValue(row, ["off_days", "Off_Days"], defaultOffDays)),
    shift_start: formatMilitaryTime(firstKnownValue(schedule, ["shift_start", "start_time"], firstKnownValue(row, ["shift_start", "Shift_Start"], "08:00"))),
    shift_end: formatMilitaryTime(firstKnownValue(schedule, ["shift_end", "end_time"], firstKnownValue(row, ["shift_end", "Shift_End"], "17:00"))),
    break_start: formatMilitaryTime(firstKnownValue(schedule, ["break_start", "break_1_start"], firstKnownValue(row, ["break_start", "Break_1_Start"], "10:00"))),
    break_end: formatMilitaryTime(firstKnownValue(schedule, ["break_end", "break_1_end"], firstKnownValue(row, ["break_end", "Break_1_End"], "10:15"))),
    lunch_start: formatMilitaryTime(firstKnownValue(schedule, ["lunch_start"], firstKnownValue(row, ["lunch_start", "Lunch_Start"], "12:00"))),
    lunch_end: formatMilitaryTime(firstKnownValue(schedule, ["lunch_end"], firstKnownValue(row, ["lunch_end", "Lunch_End"], "13:00"))),
    second_break_start: formatMilitaryTime(firstKnownValue(schedule, ["second_break_start", "break_2_start"], firstKnownValue(row, ["second_break_start", "Break_2_Start"], "15:00"))),
    second_break_end: formatMilitaryTime(firstKnownValue(schedule, ["second_break_end", "break_2_end"], firstKnownValue(row, ["second_break_end", "Break_2_End"], "15:15"))),
    break_minutes: safeNumber(firstKnownValue(schedule, ["break_minutes"], firstKnownValue(row, ["break_minutes"], 30)), 30),
    lunch_minutes: safeNumber(firstKnownValue(schedule, ["lunch_minutes"], firstKnownValue(row, ["lunch_minutes"], 60)), 60),
    pto_balance: safeNumber(firstKnownValue(balance, ["available_hours_reference", "available_hours", "pto_balance", "pto_hours", "vacation_hours"], firstKnownValue(row, ["pto_balance"], 0)), 0),
    sick_balance: safeNumber(firstKnownValue(balance, ["sick_balance", "sick_hours"], firstKnownValue(row, ["sick_balance"], 0)), 0),
    vto_balance: safeNumber(firstKnownValue(balance, ["approved_vto_hours", "vto_balance", "vto_hours"], firstKnownValue(row, ["vto_balance"], 0)), 0),
    pto_balance_days: safeNumber(firstKnownValue(balance, ["available_days", "vacation_balance_days", "vacation_days", "available_days_reference", "pto_balance_days", "pto_days", "available_pto_days", "available_pto", "vacation_balance", "pto_available_days", "vacation_available_days"], firstKnownValue(row, ["pto_balance_days", "pto_days", "vacation_days"], 0)), 0),
    sick_balance_days: safeNumber(firstKnownValue(balance, ["approved_sick_days", "sick_balance_days", "sick_days", "available_sick_days", "sick_available_days"], firstKnownValue(row, ["sick_balance_days", "sick_days"], 0)), 0),
    vto_balance_days: safeNumber(firstKnownValue(balance, ["vto_balance_days", "vto_days"], firstKnownValue(row, ["vto_balance_days", "vto_days"], 0)), 0),
    tenure_days: safeNumber(firstKnownValue(balance, ["days_active", "tenure_days"], firstKnownValue(row, ["days_active", "tenure_days"], 0)), 0),
    off_day_approved: false,
    notes: firstKnownValue(row, ["notes"], ""),
    temp_password: firstKnownValue(row, ["temp_password", "temporary_password", "Auth_Password"], DEFAULT_LOGIN_PASSWORD),
    temporary_password: firstKnownValue(row, ["temporary_password", "temp_password", "Auth_Password"], DEFAULT_LOGIN_PASSWORD),
    must_change_password: normalizeBoolean(row.must_change_password) || normalizeBoolean(row.force_password_change) || normalizeBoolean(row.requires_password_reset),
    force_password_change: normalizeBoolean(row.force_password_change) || normalizeBoolean(row.must_change_password) || normalizeBoolean(row.requires_password_reset),
    requires_password_reset: normalizeBoolean(row.requires_password_reset) || normalizeBoolean(row.force_password_change) || normalizeBoolean(row.must_change_password),
    password_last_updated: firstKnownValue(row, ["password_last_updated"], ""),
  };
}

function mergeSupabaseEmployeeData(baseEmployees = [], supabaseEmployees = [], balances = [], schedules = []) {
  const balanceIndex = buildIndex(balances);
  const scheduleIndex = buildIndex(schedules);
  const baseIndex = buildIndex(baseEmployees);
  const merged = [];
  const used = new Set();

  supabaseEmployees.forEach((row) => {
    const key = keyForEmployeeRecord(row);
    const emailKey = normalizeEmail(row.email || row.employee_email || row.Auth_Email);
    const rowEmployeeIdKey = String(row.employee_id || row.Employee_ID || "").trim().toLowerCase();
    const base = baseIndex.get(key) || baseIndex.get(emailKey) || baseIndex.get(rowEmployeeIdKey) || {};
    const baseEmployeeIdKey = String(base.id || base.employee_id || base.Employee_ID || "").trim().toLowerCase();
    const balance =
      balanceIndex.get(baseEmployeeIdKey) ||
      balanceIndex.get(rowEmployeeIdKey) ||
      balanceIndex.get(emailKey) ||
      balanceIndex.get(key) ||
      {};
    const schedule =
      scheduleIndex.get(baseEmployeeIdKey) ||
      scheduleIndex.get(rowEmployeeIdKey) ||
      scheduleIndex.get(emailKey) ||
      scheduleIndex.get(key) ||
      {};
    const mapped = mapSupabaseEmployee(row, balance, schedule, base);
    merged.push({ ...base, ...mapped });
    used.add(keyForEmployeeRecord(mapped));
    if (emailKey) used.add(emailKey);
    if (baseEmployeeIdKey) used.add(baseEmployeeIdKey);
  });

  baseEmployees.forEach((employee) => {
    const key = keyForEmployeeRecord(employee);
    if (!used.has(key)) merged.push(employee);
  });

  return merged;
}

async function loadSupabaseReferenceData(baseEmployees = [], applyEmployees, applyDatabaseStatus) {
  if (!supabase) return false;
  try {
    const [employeesResult, balancesResult, schedulesResult] = await Promise.all([
      supabase.from("employees").select("*"),
      supabase.from("employee_balances").select("*"),
      supabase.from("employee_schedules").select("*"),
    ]);

    if (employeesResult.error) {
      console.warn("Supabase employees load skipped:", employeesResult.error.message);
      return false;
    }

    const supabaseEmployees = employeesResult.data || [];
    if (!supabaseEmployees.length) return false;

    const mergedEmployees = mergeSupabaseEmployeeData(
      baseEmployees.length ? baseEmployees : employeesSeed,
      supabaseEmployees,
      balancesResult.data || [],
      schedulesResult.data || []
    );

    if (typeof applyEmployees === "function") applyEmployees(mergedEmployees);
    if (typeof applyDatabaseStatus === "function") applyDatabaseStatus("Supabase database connected live. Employee balances, tenure, schedule fields, requests, approvals, and time logs are loading from production tables.");
    return true;
  } catch (error) {
    console.warn("Supabase reference data load failed:", error?.message || error);
    return false;
  }
}

function mapEmployeeFromSheet(row) {
  return {
    id: row.Employee_ID || cleanId("EMP"),
    full_name: row.Full_Name || "Unnamed Employee",
    email: row.Auth_Email || "",
    country: row.Country || "Costa Rica",
    lob: row.LOB || "GoDay",
    department: row.Department || "Operations",
    sub_department: row.Sub_Department || row.SubDepartment || row.Sub_Department_Name || "",
    role: row.Role || "Agent",
    access_level: row.Access_Level || "Employee",
    supervisor: row.Supervisor || "",
    manager: row.Manager || "",
    hire_date: row.Hire_Date || "",
    birthday: row.Birthday || "",
    employment_status: row.Employment_Status || "Active",
    termination_date: row.Termination_Date || "",
    employment_type: row.Employment_Type || "Full-Time",
    off_days: row.Off_Days || row.OffDays || defaultOffDays,
    shift_start: formatMilitaryTime(row.Shift_Start || "08:00"),
    shift_end: formatMilitaryTime(row.Shift_End || "17:00"),
    break_start: formatMilitaryTime(row.Break_1_Start || "10:00"),
    break_end: formatMilitaryTime(row.Break_1_End || "10:15"),
    lunch_start: formatMilitaryTime(row.Lunch_Start || "12:00"),
    lunch_end: formatMilitaryTime(row.Lunch_End || "13:00"),
    second_break_start: formatMilitaryTime(row.Break_2_Start || "15:00"),
    second_break_end: formatMilitaryTime(row.Break_2_End || "15:15"),
    break_minutes: safeNumber(row.Break_Minutes, 30),
    lunch_minutes: safeNumber(row.Lunch_Minutes, 60),
    pto_balance: safeNumber(row.PTO_Balance, 0),
    sick_balance: safeNumber(row.Sick_Balance, 0),
    vto_balance: safeNumber(row.VTO_Balance, 0),
    pto_balance_days: safeNumber(row.PTO_Balance_Days, safeNumber(row.PTO_Balance, 0) / 8),
    sick_balance_days: safeNumber(row.Sick_Balance_Days, safeNumber(row.Sick_Balance, 0) / 8),
    vto_balance_days: safeNumber(row.VTO_Balance_Days, safeNumber(row.VTO_Balance, 0) / 8),
    off_day_approved: String(row.Off_Day_Approved || "").toLowerCase() === "true",
    notes: row.Notes || "",
    temp_password: row.Temp_Password || row.Auth_Password || DEFAULT_LOGIN_PASSWORD,
  };
}

function mapEmployeeToSheet(employee) {
  return {
    Employee_ID: employee.id,
    Auth_Email: employee.email,
    Full_Name: employee.full_name,
    Country: employee.country,
    LOB: employee.lob,
    Department: employee.department,
    Sub_Department: employee.sub_department || "",
    Role: employee.role,
    Access_Level: employee.access_level,
    Supervisor: employee.supervisor,
    Manager: employee.manager,
    Hire_Date: employee.hire_date,
    Birthday: employee.birthday,
    Employment_Status: employee.employment_status,
    Termination_Date: employee.termination_date || "",
    Employment_Type: employee.employment_type,
    Off_Days: formatOffDays(employee.off_days),
    Shift_Start: employee.shift_start,
    Shift_End: employee.shift_end,
    Break_1_Start: employee.break_start,
    Break_1_End: employee.break_end,
    Lunch_Start: employee.lunch_start,
    Lunch_End: employee.lunch_end,
    Break_2_Start: employee.second_break_start,
    Break_2_End: employee.second_break_end,
    Break_Minutes: employee.break_minutes,
    Lunch_Minutes: employee.lunch_minutes,
    PTO_Balance: employee.pto_balance,
    Sick_Balance: employee.sick_balance,
    VTO_Balance: employee.vto_balance,
    PTO_Balance_Days: employee.pto_balance_days ?? safeNumber(employee.pto_balance, 0) / 8,
    Sick_Balance_Days: employee.sick_balance_days ?? safeNumber(employee.sick_balance, 0) / 8,
    VTO_Balance_Days: employee.vto_balance_days ?? safeNumber(employee.vto_balance, 0) / 8,
    Off_Day_Approved: employee.off_day_approved ? "TRUE" : "FALSE",
    Notes: employee.notes || "",
    Temp_Password: employee.temp_password || "",
  };
}

function mapTimeFromSheet(row) {
  return {
    id: row.Log_ID || cleanId("TIME"),
    employee_id: row.Employee_ID || "",
    employee_name: row.Employee_Name || "",
    lob: row.LOB || "",
    department: row.Department || "",
    sub_department: row.Sub_Department || "",
    date: row.Date || today,
    category: row.Disposition || "Working",
    category_start: row.Category_Start || "08:00",
    category_end: row.Category_End || "08:00",
    approved: row.Approved || "Pending",
    payable_status: row.Payable_Status || "",
    locked: String(row.Locked || "").toLowerCase() === "true",
    auto_rule: row.Auto_Rule || "",
    notes: row.Notes || "",
    scheduled_start: row.Scheduled_Start || row.Shift_Start || "08:00",
    scheduled_end: row.Scheduled_End || row.Shift_End || "17:00",
    schedule_break_1: row.Schedule_Break_1 || "",
    schedule_lunch: row.Schedule_Lunch || "",
    schedule_break_2: row.Schedule_Break_2 || "",
    schedule_off_days: row.Schedule_Off_Days || "",
    schedule_source: row.Schedule_Source || "Employee Master Schedule",
    clock_in: row.Clock_In || row.Category_Start || "08:00",
    clock_out: row.Clock_Out || row.Category_End || "17:00",
  };
}

function mapTimeToSheet(item) {
  return {
    Log_ID: item.id,
    Employee_ID: item.employee_id,
    Employee_Name: item.employee_name,
    LOB: item.lob,
    Department: item.department,
    Sub_Department: item.sub_department || "",
    Date: item.date,
    Scheduled_Start: item.scheduled_start || "",
    Scheduled_End: item.scheduled_end || "",
    Schedule_Break_1: item.schedule_break_1 || "",
    Schedule_Lunch: item.schedule_lunch || "",
    Schedule_Break_2: item.schedule_break_2 || "",
    Schedule_Off_Days: item.schedule_off_days || "",
    Schedule_Source: item.schedule_source || "Employee Master Schedule",
    Clock_In: item.clock_in || "",
    Clock_Out: item.clock_out || "",
    Disposition: item.category,
    Category_Start: item.category_start,
    Category_End: item.category_end,
    Duration_Minutes: minutesBetween(item.category_start, item.category_end),
    Approved: item.approved,
    Approved_By: item.approved_by || "",
    Payable_Status: item.payable_status || "",
    Locked: item.locked ? "TRUE" : "FALSE",
    Auto_Rule: item.auto_rule || "",
    Notes: item.notes,
  };
}

function mapRequestFromSheet(row) {
  return {
    id: row.Request_ID || cleanId("REQ"),
    employee_id: row.Employee_ID || "",
    employee_name: row.Employee_Name || "",
    type: row.Request_Type || "PTO",
    start_date: row.Start_Date || today,
    end_date: row.End_Date || today,
    hours: safeNumber(row.Hours_Requested, 0),
    status: row.Status || "Pending",
    manager: row.Manager_Approval || "",
    current_balance: row.Current_Balance || "",
    projected_balance: row.Projected_Balance || "",
    reason: row.Reason || "",
    requested_days: safeNumber(row.Hours_Requested, 0) / 8,
  };
}

function mapRequestToSheet(item) {
  return {
    Request_ID: item.id,
    Employee_ID: item.employee_id,
    Employee_Name: item.employee_name,
    Request_Type: item.type,
    Start_Date: item.start_date,
    End_Date: item.end_date,
    Hours_Requested: item.hours,
    Status: item.status,
    Manager_Approval: item.manager,
    Current_Balance: item.current_balance,
    Projected_Balance: item.projected_balance,
    Reason: item.reason,
    Submitted_Date: new Date(),
  };
}

function mapRuleFromSheet(row) {
  return {
    id: row.Rule_ID || cleanId("RULE"),
    lob: row.LOB || "GoDay",
    department: row.Department || "Operations",
    shift_start: formatMilitaryTime(row.Shift_Start || "08:00"),
    shift_end: formatMilitaryTime(row.Shift_End || "17:00"),
    max_pto_out: safeNumber(row.Max_PTO_Out, 0),
    max_vto_out: safeNumber(row.Max_VTO_Out, 0),
    max_sick_out: safeNumber(row.Max_Sick_Out, 0),
    min_staff_required: safeNumber(row.Minimum_Staff_Required, 0),
    start_date: row.Start_Date || row.Effective_Start || today,
    end_date: row.End_Date || row.Effective_End || "",
    recurrence: row.Recurrence || "Daily",
    notes: row.Notes || "",
  };
}

function mapRuleToSheet(rule) {
  return {
    Rule_ID: rule.id,
    LOB: rule.lob,
    Department: rule.department,
    Shift_Start: rule.shift_start,
    Shift_End: rule.shift_end,
    Max_PTO_Out: rule.max_pto_out,
    Max_VTO_Out: rule.max_vto_out,
    Max_Sick_Out: rule.max_sick_out,
    Minimum_Staff_Required: rule.min_staff_required,
    Start_Date: rule.start_date || "",
    End_Date: rule.end_date || "",
    Recurrence: rule.recurrence || "Daily",
    Notes: rule.notes,
    Last_Updated: new Date(),
  };
}

function mapApprovalToSheet(item) {
  return {
    Approval_ID: item.id || cleanId("APPROVAL"),
    Employee_ID: item.employee_id || "",
    Employee_Name: item.employee_name || "",
    Approval_Type: item.approval_type || "",
    Related_Record_ID: item.related_record_id || "",
    Request_Type: item.request_type || "",
    Decision: item.decision || "",
    Previous_Status: item.previous_status || "Pending",
    New_Status: item.new_status || item.decision || "",
    Approved_By: item.approved_by || "System",
    Approved_Date: item.approved_date || new Date(),
    Hours: item.hours || "",
    Current_Balance: item.current_balance ?? "",
    Projected_Balance: item.projected_balance ?? "",
    Notes: item.notes || "",
  };
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected application error." };
  }

  componentDidCatch(error, info) {
    console.error("HR Workforce app error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="errorPage">
          <style>{styles}</style>
          <section className="errorCard">
            <h1>Something needs attention</h1>
            <p>The app did not load this section correctly. This prevents a blank screen during testing.</p>
            <pre>{this.state.message}</pre>
            <button className="primary" onClick={() => window.location.reload()}>Reload app</button>
          </section>
        </div>
      );
    }

    return this.props.children;
  }
}
function ManagerOverrideModal({ title, message, onCancel, onConfirm }) {
  return (
    <div className="modalBackdrop">
      <div className="overrideCard">
        <h2>{title || "Manager approval required"}</h2>
        <p>
          {message ||
            "This action requires manager review before it can be completed."}
        </p>

        <div className="overrideActions">
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Approve Override
          </button>
        </div>
      </div>
    </div>
  );
}

function HRWorkforceApp() {
  const [employees, setEmployees] = useState([]);
  const [timeEntries, setTimeEntries] = useState(timeSeed);
  const [requests, setRequests] = useState(requestsSeed);
  const [activityLog, setActivityLog] = useState(activitySeed);
  const [rules, setRules] = useState(rulesSeed);
  const [lobs, setLobs] = useState(lobSeed);
  const [departments, setDepartments] = useState(departmentSeed);
  const [subDepartments, setSubDepartments] = useState(operationsSubDepartmentSeed);
  const [newLob, setNewLob] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [tab, setTab] = useState("agent");
  const [adminMode, setAdminMode] = useState(false);
  const [search, setSearch] = useState("");
  const [reportView, setReportView] = useState("LOB");
  const [filters, setFilters] = useState({ lob: "All", department: "All", subDepartment: "All", employee: "All", country: "All", category: "All", startDate: "", endDate: "" });
  const [agentStatus, setAgentStatus] = useState("Working");
  const [newTime, setNewTime] = useState({ category: "Working", category_start: "08:00", category_end: "09:00", notes: "" });
  const [newRequest, setNewRequest] = useState({ type: "PTO", start_date: today, end_date: today, hours: 8, reason: "" });
  const [newRule, setNewRule] = useState({
    department: "Operations",
    lob: "GoDay",
    shift_start: "08:00",
    shift_end: "17:00",
    max_pto_out: 2,
    max_vto_out: 1,
    max_sick_out: 2,
    min_staff_required: 6,
    start_date: today,
    end_date: "",
    recurrence: "Daily",
    notes: "",
  });
  const [newEmployee, setNewEmployee] = useState({
    full_name: "",
    email: "",
    country: "Costa Rica",
    department: "Operations",
    sub_department: "Customer Service",
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "",
    manager: "",
    hire_date: "",
    birthday: "",
    employment_status: "Active",
    employment_type: "Full-Time",
    off_days: defaultOffDays,
    shift_start: "08:00",
    shift_end: "17:00",
    break_start: "10:00",
    break_end: "10:15",
    lunch_start: "12:00",
    lunch_end: "13:00",
    second_break_start: "15:00",
    second_break_end: "15:15",
    lunch_minutes: 60,
    break_minutes: 30,
    pto_balance: 0,
    sick_balance: 0,
    vto_balance: 0,
  });
  const [databaseStatus, setDatabaseStatus] = useState("Demo mode active. Using built-in demo users and sample HR data.");
  const [attendanceEmailSettings, setAttendanceEmailSettings] = useState(DEFAULT_ATTENDANCE_EMAIL_SETTINGS);
  const [lastWorkforceSync, setLastWorkforceSync] = useState(null);
  const [sessionUserEmail, setSessionUserEmail] = useState(localStorage.getItem("candoHrUserEmail") || "");
  const [loginEmail, setLoginEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [resetNotice, setResetNotice] = useState("");
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPersonalPassword, setNewPersonalPassword] = useState("");
  const [confirmPersonalPassword, setConfirmPersonalPassword] = useState("");
  const [toast, setToast] = useState(null);
  const [processingModal, setProcessingModal] = useState(null);
  const [managerOverrideModal, setManagerOverrideModal] = useState(null);
  const actionLockRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const overrideResolverRef = useRef(null);
  const dailyTimerStopRef = useRef("");
  const weeklyWorkforceSyncRef = useRef(localStorage.getItem(WORKFORCE_SYNC_LAST_RUN_KEY) || "");
  const liveAutoSyncRef = useRef(false);
  const attendanceEmailQueueRef = useRef(new Set());
  const [startupLoading, setStartupLoading] = useState(true);


  async function syncWorkforcePlanningSheet(options = {}) {
    const { silent = false, automatic = false } = options;

    try {
      const [workforceRows, breakRows, balanceRows] = await Promise.all([
        fetchWorkforceSheetRows(),
        fetchBreaksSheetRows(),
        fetchBalanceSheetRows(),
      ]);

      if (!workforceRows.length && !breakRows.length && !balanceRows.length) {
        if (!silent) {
          showToast(
            "Workforce sheet not synced",
            "No matching rows were found in Roster, Breaks, or employee_balances. Confirm the sheet is shared with viewer access and contains Employee ID or Name.",
            "warning"
          );
        }
        return { updatedCount: 0, importedCount: 0, missingCount: 0, breakUpdatedCount: 0, balanceUpdatedCount: 0 };
      }

      let rosterResult = { employees, updatedCount: 0, importedCount: 0, missingCount: 0 };
      let breakResult = { employees, updatedCount: 0, missingCount: 0 };
      let balanceResult = { employees, updatedCount: 0, missingCount: 0 };

      let finalSyncedEmployees = [];

rosterResult = mergeWorkforceRowsIntoEmployees(employees, workforceRows, { importMissing: true });
breakResult = mergeBreakRowsIntoEmployees(rosterResult.employees, breakRows);
balanceResult = mergeBalanceRowsIntoEmployees(breakResult.employees, balanceRows);

finalSyncedEmployees = balanceResult.employees;
setEmployees(finalSyncedEmployees);
if (supabase && finalSyncedEmployees.length) {
  const employeesForBreakSync =
  finalSyncedEmployees.length ? finalSyncedEmployees : breakResult.employees;

const breakRowsForSupabase =
  buildEmployeeBreakRowsForSupabase(employeesForBreakSync);

console.log(
  "Break rows prepared for Supabase:",
  breakRowsForSupabase.length,
  breakRowsForSupabase.slice(0, 5)
);


  console.log(
  "Break rows prepared for Supabase:",
  breakRowsForSupabase.length,
  breakRowsForSupabase.slice(0,5)
);

console.log("Break rows ready before upsert:", breakRowsForSupabase.length);
console.log("SUPABASE READY?", !!supabase);
console.log("BREAK ROWS READY?", breakRowsForSupabase.length);
console.log("FIRST BREAK ROW:", breakRowsForSupabase[0]);

const uniqueBreakRowsForSupabase = Array.from(
  new Map(
    breakRowsForSupabase.map((row) => [
      `${row.employee_id}-${row.day_name}`,
      row
    ])
  ).values()
);

console.log(
  "Unique break rows ready before upsert:",
  uniqueBreakRowsForSupabase.length
);

  if (breakRowsForSupabase.length) {
    
    const { data: breakUpsertData, error: breakUpsertError } = await supabase
  .from("employee_breaks")
  .upsert(uniqueBreakRowsForSupabase, {
    onConflict: "employee_id,day_name",
  })
  .select();

console.log("Employee breaks upsert result:", {
  count: breakUpsertData?.length || 0,
  error: breakUpsertError,
});

if (typeof refreshLiveData === "function") {
  await refreshLiveData();
}

    if (breakUpsertError) {
      console.warn("Employee breaks Supabase sync failed:", breakUpsertError.message);
    }
  }

  try {
  console.log("Employee sync timestamp update skipped for pilot stability.");
} catch (error) {
  console.warn("Employee sync timestamp update skipped:", error);
}
}

      const syncDate = getLocalDateKey(new Date());
      const syncedAt = new Date().toLocaleString();
      const syncMode = automatic ? "Automatic Saturday Sync" : "Manual Sync";

      if (automatic) {
        localStorage.setItem(WORKFORCE_SYNC_LAST_RUN_KEY, syncDate);
        weeklyWorkforceSyncRef.current = syncDate;
      }

      const syncResult = {
        ...rosterResult,
        breakUpdatedCount: breakResult.updatedCount,
        breakMissingCount: breakResult.missingCount,
        balanceUpdatedCount: balanceResult.updatedCount,
        balanceMissingCount: balanceResult.missingCount,
      };

      setLastWorkforceSync({ ...syncResult, syncedAt, syncMode, nextScheduledSync: "Saturday 5:00 AM" });

      setDatabaseStatus(
        `${syncMode} completed: ${rosterResult.updatedCount} roster employee(s), ${breakResult.updatedCount} break schedule employee(s), and ${balanceResult.updatedCount} balance row(s) synced. Protected identity fields were not overwritten.`
      );

      if (!silent) {
        showToast(
          "Workforce sheet synced",
          `${rosterResult.updatedCount} roster employee(s), ${breakResult.updatedCount} break schedule employee(s), and ${balanceResult.updatedCount} balance row(s) synced. Blank breaks show as Not Available.`,
          "success"
        );
      }
if (finalSyncedEmployees?.length) {
  setEmployees(finalSyncedEmployees);
}

      return syncResult;
    } catch (error) {
      console.error("Workforce planning sync failed:", error);
      if (!silent) showToast("Workforce sync failed", error?.message || "Please verify the shared sheet access.", "danger");
      return { updatedCount: 0, importedCount: 0, missingCount: 0, breakUpdatedCount: 0, balanceUpdatedCount: 0 };
    }
  }

  
  useEffect(() => {
    async function loadGoogleDatabase() {
      const database = await googleGetDatabase();

      if (!database) {
        const loadedSupabase = await loadSupabaseReferenceData(employeesSeed, setEmployees, setDatabaseStatus);
        if (!loadedSupabase) setDatabaseStatus("Demo mode active. Using built-in demo users and sample HR data. Workforce roster sync is scheduled for Saturday 5:00 AM or can be run manually by an admin.");
        return;
      }

      const sheetEmployees = (database.employees || []).map(mapEmployeeFromSheet);
      const sheetTime = (database.timeLogs || []).map(mapTimeFromSheet);
      const sheetRequests = (database.requests || []).map(mapRequestFromSheet);
      const sheetRules = (database.staffingRules || []).map(mapRuleFromSheet);
      const sheetLobs = (database.lobs || []).map((row) => row.LOB_Name).filter(Boolean);
      const sheetDepartments = (database.departments || []).map((row) => row.Department_Name).filter(Boolean);
      const sheetSubDepartments = (database.subDepartments || database.sub_departments || []).map((row) => row.Sub_Department_Name || row.Sub_Department || row.Name).filter(Boolean);

      const baseEmployees = sheetEmployees.length ? sheetEmployees : employeesSeed;
      if (sheetEmployees.length) setEmployees(sheetEmployees);
      if (sheetTime.length) setTimeEntries(sheetTime);
      if (sheetRequests.length) setRequests(sheetRequests.map((request) => ({ ...request, requested_days: requestDaysValue(request), hours: requestDaysValue(request) })));
      if (sheetRules.length) setRules(sheetRules);
      if (sheetLobs.length) setLobs([...new Set(sheetLobs)]);
      if (sheetDepartments.length) setDepartments([...new Set(sheetDepartments)]);
      if (sheetSubDepartments.length) setSubDepartments([...new Set(sheetSubDepartments)]);

      const loadedSupabase = await loadSupabaseReferenceData(baseEmployees, setEmployees, setDatabaseStatus);
      if (!loadedSupabase) setDatabaseStatus("Google Sheets database connected live. Workforce roster sync is scheduled for Saturday 5:00 AM or can be run manually by an admin.");
    }

    loadGoogleDatabase();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date();
      const currentDate = now.toISOString().slice(0, 10);
      const currentTime = now.toTimeString().slice(0, 5);
      if (currentTime === DAILY_TIMER_STOP_TIME && dailyTimerStopRef.current !== currentDate) {
        dailyTimerStopRef.current = currentDate;
        autoStopDailyTimers(currentDate, DAILY_TIMER_STOP_TIME);
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [employees, timeEntries]);

  function showToast(title, message = "", type = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }

  async function runProtectedAction(key, title, handler) {
    if (actionLockRef.current.has(key)) {
      setProcessingModal({
        status: "warning",
        title: "Already processing",
        message: `${title} is already processing. Please wait a moment.`,
      });
      showToast("Duplicate click prevented", `${title} is already processing. Please wait a moment.`, "warning");
      setTimeout(() => setProcessingModal(null), 1800);
      return null;
    }

    actionLockRef.current.add(key);
    setProcessingModal({
      status: "processing",
      title: "Processing",
      message: `${title} is being saved. Please do not click again.`,
    });
    showToast("Processing", `${title} is being saved. Please do not click again.`, "info");

    try {
      const result = await handler();
      if (result !== "silent") {
        setProcessingModal({
          status: "success",
          title: "Saved successfully",
          message: `${title} was completed successfully.`,
        });
        showToast("Saved successfully", `${title} was completed.`, "success");
        setTimeout(() => setProcessingModal(null), 1600);
      } else {
        setProcessingModal(null);
      }
      return result;
    } catch (error) {
      console.error(error);
      setProcessingModal({
        status: "danger",
        title: "Action failed",
        message: error?.message || "The update was not saved. Please review and try again.",
      });
      showToast("Action failed", error?.message || "Please review the console or try again.", "danger");
      setTimeout(() => setProcessingModal(null), 2600);
      return null;
    } finally {
      actionLockRef.current.delete(key);
    }
  }

  function requestManagerOverride(message) {
    return new Promise((resolve) => {
      overrideResolverRef.current = resolve;
      setManagerOverrideModal({
        title: "Manager override required",
        message,
      });
    });
  }

  function resolveManagerOverride(approved) {
    if (overrideResolverRef.current) {
      overrideResolverRef.current(approved);
      overrideResolverRef.current = null;
    }
    setManagerOverrideModal(null);
  }

  const currentUser = employees.find((e) => normalizeEmail(e.email) === normalizeEmail(sessionUserEmail)) || employees.find((e) => normalizeEmail(e.email) === normalizeEmail(DEFAULT_LOGIN_EMAIL)) || employees[0];
  const canAccessAdmin = hasAdminAccess(currentUser);
  const isAuthenticated = Boolean(sessionUserEmail && currentUser);
  const isAgentOnly = !canAccessAdmin;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser?.id || "");
const selectedEmployee = isAgentOnly
  ? currentUser
  : employees.find((e) => e.id === selectedEmployeeId) || currentUser || null;

  const visibleEmployees = isAgentOnly && currentUser
  ? [currentUser]
  : employees.filter(Boolean);
 const visibleTime = isAgentOnly && currentUser?.id
  ? timeEntries.filter((t) => t.employee_id === currentUser.id)
  : timeEntries;

const visibleRequests = isAgentOnly && currentUser?.id
  ? requests.filter((r) => r.employee_id === currentUser.id)
  : requests;

const visibleActivity = isAgentOnly && currentUser?.id
  ? activityLog.filter((a) => a.employee_id === currentUser.id)
  : activityLog;

  const filteredVisibleEmployees = visibleEmployees.filter((employee) => {
  if (!employee) return false;
    return (
      (filters.lob === "All" || employee.lob === filters.lob) &&
      (filters.department === "All" || employee.department === filters.department) &&
      (filters.subDepartment === "All" || employee.sub_department === filters.subDepartment) &&
      (filters.employee === "All" || employee.full_name === filters.employee) &&
      (filters.country === "All" || employee.country === filters.country)
    );
  });
const scheduleRows =
  filters.employee !== "All"
    ? WEEK_DAYS.map((day) => {
        const employee = filteredVisibleEmployees[0] || selectedEmployee;

        return {
          employee,
          day,
          schedule: getStableSchedule(employee, [], day),
        };
      })
    : filteredVisibleEmployees.map((employee) => ({
        employee,
        day: todayDayName(),
        schedule: getStableSchedule(employee, [], todayDayName()),
      }));
  async function refreshLiveData() {
  const loadedSupabase = await loadSupabaseReferenceData(
    employees,
    setEmployees,
    setDatabaseStatus
  );

  if (supabase) {
  const { data: latestLogs, error: logsError } = await supabase
    .from("time_logs")
    .select("*");

  if (!logsError) {
    setTimeEntries(
      (latestLogs || []).sort((a, b) => {
        const aStamp = `${a.date || ""} ${a.time || ""} ${a.created_at || ""}`;
        const bStamp = `${b.date || ""} ${b.time || ""} ${b.created_at || ""}`;
        return bStamp.localeCompare(aStamp);
      })
    );
  } else {
    console.warn("Time logs refresh failed:", logsError);
  }

  const { data: latestRequests, error: requestsError } = await supabase
    .from("requests")
    .select("*");

  if (!requestsError) {
    setRequests(latestRequests || []);
  } else {
    console.warn("Requests refresh failed:", requestsError);
  }
}

  if (loadedSupabase) {
    showToast(
      "Live data refreshed",
      "Latest Supabase employee, balance, schedule, request, and time log data loaded.",
      "success"
    );
    return;
  }

 
}

useEffect(() => {
  if (!supabase || !isAuthenticated || isAgentOnly) {
    setStartupLoading(false);
    return;
  }

  let cancelled = false;

  const runLiveStartupSync = async () => {
    if (liveAutoSyncRef.current) return;
    liveAutoSyncRef.current = true;

    try {
      setStartupLoading(true);

      await syncWorkforcePlanningSheet({
        silent: true,
        automatic: true,
      });

      if (!cancelled) {
        await refreshLiveData();
        console.log("Live startup sync completed and data refreshed.");
      }
    } catch (error) {
      console.warn("Live startup sync failed:", error);
    } finally {
      if (!cancelled) {
        setStartupLoading(false);
      }
    }
  };

  runLiveStartupSync();

  return () => {
    cancelled = true;
  };
}, [supabase, isAuthenticated, isAgentOnly]);

useEffect(() => {
  if (!supabase) return undefined;

  const reloadLiveLogsOnly = async () => {
    const { data: latestLogs, error } = await supabase
      .from("time_logs")
      .select("*");

    if (!error) {
      setTimeEntries(
        (latestLogs || []).sort((a, b) => {
          const aStamp = `${a.date || ""} ${a.time || ""} ${a.created_at || ""}`;
          const bStamp = `${b.date || ""} ${b.time || ""} ${b.created_at || ""}`;
          return bStamp.localeCompare(aStamp);
        })
      );
    } else {
      console.warn("Realtime time_logs reload failed:", error);
    }
  };

  const channel = supabase
    .channel("magnemite-live-dashboard")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "time_logs" },
      reloadLiveLogsOnly
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
  }, []);
  
  useEffect(() => {
  if (!supabase || isAgentOnly) return undefined;

  const runInitialScheduleSync = async () => {
    const todayKey = getLocalDateKey(new Date());
    const lastSync = localStorage.getItem("MAGNEMITE_SCHEDULE_SYNC_DATE");

    if (lastSync === todayKey) return;

    localStorage.setItem("MAGNEMITE_SCHEDULE_SYNC_DATE", todayKey);

    await syncWorkforcePlanningSheet({
  silent: false,
  automatic: false,
  importMissing: true,
});
  };

  runInitialScheduleSync();

  return undefined;
}, [supabase, isAgentOnly]);

  function resetFilters() {
    setFilters({ lob: "All", department: "All", subDepartment: "All", employee: "All", country: "All", category: "All", startDate: "", endDate: "" });
  }

  useEffect(() => {
    if (!isAuthenticated || isAgentOnly || startupLoading || !employees.length) return;
  const initialRosterSync = async () => {
    const todayKey = getLocalDateKey(new Date());
    const lastInitialSync = localStorage.getItem("MAGNEMITE_INITIAL_ROSTER_SYNC");

    if (lastInitialSync === todayKey) {
  console.log("Daily sync already ran, refreshing current synced employee state.");
}

    await syncWorkforcePlanningSheet({
      silent: true,
      automatic: true
});

    localStorage.setItem("MAGNEMITE_INITIAL_ROSTER_SYNC", todayKey);
    setEmployees((current) => [...current]);
  };

  initialRosterSync();
    const checkWeeklySync = () => {
      const now = new Date();
      if (!isWeeklyWorkforceSyncWindow(now)) return;

      const todayKey = getLocalDateKey(now);
      const lastStoredSync = localStorage.getItem(WORKFORCE_SYNC_LAST_RUN_KEY);

      // Always run on page load so refreshed browser shows the latest schedule

      weeklyWorkforceSyncRef.current = todayKey;
      syncWorkforcePlanningSheet({ silent: true, automatic: true });
    };

    checkWeeklySync();
    const interval = window.setInterval(checkWeeklySync, 60000);
    return () => window.clearInterval(interval);
  }, [isAuthenticated, isAgentOnly, startupLoading, employees.length]);

  const lobOptions = ["All", ...new Set([...lobs, ...visibleEmployees.map((e) => e.lob).filter(Boolean)])];
  const departmentOptions = ["All", ...new Set([...departments, ...visibleEmployees.map((e) => e.department).filter(Boolean)])];
  const subDepartmentOptions = ["All", ...new Set([...subDepartments, ...visibleEmployees.map((e) => e.sub_department).filter(Boolean)])];
  const employeeOptions = ["All", ...visibleEmployees.map((e) => e.full_name)];
  const countryOptions = ["All", ...new Set(visibleEmployees.map((e) => e.country).filter(Boolean))];
  const categoryOptions = ["All", ...timeCategories, "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change"];

  const filteredTime = visibleTime.filter((t) => {
    const dateOk = (!filters.startDate || t.date >= filters.startDate) && (!filters.endDate || t.date <= filters.endDate);
    return (
      dateOk &&
      (filters.lob === "All" || t.lob === filters.lob) &&
      (filters.department === "All" || t.department === filters.department) &&
      (filters.subDepartment === "All" || (t.sub_department || employees.find((e) => e.id === t.employee_id)?.sub_department || "") === filters.subDepartment) &&
      (filters.employee === "All" || t.employee_name === filters.employee) &&
      (filters.country === "All" || employees.find((e) => e.id === t.employee_id)?.country === filters.country) &&
      (filters.category === "All" || t.category === filters.category)
    );
  });

  const filteredRequests = visibleRequests.filter((r) => {
    const employee = employees.find((e) => e.id === r.employee_id);
    const dateOk = (!filters.startDate || r.start_date >= filters.startDate) && (!filters.endDate || r.end_date <= filters.endDate);
    return (
      dateOk &&
      (filters.lob === "All" || employee?.lob === filters.lob) &&
      (filters.department === "All" || employee?.department === filters.department) &&
      (filters.subDepartment === "All" || employee?.sub_department === filters.subDepartment) &&
      (filters.employee === "All" || r.employee_name === filters.employee) &&
      (filters.country === "All" || employee?.country === filters.country) &&
      (filters.category === "All" || r.type === filters.category)
    );
  });

  const filteredEmployees = filteredVisibleEmployees.filter((e) =>
    [e.full_name, e.email, e.lob, e.department, e.sub_department, e.role, e.country, e.supervisor, e.manager]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const requestPreview = useMemo(() => {
    const requestedDays = calculateRequestHours(newRequest);
    const currentBalance = getBalance(selectedEmployee, newRequest.type);
    return {
      requestedHours: requestedDays,
      requestedDays,
      currentBalance,
      projectedBalance: currentBalance === null ? null : Math.max(0, currentBalance - requestedDays),
      impactsBalance: currentBalance !== null,
    };
  }, [newRequest, selectedEmployee]);

  const stats = useMemo(() => {
    const total = filteredTime.reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    const working = filteredTime.filter((t) => t.category === "Working").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    const overtimeMinutes = filteredTime.filter((t) => t.category === "Overtime").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    return {
      active: filteredVisibleEmployees.filter((e) => e.employment_status === "Active").length,
      pendingRequests: visibleRequests.filter((r) => r.status === "Pending").length,
      payrollExceptions: visibleTime.filter((t) => t.approved === "Pending").length,
      productivity: total ? Math.round((working / total) * 100) : 0,
      overtimeMinutes,
      total,
    };
  }, [filteredTime, visibleEmployees, visibleRequests, visibleTime]);

  const categoryStats = useMemo(() => {
    const result = new Map();
    filteredTime.forEach((t) => result.set(t.category, (result.get(t.category) || 0) + minutesBetween(t.category_start, t.category_end)));
    return [...result.entries()].map(([label, minutes]) => ({ label, minutes }));
  }, [filteredTime]);

  const teamStats = useMemo(() => {
    const result = new Map();
    filteredTime
      .filter((t) => ["Break", "Lunch", "Bathroom"].includes(t.category))
      .forEach((t) => {
        const key = `${t.lob} / ${t.department}`;
        result.set(key, (result.get(key) || 0) + minutesBetween(t.category_start, t.category_end));
      });
    return [...result.entries()].map(([label, minutes]) => ({ label, minutes }));
  }, [filteredTime]);

  const reportingSummary = useMemo(() => {
    const keyGetter = reportView === "LOB" ? (item) => item.lob : (item) => item.department;
    const groupedEmployees = groupBy(employees, keyGetter);
    const groups = [];

    groupedEmployees.forEach((groupEmployees, groupName) => {
      const ids = new Set(groupEmployees.map((e) => e.id));
      const groupTime = filteredTime.filter((t) => ids.has(t.employee_id));
      const groupRequests = requests.filter((r) => ids.has(r.employee_id));
      const totalMinutes = groupTime.reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const workingMinutes = groupTime.filter((t) => t.category === "Working").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const breakMinutes = groupTime.filter((t) => ["Break", "Lunch", "Bathroom"].includes(t.category)).reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const otMinutes = groupTime.filter((t) => t.category === "Overtime").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const pendingRequests = groupRequests.filter((r) => r.status === "Pending").length;
      const approvedRequests = groupRequests.filter((r) => r.status === "Approved").length;
      const scheduledBreakLunch = groupEmployees.reduce((sum, e) => sum + safeNumber(e.break_minutes, 0) + safeNumber(e.lunch_minutes, 0), 0);
      const adherenceRisk = breakMinutes > scheduledBreakLunch || pendingRequests > 0;

      groups.push({
        groupName,
        headcount: groupEmployees.length,
        totalMinutes,
        workingMinutes,
        breakMinutes,
        scheduledBreakLunch,
        otMinutes,
        productivity: totalMinutes ? Math.round((workingMinutes / totalMinutes) * 100) : 0,
        pendingRequests,
        approvedRequests,
        adherenceRisk,
      });
    });

    return groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [employees, filteredTime, requests, reportView]);

  const agentReporting = useMemo(() => {
    return filteredVisibleEmployees.map((e) => {
      const empTime = filteredTime.filter((t) => t.employee_id === e.id);
      const totalMinutes = empTime.reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const workingMinutes = empTime.filter((t) => t.category === "Working").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const breakMinutes = empTime.filter((t) => ["Break", "Lunch", "Bathroom"].includes(t.category)).reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const otMinutes = empTime.filter((t) => t.category === "Overtime").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const scheduledBreakLunch = safeNumber(e.break_minutes, 0) + safeNumber(e.lunch_minutes, 0);
      const lateMinutes = empTime.reduce((sum, t) => sum + Math.max(0, minutesBetween(t.scheduled_start, t.clock_in)), 0);
      const productivity = totalMinutes ? Math.round((workingMinutes / totalMinutes) * 100) : 0;
      return { ...e, totalMinutes, workingMinutes, breakMinutes, otMinutes, scheduledBreakLunch, lateMinutes, productivity, variance: breakMinutes - scheduledBreakLunch };
    });
  }, [filteredVisibleEmployees, filteredTime]);

  function getRequestCalendarDays() {
    const baseDate = new Date(`${newRequest.start_date || today}T00:00:00`);
    if (Number.isNaN(baseDate.getTime())) return [];
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    for (let day = 1; day <= lastDay.getDate(); day += 1) {
      const date = new Date(year, month, day);
      const dateKey = getLocalDateKey(date);
      days.push(buildRequestCalendarDay(dateKey));
    }

    return {
      monthLabel: baseDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      days,
      leadingBlanks: firstDay.getDay(),
    };
  }

  function buildRequestCalendarDay(dateKey) {
    const scopedEmployees = filteredVisibleEmployees.filter((employee) => {
      if (employee.employment_status !== "Active") return false;
      if (filters.lob !== "All" && employee.lob !== filters.lob) return false;
      if (filters.department !== "All" && employee.department !== filters.department) return false;
      if (filters.subDepartment !== "All" && employee.sub_department !== filters.subDepartment) return false;
      if (filters.country !== "All" && employee.country !== filters.country) return false;
      return true;
    });

    const dayName = WEEK_DAYS[new Date(`${dateKey}T00:00:00`).getDay()].toLowerCase();
    const offDayAgents = scopedEmployees.filter((employee) => normalizeOffDays(employee.off_days).some((day) => day.toLowerCase() === dayName));
    const scheduledAgents = scopedEmployees.filter((employee) => !offDayAgents.some((off) => off.id === employee.id));
    const approvedOnDate = requests.filter((request) => request.status === "Approved" && requestCoversDate(request, dateKey));
    const ptoAgents = approvedOnDate.filter((request) => request.type === "PTO").length;
    const vtoAgents = approvedOnDate.filter((request) => request.type === "VTO").length;
    const sickAgents = approvedOnDate.filter((request) => request.type === "Sick Leave").length;

    const relatedRule = rules.find((rule) => {
      const dateAllowed = (!rule.start_date || dateKey >= formatDateOnly(rule.start_date)) && (!rule.end_date || dateKey <= formatDateOnly(rule.end_date));
      return dateAllowed &&
        (filters.lob === "All" || rule.lob === filters.lob) &&
        (filters.department === "All" || rule.department === filters.department);
    });

    const projectedPto = ptoAgents + (newRequest.type === "PTO" ? 1 : 0);
    const projectedVto = vtoAgents + (newRequest.type === "VTO" ? 1 : 0);
    const projectedSick = sickAgents + (newRequest.type === "Sick Leave" ? 1 : 0);
    const projectedAvailable = scheduledAgents.length - projectedPto - projectedVto - projectedSick;

    const available = !relatedRule || (
      projectedPto <= safeNumber(relatedRule.max_pto_out, 999) &&
      projectedVto <= safeNumber(relatedRule.max_vto_out, 999) &&
      projectedSick <= safeNumber(relatedRule.max_sick_out, 999) &&
      projectedAvailable >= safeNumber(relatedRule.min_staff_required, 0)
    );

    return {
      dateKey,
      day: Number(dateKey.slice(-2)),
      offDayAgents: offDayAgents.length,
      scheduledAgents: scheduledAgents.length,
      ptoAgents,
      vtoAgents,
      sickAgents,
      available,
      rule: relatedRule,
      projectedAvailable,
    };
  }

  function getRuleUsage(rule) {
    const matchingEmployees = employees.filter((e) => e.department === rule.department && e.lob === rule.lob && e.shift_start === rule.shift_start && e.shift_end === rule.shift_end);
    const matchingRequests = requests.filter((r) => {
      const employee = employees.find((e) => e.id === r.employee_id);
      return employee?.department === rule.department && employee?.lob === rule.lob && employee?.shift_start === rule.shift_start && employee?.shift_end === rule.shift_end && r.status === "Approved";
    });
    const pto = matchingRequests.filter((r) => r.type === "PTO").length;
    const vto = matchingRequests.filter((r) => r.type === "VTO").length;
    const sick = matchingRequests.filter((r) => r.type === "Sick Leave").length;
    const scheduled = matchingEmployees.length;
    const out = pto + vto + sick;
    const available = scheduled - out;
    return { scheduled, pto, vto, sick, out, available };
  }

  function addLob() {
    const value = newLob.trim();
    if (!value) return;
    if (!lobs.includes(value)) setLobs([...lobs, value]);
    googleAddRow("lobs", { LOB_ID: cleanId("LOB"), LOB_Name: value, Status: "Active", Created_Date: new Date() });
    setNewLob("");
  }

  function addDepartment() {
    const value = newDepartment.trim();
    if (!value) return;
    if (!departments.includes(value)) setDepartments([...departments, value]);
    googleAddRow("departments", { Department_ID: cleanId("DEPT"), Department_Name: value, Status: "Active", Created_Date: new Date() });
    setNewDepartment("");
  }

  function deleteLob(value) {
    setLobs(lobs.filter((lob) => lob !== value));
  }

  function deleteDepartment(value) {
    setDepartments(departments.filter((department) => department !== value));
  }

  function addSubDepartment(value) {
    const cleanValue = String(value || "").trim();
    if (!cleanValue) return;
    if (!subDepartments.includes(cleanValue)) setSubDepartments([...subDepartments, cleanValue]);
    googleAddRow("subDepartments", { Sub_Department_ID: cleanId("SUBDEPT"), Sub_Department_Name: cleanValue, Status: "Active", Created_Date: new Date() });
  }

  function deleteSubDepartment(value) {
    setSubDepartments(subDepartments.filter((subDepartment) => subDepartment !== value));
  }

  async function saveEmployee() {
    if (isAgentOnly) return;

    if (!newEmployee.full_name || !newEmployee.email) {
      showToast("Missing employee information", "Name and email are required before saving.", "warning");
      return;
    }

    return runProtectedAction("save-employee-" + normalizeEmail(newEmployee.email), "Employee profile", async () => {
      const generatedPassword = Math.random().toString(36).slice(-8) + "A1!";
      let authUserId = null;

      if (supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: newEmployee.email,
          password: generatedPassword,
        });

        if (error) {
          console.error(error);
          throw new Error(error.message);
        }

        authUserId = data?.user?.id;
      }

      const item = {
        ...newEmployee,
        id: authUserId || cleanId("EMP"),
        temp_password: generatedPassword,
      };

      if (supabase) await supabase.from("employees").upsert(item);
      await googleAddRow("employees", mapEmployeeToSheet(item));

      setEmployees([item, ...employees]);
      setSelectedEmployeeId(item.id);
      setNewEmployee({ ...newEmployee, full_name: "", email: "" });

      setTimeout(() => {
        alert(
          `User created successfully.

Email: ${item.email}
Temporary Password: ${generatedPassword}

User can now log into the Agent Portal.`
        );
      }, 250);
    });
  }

  async function saveRule() {
    if (isAgentOnly) return;

    return runProtectedAction("save-staffing-rule", "Staffing rule", async () => {
      const item = {
        ...newRule,
        id: `RULE-${Date.now().toString().slice(-6)}`,
        max_pto_out: safeNumber(newRule.max_pto_out, 0),
        max_vto_out: safeNumber(newRule.max_vto_out, 0),
        max_sick_out: safeNumber(newRule.max_sick_out, 0),
        min_staff_required: safeNumber(newRule.min_staff_required, 0),
        start_date: newRule.start_date || today,
        end_date: newRule.end_date || "",
        recurrence: newRule.recurrence || "Daily",
      };
      setRules([item, ...rules]);
      await googleAddRow("staffingRules", mapRuleToSheet(item));
    });
  }

  function deleteRule(id) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateEmployeeSchedule(employeeId, field, value) {
  if (!canEditSchedules(selectedEmployee?.access_level || selectedEmployee?.role || "Agent")) {
    showToast("Access denied", "Only Reporting, HR, Managers, and Admin users can modify schedules.", "danger");
    return;
  }
    const updated = employees.map((employee) => {
      if (employee.id !== employeeId) return employee;
      const next = { ...employee, [field]: value };
      if (["break_start", "break_end", "second_break_start", "second_break_end"].includes(field)) {
        next.break_minutes = minutesBetween(next.break_start, next.break_end) + minutesBetween(next.second_break_start, next.second_break_end);
      }
      if (["lunch_start", "lunch_end"].includes(field)) {
        next.lunch_minutes = minutesBetween(next.lunch_start, next.lunch_end);
      }
      return next;
    });
    setEmployees(updated);
    const changedEmployee = updated.find((employee) => employee.id === employeeId);
    if (changedEmployee) {
      googleUpdateRow("employees", "Employee_ID", employeeId, mapEmployeeToSheet(changedEmployee));
    }
  }

  async function updateEmployeeRole(employeeId, newAccessLevel) {
    if (!["Manager", "HR", "Admin"].includes(currentUser?.access_level || currentUser?.role || "")) {
      showToast("Access denied", "Only Manager, HR, or Admin users can update employee role access.", "danger");
      return;
    }

    const target = employees.find((employee) => employee.id === employeeId);
    if (!target) {
      showToast("Employee not found", "The selected employee profile could not be found.", "danger");
      return;
    }

    if (target.access_level === newAccessLevel) {
      showToast("No change needed", `${target.full_name} already has ${newAccessLevel} access.`, "info");
      return;
    }

    const key = `role-update-${employeeId}-${newAccessLevel}`;

    return runProtectedAction(key, "Employee role access update", async () => {
      const updatedEmployee = {
        ...target,
        access_level: newAccessLevel,
        role: newAccessLevel === "Employee" ? "Agent" : newAccessLevel,
      };

      setEmployees((current) =>
        current.map((employee) => (employee.id === employeeId ? updatedEmployee : employee))
      );

      await googleUpdateRow("employees", "Employee_ID", employeeId, mapEmployeeToSheet(updatedEmployee));

      await googleAddRow("approvals", mapApprovalToSheet({
        id: cleanId("ROLE"),
        employee_id: updatedEmployee.id,
        employee_name: updatedEmployee.full_name,
        approval_type: "Employee Role / Access",
        related_record_id: updatedEmployee.id,
        request_type: "Role Update",
        decision: "Updated",
        previous_status: target.access_level,
        new_status: newAccessLevel,
        approved_by: currentUser.email,
        approved_date: new Date(),
        notes: `Role access changed from ${target.access_level} to ${newAccessLevel}.`,
      }));

      if (sessionUserEmail && normalizeEmail(sessionUserEmail) === normalizeEmail(updatedEmployee.email)) {
        localStorage.setItem("candoHrUserEmail", updatedEmployee.email);
      }
    });
  }


  function getAttendanceEmailRecipients(employee) {
    if (!attendanceEmailSettings.enabled || !employee) return "";
    if (attendanceEmailSettings.lobFilter !== "All" && employee.lob !== attendanceEmailSettings.lobFilter) return "";

    const isEmail = (value) => /@/.test(String(value || ""));
    const managerNameOrEmail = String(employee.manager || "").trim();
    const supervisorNameOrEmail = String(employee.supervisor || "").trim();

    const managerEmployees = employees.filter((teamMember) => {
      if (teamMember.employment_status !== "Active") return false;
      if (attendanceEmailSettings.lobFilter !== "All" && teamMember.lob !== attendanceEmailSettings.lobFilter) return false;
      return String(teamMember.manager || "").trim().toLowerCase() === managerNameOrEmail.toLowerCase();
    });

    const supervisorEmployees = employees.filter((teamMember) => {
      if (teamMember.employment_status !== "Active") return false;
      if (attendanceEmailSettings.lobFilter !== "All" && teamMember.lob !== attendanceEmailSettings.lobFilter) return false;
      return String(teamMember.supervisor || "").trim().toLowerCase() === supervisorNameOrEmail.toLowerCase();
    });

    const recipients = [];
    if (attendanceEmailSettings.includeManager && isEmail(managerNameOrEmail)) recipients.push(managerNameOrEmail);
    if (attendanceEmailSettings.includeSupervisor && isEmail(supervisorNameOrEmail)) recipients.push(supervisorNameOrEmail);
    if (attendanceEmailSettings.includeHrWfm && attendanceEmailSettings.hrWfmEmails) {
      attendanceEmailSettings.hrWfmEmails
        .split(/[;,]/)
        .map((email) => email.trim())
        .filter(Boolean)
        .forEach((email) => recipients.push(email));
    }

    // If the manager/supervisor fields are names instead of emails, avoid sending to agents or invalid recipients.
    // Admin can add explicit HR/WFM emails until the employee roster stores manager/supervisor email addresses.
    if (!recipients.length && (managerEmployees.length || supervisorEmployees.length)) return "";

    return [...new Set(recipients.filter(Boolean))].join(", ");
  }

  function buildAttendanceEmailNotes(employee, savedEntries = []) {
    const dateKey = getLocalDateKey(new Date());
    const schedule = getStableSchedule(employee);
    const categories = savedEntries.map((entry) => entry.category).filter(Boolean).join(" / ") || "Time Logged";
    const actions = savedEntries.map((entry) => entry.notes).filter(Boolean).join(" / ") || "Attendance activity";
    return [
      `Date: ${dateKey}`,
      `Employee: ${employee.full_name || "Employee"}`,
      `LOB: ${employee.lob || "N/A"}`,
      `Department: ${employee.department || "N/A"}`,
      `Scheduled Shift: ${formatTimeRange(schedule.shift_start, schedule.shift_end)}`,
      `Latest Action: ${actions}`,
      `Latest Category: ${categories}`,
      `Delivery Mode: ${attendanceEmailSettings.deliveryMode}`,
      `Scheduled Daily Send Time: ${attendanceEmailSettings.sendTime}`,
    ].join(" | ");
  }

  async function queueDailyAttendanceEmail(employee, savedEntries = []) {
    if (!ATTENDANCE_DAILY_EMAILS_ENABLED || !attendanceEmailSettings.enabled || !employee) return;

    const recipients = getAttendanceEmailRecipients(employee);
    if (!recipients) return;

    const dateKey = getLocalDateKey(new Date());
    const queueKey = `${employee.id}-${recipients}-${dateKey}-${attendanceEmailSettings.deliveryMode}`;

    // Daily Summary creates one pending emailQueue row per employee/recipient/date in the current app session.
    // Apps Script should process emailQueue rows with Status = "Pending Send" using GmailApp.sendEmail().
    if (attendanceEmailQueueRef.current.has(queueKey)) return;
    attendanceEmailQueueRef.current.add(queueKey);

    try {
      await googleAddRow("emailQueue", {
        Email_ID: cleanId("EMAIL"),
        Event_Type: "Daily Attendance Summary",
        To_Email: recipients,
        Employee_Email: employee.email || "",
        Employee_Name: employee.full_name || "",
        Request_ID: savedEntries.map((entry) => entry.id).join(", "),
        Subject: `Daily Attendance Report - ${employee.full_name || "Employee"} - ${dateKey}`,
        Status: "Pending Send",
        Send_Mode: attendanceEmailSettings.deliveryMode,
        Send_Time: attendanceEmailSettings.sendTime,
        Created_At: new Date(),
        Notes: buildAttendanceEmailNotes(employee, savedEntries),
      });
    } catch (error) {
      console.error("Daily attendance email queue failed:", error);
    }
  }

  async function queueAttendanceTestEmail() {
    if (isAgentOnly) return;
    const testEmployee = selectedEmployee || currentUser;
    const recipients = getAttendanceEmailRecipients(testEmployee);

    if (!recipients) {
      showToast("No recipients found", "Add a manager, supervisor, or HR/WFM email before sending a test queue item.", "warning");
      return;
    }

    return runProtectedAction("attendance-email-test", "Attendance email test", async () => {
      await googleAddRow("emailQueue", {
        Email_ID: cleanId("EMAIL"),
        Event_Type: "Attendance Email Test",
        To_Email: recipients,
        Employee_Email: testEmployee.email || "",
        Employee_Name: testEmployee.full_name || "",
        Request_ID: "TEST",
        Subject: `TEST - Daily Attendance Report - ${testEmployee.full_name || "Employee"}`,
        Status: "Pending Send",
        Send_Mode: attendanceEmailSettings.deliveryMode,
        Send_Time: attendanceEmailSettings.sendTime,
        Created_At: new Date(),
        Notes: buildAttendanceEmailNotes(testEmployee, [{ id: "TEST", category: "Test", notes: "Attendance email test queue item" }]),
      });
      showToast("Test queued", "A Pending Send row was added to emailQueue for Apps Script to send.", "success");
    });
  }

  async function agentAction(action, status = agentStatus) {
    if (status === "Overtime" && action !== "Shift Ended") {
      showToast("Manual overtime disabled", "Overtime is created automatically after the scheduled shift end.", "warning");
      return null;
    }

  // Prevent crash if no employee is selected yet
  if (!selectedEmployee?.id) {
    console.warn("No selected employee. Agent action stopped.");
    return;
  }

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const schedule = getStableSchedule(selectedEmployee);

    const autoClass = getAutoWorkClassification(selectedEmployee, time);

    if (
      ["Shift Started", "Status Changed"].includes(action) &&
      ["Off-Day Unscheduled", "Early Unscheduled"].includes(autoClass.category) &&
      !requests.some((request) =>
  String(request.employee_id) === String(selectedEmployee?.id) &&
  request.type === "Schedule Override" &&
  request.status === "Approved" &&
  String(request.requested_at || request.date || request.created_at || "").slice(0, 10) === today
)
    ) {
      const reason =
        autoClass.category === "Off-Day Unscheduled"
          ? "Attempted login on scheduled off day"
          : "Attempted login before scheduled shift start";

      if (!hasPendingScheduleOverride(requests, selectedEmployee?.id)) {
        const overrideRequest = buildScheduleOverrideRequest(selectedEmployee, reason);
        setRequests((current) => [overrideRequest, ...current]);

        try {
          await googleAddRow("requests", mapRequestToSheet(overrideRequest));
          await googleAddRow("emailQueue", {
            Email_ID: cleanId("EMAIL"),
            Event_Type: "Schedule Override Pending Approval",
            To_Email: selectedEmployee.manager || selectedEmployee.supervisor || "",
            Employee_Email: selectedEmployee.email,
            Employee_Name: selectedEmployee.full_name,
            Request_ID: overrideRequest.id,
            Subject: "Schedule override pending manager approval",
            Status: "Pending Send",
            Created_At: new Date(),
          });
        } catch (error) {
          console.error("Schedule override sync failed:", error);
        }
      }

      window.alert("You are not available to log in at this time. Please reach your manager. A Schedule Override request has been created for manager approval.");
      showToast(
        "Manager approval required",
        "You are outside your approved schedule. A Schedule Override request was submitted and work is blocked until approval.",
        "warning"
      );
      return null;
    }

    const hasApprovedScheduleOverride = requests.some((request) =>
  String(request.employee_id) === String(selectedEmployee?.id) &&
  request.type === "Schedule Override" &&
  request.status === "Approved" &&
  String(request.requested_at || request.date || "").slice(0, 10) === today
);

const resolvedStatus =
  action === "Shift Ended" && shouldSplitAutoOvertime(selectedEmployee, time)
    ? "Overtime"
    : hasApprovedScheduleOverride
    ? status
    : action === "Shift Started" || action === "Status Changed"
    ? autoClass.category === "Working"
      ? status
      : autoClass.category
    : status;

    const approvalStatus =
      resolvedStatus === "Off-Day Unscheduled" || resolvedStatus === "Early Unscheduled"
        ? "Pending Approval"
        : resolvedStatus === "Overtime"
          ? "Pending"
          : action.includes("Shift")
            ? "Pending"
            : "Auto Logged";

    const key = `agent-action-${selectedEmployee.id}-${action}-${resolvedStatus}-${time}`;
    return runProtectedAction(key, action, async () => {
      const openLog = timeEntries.find(
  (entry) =>
    String(entry.employee_id) === String(selectedEmployee.id) &&
    !entry.clock_out
);

if (openLog) {
  const clockOut = now.toISOString();
  const clockIn = new Date(openLog.clock_in || openLog.category_start);
  const durationMinutes = Math.max(
    0,
    Math.round((new Date(clockOut) - clockIn) / 60000)
  );

  const closedLog = {
    ...openLog,
    clock_out: clockOut,
    category_end: time,
    duration_minutes: durationMinutes,
  };

  setTimeEntries((current) =>
    current.map((entry) => (entry.id === openLog.id ? closedLog : entry))
  );

  if (supabase) {
    await supabase
      .from("time_logs")
      .update({
        clock_out: clockOut,
        duration_minutes: durationMinutes,
      })
      .eq("id", openLog.id);
  }

  try {
    await googleAddRow("Time_Logs", mapTimeLogToSheet(closedLog));
  } catch (error) {
    console.warn("Google Sheet close log update skipped:", error);
  }
}
      const duplicate = timeEntries.some(
        (entry) =>
          entry.employee_id === selectedEmployee.id &&
          entry.date === today &&
          entry.category === resolvedStatus &&
          entry.category_start === time &&
          entry.notes === action
      );

      if (duplicate) {
        showToast("Duplicate status log prevented", "This same status/action was already logged for this minute.", "warning");
        return "silent";
      }

      const activity = {
        id: `ACT-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        action,
        time,
        status: resolvedStatus,
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
        sub_department: selectedEmployee.sub_department || "",
      };

      const baseTimeEntry = {
        id: `TIME-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        scheduled_start: schedule.shift_start,
        scheduled_end: schedule.shift_end,
        schedule_break_1: formatTimeRange(schedule.break_start, schedule.break_end),
        schedule_lunch: formatTimeRange(schedule.lunch_start, schedule.lunch_end),
        schedule_break_2: formatTimeRange(schedule.second_break_start, schedule.second_break_end),
        schedule_off_days: schedule.off_days,
        schedule_source: "Employee Master Schedule",
        clock_in: new Date().toISOString(),
        clock_out: null,
        category: resolvedStatus,
        category_start: time,
        category_end: null,
        duration_minutes: 0,
        approved: approvalStatus,
        payable_status: approvalStatus === "Pending Approval" || resolvedStatus === "Overtime" ? "Pending Manager Approval" : "Regular",
        locked: approvalStatus === "Pending Approval",
        auto_rule: autoClass.reason,
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
        sub_department: selectedEmployee.sub_department || "",
        notes: action,
      };

      const entriesToSave = [];

      if (action === "Shift Ended" && shouldSplitAutoOvertime(selectedEmployee, time)) {
        const regularEntry = {
          ...baseTimeEntry,
          id: cleanId("TIME"),
          category: "Working",
          category_start: schedule.shift_start,
          category_end: schedule.shift_end,
          approved: "Auto Logged",
          payable_status: "Regular",
          locked: false,
          auto_rule: "Regular scheduled shift completed before auto overtime",
          notes: "Regular shift completed",
        };

        const overtimeEntry = {
          ...baseTimeEntry,
          id: cleanId("TIME"),
          category: "Overtime",
          category_start: schedule.shift_end,
          category_end: time,
          approved: "Pending",
          payable_status: "Pending Manager Approval",
          locked: false,
          auto_rule: "Auto overtime after scheduled shift end",
          notes: "Auto overtime created at shift end",
        };

        entriesToSave.push(regularEntry, overtimeEntry);
        showToast("Auto overtime created", `Time after ${schedule.shift_end} was moved to overtime pending review.`, "info");
      } else {
        entriesToSave.push(baseTimeEntry);
      }

      await supabaseInsert(
        "time_logs",
        entriesToSave.map((entry) => mapTimeEntryToSupabaseLog(entry, selectedEmployee)),
        "Agent time log"
      );
      for (const entry of entriesToSave) {
        await googleAddRow("timeLogs", mapTimeToSheet(entry));
      }

      await queueDailyAttendanceEmail(selectedEmployee, entriesToSave);

      setActivityLog((current) => [activity, ...current]);
      setTimeEntries((current) => [...entriesToSave, ...current]);
    });
  }

  function getOpenShiftEmployeesForDate(dateValue) {
    return employees.filter((employee) => {
      if (employee.employment_status !== "Active") return false;
      const employeeEntries = timeEntries.filter((entry) => entry.employee_id === employee.id && entry.date === dateValue);
      const hasShiftStart = employeeEntries.some((entry) => entry.notes === "Shift Started" || entry.category === "Working");
      const hasShiftEnd = employeeEntries.some((entry) => entry.notes === "Shift Ended" || entry.notes === "System auto logout at 12:59" || entry.category === "Auto Logout");
      return hasShiftStart && !hasShiftEnd;
    });
  }

  async function autoStopDailyTimers(dateValue = new Date().toISOString().slice(0, 10), stopTime = DAILY_TIMER_STOP_TIME) {
    const openEmployees = getOpenShiftEmployeesForDate(dateValue);
    if (!openEmployees.length) return;

    const autoEntries = openEmployees.map((employee) => {
      const schedule = getStableSchedule(employee);
      return {
        id: cleanId("TIME"),
        employee_id: employee.id,
        employee_name: employee.full_name,
        date: dateValue,
        scheduled_start: schedule.shift_start,
        scheduled_end: schedule.shift_end,
        schedule_break_1: formatTimeRange(schedule.break_start, schedule.break_end),
        schedule_lunch: formatTimeRange(schedule.lunch_start, schedule.lunch_end),
        schedule_break_2: formatTimeRange(schedule.second_break_start, schedule.second_break_end),
        schedule_off_days: schedule.off_days,
        schedule_source: "System daily timer stop",
        clock_in: schedule.shift_start,
        clock_out: stopTime,
        category: "Auto Logout",
        category_start: stopTime,
        category_end: stopTime,
        approved: "Pending",
        payable_status: "Pending Manager Review",
        locked: false,
        auto_rule: `System stopped active timer at ${stopTime} because no shift end was recorded.`,
        lob: employee.lob,
        department: employee.department,
        sub_department: employee.sub_department || "",
        notes: "System auto logout at 12:59",
      };
    });

    const autoActivities = openEmployees.map((employee) => ({
      id: cleanId("ACT"),
      employee_id: employee.id,
      employee_name: employee.full_name,
      date: dateValue,
      action: "System Auto Logout",
      time: stopTime,
      status: "Auto Logout",
      lob: employee.lob,
      department: employee.department,
      sub_department: employee.sub_department || "",
    }));

    try {
      await supabaseInsert(
        "time_logs",
        autoEntries.map((entry) => mapTimeEntryToSupabaseLog(entry, employees.find((employee) => employee.id === entry.employee_id))),
        "Daily auto logout time log"
      );
      for (const entry of autoEntries) {
        await googleAddRow("timeLogs", mapTimeToSheet(entry));
      }
    } catch (error) {
      console.error("Daily auto logout sync failed:", error);
    }

    setTimeEntries((current) => [...autoEntries, ...current]);
    setActivityLog((current) => [...autoActivities, ...current]);
    showToast("Daily timer stop completed", `${autoEntries.length} open shift timer(s) were closed automatically at ${stopTime}.`, "info");
  }

  async function saveTime() {
    if (!canEditTimeLogs(currentUser?.access_level || currentUser?.role || "Employee")) {
      showToast("Access denied", "Only TLs, Managers, Reporting, HR, Payroll, and Admin users can edit time logs.", "danger");
      return null;
    }
    if (newTime.category === "Overtime") {
      showToast("Manual overtime disabled", "Overtime is created automatically after the scheduled shift end.", "warning");
      return null;
    }
    const schedule = getStableSchedule(selectedEmployee);
    const key = `manual-time-${selectedEmployee.id}-${newTime.category}-${newTime.category_start}-${newTime.category_end}`;
    return runProtectedAction(key, "Manual time entry", async () => {
      const duplicate = timeEntries.some(
        (entry) =>
          entry.employee_id === selectedEmployee.id &&
          entry.date === today &&
          entry.category === newTime.category &&
          entry.category_start === newTime.category_start &&
          entry.category_end === newTime.category_end &&
          entry.notes === newTime.notes
      );

      if (duplicate) {
        showToast("Duplicate time entry prevented", "This exact time entry already exists and was not added again.", "warning");
        return "silent";
      }

      const manualClass = getAutoWorkClassification(selectedEmployee, newTime.category_start);
      const manualCategory = newTime.category === "Working" && manualClass.category !== "Working" ? manualClass.category : newTime.category;
      const manualApproval = ["Off-Day Unscheduled", "Early Unscheduled"].includes(manualCategory) ? "Pending Approval" : "Pending";

      const item = {
        id: `TIME-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        scheduled_start: schedule.shift_start,
        scheduled_end: schedule.shift_end,
        schedule_break_1: formatTimeRange(schedule.break_start, schedule.break_end),
        schedule_lunch: formatTimeRange(schedule.lunch_start, schedule.lunch_end),
        schedule_break_2: formatTimeRange(schedule.second_break_start, schedule.second_break_end),
        schedule_off_days: schedule.off_days,
        schedule_source: "Employee Master Schedule",
        clock_in: schedule.shift_start,
        clock_out: schedule.shift_end,
        approved: manualApproval,
        payable_status: manualApproval === "Pending Approval" || manualCategory === "Overtime" ? "Pending Manager Approval" : "Pending Review",
        locked: manualApproval === "Pending Approval",
        auto_rule: manualClass.reason,
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
        sub_department: selectedEmployee.sub_department || "",
        ...newTime,
        category: manualCategory,
      };
      await supabaseInsert("time_logs", mapTimeEntryToSupabaseLog(item, selectedEmployee), "Manual time log");
      await googleAddRow("timeLogs", mapTimeToSheet(item));
      await queueDailyAttendanceEmail(selectedEmployee, [item]);
      setTimeEntries((current) => [item, ...current]);
    });
  }

  async function saveRequest() {
    const key = `request-${selectedEmployee.id}-${newRequest.type}-${newRequest.start_date}-${newRequest.end_date}-${newRequest.hours}-${newRequest.reason}`;
    return runProtectedAction(key, "Request submission", async () => {
      const duplicate = requests.some(
        (request) =>
          request.employee_id === selectedEmployee.id &&
          request.type === newRequest.type &&
          request.start_date === newRequest.start_date &&
          request.end_date === newRequest.end_date &&
          request.status === "Pending" &&
          String(request.reason || "").trim() === String(newRequest.reason || "").trim()
      );

      if (duplicate) {
        showToast("Duplicate request prevented", "A matching pending request already exists and was not submitted again.", "warning");
        return "silent";
      }

      const item = {
        id: `REQ-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        manager: selectedEmployee.supervisor || selectedEmployee.manager,
        status: "Pending",
        ...newRequest,
        hours: requestPreview.requestedHours,
        requested_days: requestPreview.requestedDays,
        current_balance: requestPreview.currentBalance,
        projected_balance: requestPreview.projectedBalance,
      };
      await supabaseInsert("requests", mapRequestToSupabaseRequest(item, selectedEmployee), "Time-off request");
      await googleAddRow("requests", mapRequestToSheet(item));
      await supabaseInsert(
        "email_queue",
        mapEmailToSupabaseQueue({
          recipient: selectedEmployee.manager || selectedEmployee.supervisor || "Manager",
          subject: `Pending ${item.type} request approval`,
          body: `${selectedEmployee.full_name} submitted a ${item.type} request from ${formatDateOnly(item.start_date)} to ${formatDateOnly(item.end_date)}. Reason: ${item.reason || "N/A"}`,
        }),
        "Request approval email queue"
      );
      await googleAddRow("emailQueue", { Email_ID: cleanId("EMAIL"), Event_Type: "Request Pending Approval", To_Email: selectedEmployee.manager || selectedEmployee.supervisor || "", Employee_Email: selectedEmployee.email, Employee_Name: selectedEmployee.full_name, Request_ID: item.id, Subject: `Pending ${item.type} request approval`, Status: "Pending Send", Created_At: new Date() });
      setRequests((current) => [item, ...current]);
    });
  }

  function getApprovalRiskMessage(request) {
    const employee = employees.find((e) => e.id === request.employee_id);
    if (!employee) return "Employee profile was not found. Please confirm before approving.";

    const balance = getBalance(employee, request.type);

if (balance !== null && safeNumber(request.hours, 0) > safeNumber(balance, 0)) {
  return `${request.employee_name} is requesting ${request.hours} PTO day(s), but the available balance is ${balance} day(s). Manager override is required to continue.`;
}

    const rule = rules.find(
      (r) =>
        r.lob === employee.lob &&
        r.department === employee.department &&
        r.shift_start === employee.shift_start &&
        r.shift_end === employee.shift_end
    );

    if (!rule) return null;

    const usage = getRuleUsage(rule);
    const nextPto = usage.pto + (request.type === "PTO" ? 1 : 0);
    const nextVto = usage.vto + (request.type === "VTO" ? 1 : 0);
    const nextSick = usage.sick + (request.type === "Sick Leave" ? 1 : 0);
    const nextAvailable = usage.scheduled - (nextPto + nextVto + nextSick);

    const exceedsRule =
      nextPto > safeNumber(rule.max_pto_out, 0) ||
      nextVto > safeNumber(rule.max_vto_out, 0) ||
      nextSick > safeNumber(rule.max_sick_out, 0) ||
      nextAvailable < safeNumber(rule.min_staff_required, 0);

    if (!exceedsRule) return null;

    return `Approving this ${request.type} may exceed the staffing rule for ${employee.lob} / ${employee.department}. Current after approval: PTO ${nextPto}/${rule.max_pto_out}, VTO ${nextVto}/${rule.max_vto_out}, Sick ${nextSick}/${rule.max_sick_out}, Available ${nextAvailable}, Minimum required ${rule.min_staff_required}. Manager override is required.`;
  }

  async function setRequestStatus(id, status) {
    if (isAgentOnly) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    if (status === "Approved") {
      const riskMessage = getApprovalRiskMessage(request);
      if (riskMessage) {
        const approvedOverride = await requestManagerOverride(riskMessage);
        if (!approvedOverride) {
          showToast("Approval cancelled", "The request was not approved because the override was cancelled.", "warning");
          return;
        }
      }
    }

    const key = `request-approval-${id}-${status}`;
    if (request.status === status) {
      showToast("Duplicate approval prevented", `This request is already marked as ${status}.`, "warning");
      return;
    }

    return runProtectedAction(key, `Request ${status}`, async () => {
      const latestRequest = requests.find((r) => r.id === id) || request;
      let updatedEmployees = employees;
      let updatedEmployee = employees.find((e) => e.id === latestRequest.employee_id);

      if (status === "Approved") {
        const field = balanceField(latestRequest.type);
        if (field) {
          updatedEmployees = employees.map((e) => {
            if (e.id !== latestRequest.employee_id) return e;
            const newBalance = Math.max(0, safeNumber(e[field], 0) - safeNumber(latestRequest.hours, 0));
            return { ...e, [field]: newBalance };
          });
          updatedEmployee = updatedEmployees.find((e) => e.id === latestRequest.employee_id);

          if (supabase && updatedEmployee) {
            await supabase.from("employees").update({ [field]: updatedEmployee[field] }).eq("email", updatedEmployee.email);
          }

          if (updatedEmployee) {
            await googleUpdateRow("employees", "Employee_ID", latestRequest.employee_id, mapEmployeeToSheet(updatedEmployee));
          }
        }

        if (latestRequest.type === "Schedule Override" && updatedEmployee) {
          updatedEmployees = updatedEmployees.map((employee) =>
            employee.id === latestRequest.employee_id
              ? {
                  ...employee,
                  off_day_approved: true,
                  schedule_exception_date: latestRequest.start_date || today,
                  schedule_exception_reason: latestRequest.reason || "Approved schedule override",
                }
              : employee
          );
          updatedEmployee = updatedEmployees.find((employee) => employee.id === latestRequest.employee_id);
          if (updatedEmployee) {
            await googleUpdateRow("employees", "Employee_ID", latestRequest.employee_id, mapEmployeeToSheet(updatedEmployee));
          }
          showToast(
            "Schedule exception approved",
            `${latestRequest.employee_name} can now log in outside the standard schedule for ${formatDateOnly(latestRequest.start_date || today)} only.`,
            "success"
          );
        }

        if (latestRequest.type === "Schedule Change" && updatedEmployee) {
          const schedulePayload = getScheduleChangePayload(latestRequest);

          if (Object.keys(schedulePayload).length) {
            updatedEmployees = updatedEmployees.map((employee) => {
              if (employee.id !== latestRequest.employee_id) return employee;
              const next = { ...employee, ...schedulePayload };
              next.break_minutes = minutesBetween(next.break_start, next.break_end) + minutesBetween(next.second_break_start, next.second_break_end);
              next.lunch_minutes = minutesBetween(next.lunch_start, next.lunch_end);
              return next;
            });

            updatedEmployee = updatedEmployees.find((employee) => employee.id === latestRequest.employee_id);

            if (updatedEmployee) {
              await googleUpdateRow("employees", "Employee_ID", latestRequest.employee_id, mapEmployeeToSheet(updatedEmployee));
            }
          }
        }
      }

      const updatedRequest = {
        ...latestRequest,
        status,
        manager: currentUser.email,
        projected_balance:
          status === "Approved" && updatedEmployee && balanceField(latestRequest.type)
            ? updatedEmployee[balanceField(latestRequest.type)]
            : latestRequest.projected_balance,
      };

      await updateSupabaseRequestDecision(
        { ...latestRequest, employee_email: updatedEmployee?.email || latestRequest.employee_email || "" },
        status,
        currentUser.email,
        `Manager decision recorded for ${latestRequest.type}`
      );

      await supabaseInsert(
        "approvals",
        mapApprovalToSupabaseApproval({
          request: { ...latestRequest, employee_email: updatedEmployee?.email || latestRequest.employee_email || "" },
          approverEmail: currentUser.email,
          status,
          notes: `${latestRequest.type} request ${status} for ${latestRequest.employee_name}. App request ID: ${latestRequest.id}`,
        }),
        "Approval decision"
      );

      await googleUpdateRow("requests", "Request_ID", id, mapRequestToSheet(updatedRequest));
      await supabaseInsert(
        "email_queue",
        mapEmailToSupabaseQueue({
          recipient: updatedEmployee?.email || "",
          subject: `${latestRequest.type} request ${status}`,
          body: `Your ${latestRequest.type} request from ${formatDateOnly(latestRequest.start_date)} to ${formatDateOnly(latestRequest.end_date)} was ${status}.`,
        }),
        "Request decision email queue"
      );

      await googleAddRow("emailQueue", { Email_ID: cleanId("EMAIL"), Event_Type: `Request ${status}`, To_Email: updatedEmployee?.email || "", Employee_Email: updatedEmployee?.email || "", Employee_Name: latestRequest.employee_name, Request_ID: latestRequest.id, Subject: `${latestRequest.type} request ${status}`, Status: "Pending Send", Created_At: new Date() });

      await googleAddRow(
        "approvals",
        mapApprovalToSheet({
          id: cleanId("APPROVAL"),
          employee_id: latestRequest.employee_id,
          employee_name: latestRequest.employee_name,
          approval_type: "Time Off / Request",
          related_record_id: latestRequest.id,
          request_type: latestRequest.type,
          decision: status,
          previous_status: latestRequest.status,
          new_status: status,
          approved_by: currentUser.email,
          approved_date: new Date(),
          hours: latestRequest.hours,
          current_balance: latestRequest.current_balance,
          projected_balance: updatedRequest.projected_balance,
          notes: `Manager decision recorded for ${latestRequest.type}`,
        })
      );

      setEmployees(updatedEmployees);
      setRequests((current) => current.map((r) => (r.id === id ? updatedRequest : r)));
    });
  }

  async function setTimeStatus(id, approved) {
    if (isAgentOnly) return;

    const timeEntry = timeEntries.find((t) => t.id === id);
    if (!timeEntry) return;

    const key = `time-approval-${id}-${approved}`;
    if (timeEntry.approved === approved) {
      showToast("Duplicate approval prevented", `This time entry is already marked as ${approved}.`, "warning");
      return;
    }

    return runProtectedAction(key, `Time entry ${approved}`, async () => {
      const latestTimeEntry = timeEntries.find((t) => t.id === id) || timeEntry;
      const updatedTimeEntry = {
        ...latestTimeEntry,
        approved,
        approved_by: currentUser.email,
        payable_status: approved === "Approved" ? "Approved Payable" : approved === "Denied" ? "Denied / Not Payable" : latestTimeEntry.payable_status,
        locked: false,
      };

      if (supabase) await supabase.from("time_logs").update({ approval_status: approved }).eq("app_log_id", id);

      await googleUpdateRow("timeLogs", "Log_ID", id, mapTimeToSheet(updatedTimeEntry));

      await googleAddRow(
        "approvals",
        mapApprovalToSheet({
          id: cleanId("APPROVAL"),
          employee_id: latestTimeEntry.employee_id,
          employee_name: latestTimeEntry.employee_name,
          approval_type: "Time Log / Overtime / Disposition",
          related_record_id: latestTimeEntry.id,
          request_type: latestTimeEntry.category,
          decision: approved,
          previous_status: latestTimeEntry.approved,
          new_status: approved,
          approved_by: currentUser.email,
          approved_date: new Date(),
          hours: (minutesBetween(latestTimeEntry.category_start, latestTimeEntry.category_end) / 60).toFixed(2),
          notes: `Manager decision recorded for ${latestTimeEntry.category}`,
        })
      );

      setTimeEntries((current) => current.map((t) => (t.id === id ? updatedTimeEntry : t)));
    });
  }


  function editTimeEntryLocal(id, field, value) {
    if (!canEditTimeLogs(currentUser?.access_level || currentUser?.role || "Employee")) {
      showToast("Access denied", "Only TLs, Managers, Reporting, HR, Payroll, and Admin users can edit previous time logs.", "danger");
      return;
    }

    setTimeEntries((current) =>
      current.map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry, [field]: value };
        if (field === "category" && value === "Overtime") {
          next.approved = "Pending";
          next.payable_status = "Pending Manager Approval";
          next.auto_rule = next.auto_rule || "Manual correction changed to overtime for payroll review";
        }
        return next;
      })
    );
  }

  async function saveEditedTimeEntry(id) {
    if (!canEditTimeLogs(currentUser?.access_level || currentUser?.role || "Employee")) {
      showToast("Access denied", "Only TLs, Managers, Reporting, HR, Payroll, and Admin users can save time log corrections.", "danger");
      return null;
    }

    const timeEntry = timeEntries.find((entry) => entry.id === id);
    if (!timeEntry) {
      showToast("Time entry not found", "The selected time log could not be found.", "danger");
      return null;
    }

    const key = `time-log-edit-${id}-${timeEntry.date}-${timeEntry.category}-${timeEntry.category_start}-${timeEntry.category_end}`;

    return runProtectedAction(key, "Time log correction", async () => {
      const correctedEntry = {
        ...timeEntry,
        category_start: formatMilitaryTime(timeEntry.category_start),
        category_end: formatMilitaryTime(timeEntry.category_end),
        clock_in: formatMilitaryTime(timeEntry.clock_in || timeEntry.category_start),
        clock_out: formatMilitaryTime(timeEntry.clock_out || timeEntry.category_end),
        edited_by: currentUser.email,
        edited_at: new Date().toISOString(),
        approved_by: currentUser.email,
      };

      if (supabase) {
        await supabase.from("time_logs").update(mapTimeEntryToSupabaseLog(correctedEntry, employees.find((e) => e.id === correctedEntry.employee_id) || {})).eq("app_log_id", id);
      }

      await googleUpdateRow("timeLogs", "Log_ID", id, mapTimeToSheet(correctedEntry));

      await googleAddRow(
        "approvals",
        mapApprovalToSheet({
          id: cleanId("TIMEEDIT"),
          employee_id: correctedEntry.employee_id,
          employee_name: correctedEntry.employee_name,
          approval_type: "Time Log Manual Correction",
          related_record_id: correctedEntry.id,
          request_type: correctedEntry.category,
          decision: "Corrected",
          previous_status: timeEntry.approved || "Pending Review",
          new_status: correctedEntry.approved || "Pending Review",
          approved_by: currentUser.email,
          approved_date: new Date(),
          hours: (minutesBetween(correctedEntry.category_start, correctedEntry.category_end) / 60).toFixed(2),
          notes: correctedEntry.notes || "Manager/TL time log correction saved from Time tab.",
        })
      );

      setTimeEntries((current) => current.map((entry) => (entry.id === id ? correctedEntry : entry)));
      showToast("Time log saved", "The previous time log was corrected and retained for audit review.", "success");
    });
  }

  function importEmployees(event) {
    if (isAgentOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = String(e.target?.result || "");
      const [headerLine, ...rows] = text.split(/\r?\n/).filter(Boolean);
      const headers = headerLine.split(",").map((h) => h.trim());
      const imported = rows.map((row, index) => {
        const values = row.split(",").map((v) => v.trim());
        const r = Object.fromEntries(headers.map((h, i) => [h, values[i] || ""]));
        return {
          id: r.Employee_ID || `IMP-${Date.now()}-${index}`,
          full_name: r.Full_Name || r.full_name || "Unnamed Employee",
          email: r.Email || r.email || "",
          country: r.Country || "Costa Rica",
          department: r.Department || "Operations",
          lob: r.LOB || r.lob || "GoDay",
          role: r.Role || "Agent",
          access_level: r.Access_Level || "Employee",
          supervisor: r.Supervisor || "",
          manager: r.Manager || "",
          hire_date: r.Hire_Date || "",
          birthday: r.Birthday || "",
          employment_status: r.Employment_Status || "Active",
          employment_type: r.Employment_Type || "Full-Time",
          shift_start: r.Scheduled_Shift_Start || "08:00",
          shift_end: r.Scheduled_Shift_End || "17:00",
          break_start: r.Break_Start || "10:00",
          break_end: r.Break_End || "10:15",
          lunch_start: r.Lunch_Start || "12:00",
          lunch_end: r.Lunch_End || "13:00",
          second_break_start: r.Second_Break_Start || "15:00",
          second_break_end: r.Second_Break_End || "15:15",
          lunch_minutes: safeNumber(r.Lunch_Minutes, 60),
          break_minutes: safeNumber(r.Break_Minutes, 30),
          pto_balance: safeNumber(r.PTO_Balance, 0),
          sick_balance: safeNumber(r.Sick_Balance, 0),
          vto_balance: safeNumber(r.VTO_Balance, 0),
        };
      });
      if (supabase && imported.length) await supabase.from("employees").upsert(imported);
      setEmployees([...imported, ...employees]);
    };
    reader.readAsText(file);
  }

  function exportTimeCsv() {
    const headers = ["employee_name", "date", "lob", "department", "category", "category_start", "category_end", "duration_minutes", "approved", "notes"];
    const rows = filteredTime.map((t) => ({ ...t, duration_minutes: minutesBetween(t.category_start, t.category_end) }));
    downloadFile("cando-hr-time-report.csv", csv(rows, headers), "text/csv");
  }

  function exportRequestsCsv() {
    const headers = ["employee_name", "type", "start_date", "end_date", "hours", "requested_days", "current_balance", "projected_balance", "status", "manager", "reason"];
    downloadFile("cando-hr-requests-report.csv", csv(filteredRequests, headers), "text/csv");
  }

  function exportReportingCsv() {
    const headers = ["groupName", "headcount", "totalMinutes", "workingMinutes", "breakMinutes", "scheduledBreakLunch", "otMinutes", "productivity", "pendingRequests", "approvedRequests", "adherenceRisk"];
    downloadFile(`cando-hr-reporting-by-${reportView.toLowerCase()}.csv`, csv(reportingSummary, headers), "text/csv");
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Magnemite.app Workforce Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
    autoTable(doc, {
      startY: 32,
      head: [["Employee", "Date", "LOB", "Dept", "Category", "Time", "Duration", "Status"]],
      body: filteredTime.map((t) => [t.employee_name, t.date, t.lob, t.department, t.category, `${t.category_start}-${t.category_end}`, formatHours(minutesBetween(t.category_start, t.category_end)), t.approved]),
    });
    doc.save("cando-hr-report.pdf");
  }

  async function createArchiveBackup() {
    return runProtectedAction("archive-backup", "Archive backup", async () => {
      const archive = {
        archive_id: cleanId("ARCHIVE"),
        generated_at: new Date().toISOString(),
        generated_by: currentUser?.email || "demo-user",
        environment: GOOGLE_API_URL ? "google-sheets-enabled" : "demo-mode",
        employees,
        timeEntries,
        requests,
        activityLog,
        rules,
        lobs,
        departments,
      };

      downloadFile(
        `cando-hr-archive-${today}.json`,
        JSON.stringify(archive, null, 2),
        "application/json"
      );

      await googleAddRow("archiveActivity", {
        Archive_ID: archive.archive_id,
        Generated_At: archive.generated_at,
        Generated_By: archive.generated_by,
        Employees: employees.length,
        Time_Logs: timeEntries.length,
        Requests: requests.length,
        Notes: "Manual archive backup generated from HR Workforce staging/demo app.",
      });
    });
  }

  function login() {
    const employee = employees.find((e) => normalizeEmail(e.email) === normalizeEmail(loginEmail));

    if (!employee) {
      setAuthError("No active employee profile was found for this email. Please contact HR or your manager.");
      return;
    }

    const employeeStatus = String(employee.employment_status || employee.status || "Active").toLowerCase();
    if (employeeStatus !== "active") {
      setAuthError("This employee profile is not active. Please contact HR or your manager.");
      return;
    }

    const acceptedPasswords = [
      employee.temp_password,
      employee.temporary_password,
      DEFAULT_LOGIN_PASSWORD,
    ]
      .filter((value) => value !== undefined && value !== null && String(value) !== "")
      .map((value) => String(value));

    if (!acceptedPasswords.includes(String(loginPassword || ""))) {
      setAuthError("Invalid password. Please try again or request a reset from HR/Admin.");
      return;
    }

    const loginPasswordValue = String(loginPassword || "");
    const passwordMatchesTemporary = [
      employee.temporary_password,
      DEFAULT_LOGIN_PASSWORD,
      "Welcome2026!",
    ]
      .filter((value) => value !== undefined && value !== null && String(value) !== "")
      .some((value) => loginPasswordValue === String(value));

    const mustCreatePersonalPassword = Boolean(
      normalizeBoolean(employee.requires_password_reset) ||
      normalizeBoolean(employee.force_password_change) ||
      normalizeBoolean(employee.must_change_password) ||
      (passwordMatchesTemporary && !employee.password_last_updated)
    );

    if (mustCreatePersonalPassword) {
      setPasswordResetUser(employee);
      setNewPersonalPassword("");
      setConfirmPersonalPassword("");
      setAuthError("");
      setResetNotice("Temporary password accepted. Please create your personalized password to continue.");
      return;
    }

    localStorage.setItem("candoHrUserEmail", employee.email);
    setSessionUserEmail(employee.email);
    setSelectedEmployeeId(employee.id);
    setAdminMode(false);
    setAuthError("");
    setResetNotice("");
  }

  function logout() {
    localStorage.removeItem("candoHrUserEmail");
    setSessionUserEmail("");
    setLoginPassword("");
    setAdminMode(false);
    setTab("agent");
  }

  function generateTemporaryPassword() {
    return `Temp${Math.random().toString(36).slice(2, 8)}!${Math.floor(10 + Math.random() * 89)}`;
  }

  async function handleForgotPassword() {
    const targetEmail = normalizeEmail(loginEmail);
    const employee = employees.find((e) => normalizeEmail(e.email) === targetEmail);

    setAuthError("");
    setResetNotice("");

    if (!targetEmail) {
      setAuthError("Please enter your email first, then select Forgot password.");
      return;
    }

    if (!employee) {
      setAuthError("No active employee profile was found for this email. Please contact HR or your manager.");
      return;
    }

    const temporaryPassword = generateTemporaryPassword();
    const updatedEmployee = {
      ...employee,
      temp_password: temporaryPassword,
      temporary_password: temporaryPassword,
      must_change_password: true,
      force_password_change: true,
      requires_password_reset: true,
      password_reset_status: "Temporary Password Issued",
      password_reset_requested_at: new Date().toISOString(),
    };

    setEmployees((current) =>
      current.map((item) => (item.id === employee.id ? updatedEmployee : item))
    );

    try {
      if (supabase) {
        const { error: employeeUpdateError } = await supabase.from("employees").update({
          temp_password: temporaryPassword,
          temporary_password: temporaryPassword,
          must_change_password: true,
          force_password_change: true,
        }).eq("email", employee.email);

        if (employeeUpdateError) {
          console.warn("Supabase employee temp password update warning:", employeeUpdateError.message || employeeUpdateError);
        }
      }

      await supabaseInsert(
        "password_reset_requests",
        {
          employee_email: employee.email,
          temporary_password: temporaryPassword,
          status: "Pending",
        },
        "Forgot password request"
      );

      await supabaseInsert(
        "email_queue",
        [
          mapEmailToSupabaseQueue({
            recipient: employee.email,
            subject: "Temporary password for Magnemite.app",
            body: `Hello ${employee.full_name || "Employee"}, your temporary password is: ${temporaryPassword}. After login, the app will ask you to create a personalized password.`,
          }),
          mapEmailToSupabaseQueue({
            recipient: employee.manager || employee.supervisor || attendanceEmailSettings.hrWfmEmails || "HR/Admin",
            subject: "Password reset follow-up required",
            body: `${employee.full_name} (${employee.email}) requested a password reset. Temporary password generated: ${temporaryPassword}. Please confirm the user completes the personalized password reset after login.`,
          }),
        ],
        "Forgot password email queue"
      );

      await googleUpdateRow("employees", "Employee_ID", employee.id, mapEmployeeToSheet(updatedEmployee));

      await googleAddRow("emailQueue", {
        Email_ID: cleanId("EMAIL"),
        Event_Type: "Forgot Password Temporary Password",
        To_Email: employee.email,
        Employee_Email: employee.email,
        Employee_Name: employee.full_name,
        Request_ID: cleanId("PWD"),
        Subject: "Temporary password for Magnemite.app",
        Status: "Pending Send",
        Created_At: new Date(),
        Notes: `Temporary Password: ${temporaryPassword} | User must create a personalized password after login.`,
      });

      await googleAddRow("emailQueue", {
        Email_ID: cleanId("EMAIL"),
        Event_Type: "Password Reset Manual Follow Up",
        To_Email: employee.manager || employee.supervisor || attendanceEmailSettings.hrWfmEmails || "",
        Employee_Email: employee.email,
        Employee_Name: employee.full_name,
        Request_ID: cleanId("PWD"),
        Subject: "Password reset follow-up required",
        Status: "Pending Send",
        Created_At: new Date(),
        Notes: `${employee.full_name} requested password reset. Temporary password was generated and personalized reset is required at next login.`,
      });
    } catch (error) {
      console.error("Password reset queue failed:", error);
    }

    setResetNotice("Temporary password request created. The email queue will send the temporary password, and the user will be asked to create a personalized password after login.");
    showToast("Password reset requested", "Temporary password email was queued and personalized reset will be required at next login.", "success");
  }

  async function completePasswordReset() {
    if (!passwordResetUser) return;

    if (!newPersonalPassword || newPersonalPassword.length < 8) {
      setAuthError("Please create a password with at least 8 characters.");
      return;
    }

    if (newPersonalPassword !== confirmPersonalPassword) {
      setAuthError("The new passwords do not match.");
      return;
    }

    const updatedEmployee = {
      ...passwordResetUser,
      temp_password: newPersonalPassword,
      temporary_password: "",
      must_change_password: false,
      force_password_change: false,
      requires_password_reset: false,
      password_last_updated: new Date().toISOString(),
      password_reset_status: "Completed",
      password_reset_completed_at: new Date().toISOString(),
    };

    setEmployees((current) =>
      current.map((item) => (item.id === passwordResetUser.id ? updatedEmployee : item))
    );

    try {
      if (supabase) {
        await supabase.from("employees").update({
          temp_password: newPersonalPassword,
          temporary_password: null,
          must_change_password: false,
          force_password_change: false,
          password_last_updated: new Date().toISOString(),
        }).eq("email", passwordResetUser.email);
      }

      await googleUpdateRow("employees", "Employee_ID", passwordResetUser.id, mapEmployeeToSheet(updatedEmployee));
    } catch (error) {
      console.error("Password reset completion sync failed:", error);
    }

    localStorage.setItem("candoHrUserEmail", updatedEmployee.email);
    setSessionUserEmail(updatedEmployee.email);
    setSelectedEmployeeId(updatedEmployee.id);
    setPasswordResetUser(null);
    setNewPersonalPassword("");
    setConfirmPersonalPassword("");
    setLoginPassword("");
    setAuthError("");
    setResetNotice("");
    showToast("Password updated", "Your personalized password was saved successfully.", "success");
  }

  const requestCalendar = useMemo(() => getRequestCalendarDays(), [newRequest.start_date, newRequest.type, filters, filteredVisibleEmployees, requests, rules]);

  const headerRequestSummary = requestStatusSummary(filteredRequests);
  const scheduledTodayCount = filteredVisibleEmployees.filter((employee) => !isTodayOffDay(employee) && employee.employment_status === "Active").length;
  const activeEmployeeCount = filteredVisibleEmployees.filter((employee) => employee.employment_status === "Active").length;

  function HeaderMetrics() {
    if (isAgentOnly) return null;

    if (["requests", "manager"].includes(tab)) {
      return (
        <section className="tabMetrics">
          <Metric icon={CalendarDays} label="Total Requests" value={headerRequestSummary.total} hint="All filtered requests" />
          <Metric icon={Clock} label="Pending" value={headerRequestSummary.pending} hint="Awaiting approval" />
          <Metric icon={CheckCircle} label="Approved" value={headerRequestSummary.approved} hint="Approved requests" />
          <Metric icon={XCircle} label="Denied" value={headerRequestSummary.denied} hint="Denied requests" />
        </section>
      );
    }

    if (["dashboard", "employees", "schedule"].includes(tab)) {
      return (
        <section className="tabMetrics compactMetrics">
          <Metric icon={Users} label="Active Employees" value={activeEmployeeCount} hint="Active profiles" />
          <Metric icon={CalendarDays} label="Scheduled Today" value={scheduledTodayCount} hint="Not on off day" />
        </section>
      );
    }

    return null;
  }

  const navItems = isAgentOnly
    ? [["agent", Clock]]
    : [
        ["agent", Clock],
        ["dashboard", BarChart3],
        ["employees", Users],
        ["schedule", CalendarDays],
        ["time", Clock],
        ["requests", CalendarDays],
        ["manager", CheckCircle],
        ["payroll", FileCheck],
        ["reporting", BarChart3],
        ["rules", Settings],
      ];

  if (!isAuthenticated) {
    return (
      <LoginScreen
        logo={LOGO}
        email={loginEmail}
        password={loginPassword}
        setEmail={setLoginEmail}
        setPassword={setLoginPassword}
        onLogin={login}
        onForgotPassword={handleForgotPassword}
        error={authError}
        resetNotice={resetNotice}
        passwordResetUser={passwordResetUser}
        newPersonalPassword={newPersonalPassword}
        confirmPersonalPassword={confirmPersonalPassword}
        setNewPersonalPassword={setNewPersonalPassword}
        setConfirmPersonalPassword={setConfirmPersonalPassword}
        onCompletePasswordReset={completePasswordReset}
        databaseStatus={databaseStatus}
        demoAccounts={DEMO_ACCOUNTS}
      />
    );
  }
if (startupLoading) {
  return (
    <div className="appShell">
      <main className="mainArea">
        <section className="card">
          <h2>Loading Magnemite...</h2>
          <p>Refreshing the latest schedule and break data.</p>
        </section>
      </main>
    </div>
  );
}
  return (
    <div className="app">
      <style>{styles}</style>

      <aside className="sidebar">
        <div className="logoWrap">
          <img src={LOGO} alt="Magnemite.app" />
          <div><strong>Magnemite</strong><span>Workforce Management Made Simple</span></div>
        </div>
        <nav>
          {navItems.map(([key, Icon]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <Icon size={18} /> {key === "agent" ? "My Portal" : key === "manager" ? "Approvals" : key}
            </button>
          ))}
        </nav>
        {isAuthenticated && (
          <div className="sessionBox">
            <span>Signed in as</span>
            <strong>{currentUser.full_name}</strong>
            <small>{currentUser.email}</small>
            <button onClick={logout}>Logout</button>
          </div>
        )}
        <div className="syncBox"><Database size={16} /><span>{databaseStatus}</span></div>
        <DeveloperMark sidebar />
      </aside>

      <main>
        <header className="topbar">
          <div>
            <h1>{isAgentOnly ? "My HR Portal" : "Magnemite Workforce Command Center"}</h1>
            <p>{isAgentOnly ? "Manage your shift, status/disposition, balances, and time-off requests." : "Time tracking, schedules, PTO/VTO, OT, payroll review, rules, and reporting."}</p>
          </div>
          {isAgentOnly && (
            <div className="actions">
              {canAccessAdmin && <button className="primary" onClick={() => setAdminMode(true)}>Admin / Manager Access</button>}
              <button onClick={logout}>Logout</button>
            </div>
          )}
          {!isAgentOnly && (
            <div className="actions topActions">
              <button type="button" onClick={() => setTab("agent")}>Return to Agent View</button>
              <button type="button" onClick={exportPdf}><Download size={16} /> Download PDF</button>
              <button type="button" onClick={exportTimeCsv}><Download size={16} /> Time CSV</button>
              <button type="button" onClick={exportRequestsCsv}><Download size={16} /> Requests CSV</button>
              <button type="button" className="primary" onClick={() => syncWorkforcePlanningSheet({ silent: false, automatic: false })}><Upload size={16} /> Sync Roster</button>
              <label className="btn">
                <Upload size={16} /> Import Employees
                <input type="file" accept=".csv" onChange={importEmployees} />
              </label>
              <button type="button" onClick={createArchiveBackup}>Create Backup</button>
              <button type="button" onClick={logout}>Logout</button>
            </div>
          )}
        </header>

        <HeaderMetrics />

        {!isAgentOnly && lastWorkforceSync && (
          <section className="syncNotice">
            {lastWorkforceSync.syncMode || "Workforce planning sheet synced"}: {lastWorkforceSync.updatedCount} employee(s) updated · {lastWorkforceSync.missingCount} sheet row(s) not matched · {lastWorkforceSync.syncedAt}. Next automatic sync: Saturday 5:00 AM. Protected: email, password, role, access level, hire date, birthday, and employee ID.
          </section>
        )}

        {!isAgentOnly && (
          <section className="filterPanel">
            <Field label="LOB">
  <select value={filters.lob} onChange={(e) => setFilters({ ...filters, lob: e.target.value })}>
    {lobOptions.map((x) => (
      <option key={x} value={x}>
        {x}
      </option>
    ))}
  </select>
</Field>
            <Field label="Department"><select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>{departmentOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Sub-Department"><select value={filters.subDepartment} onChange={(e) => setFilters({ ...filters, subDepartment: e.target.value })}>{subDepartmentOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Employee"><select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>{employeeOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Country"><select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>{countryOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Type"><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>{categoryOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Start"><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></Field>
            <Field label="End"><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></Field>
            <div className="filterActions"><button type="button" className="primary" onClick={refreshLiveData}>Refresh Live Data</button><button type="button" onClick={resetFilters}>Reset Filters</button></div>
          </section>
        )}

        {tab === "agent" && (
          <section className="agentPortal">
            <div className="agentHero">
              <div>
                <span>Agent Portal</span>
                <h2>Welcome, {selectedEmployee.full_name}</h2>
                <p>{selectedEmployee.role} · {selectedEmployee.lob} · {selectedEmployee.department}{selectedEmployee.sub_department ? ` · ${selectedEmployee.sub_department}` : ""}</p>
                <div className="profileGrid">
                  <Info label="LOB" value={selectedEmployee.lob} />
                  <Info label="Department" value={selectedEmployee.department} />
                  <Info label="Sub-Department" value={selectedEmployee.sub_department || "N/A"} />
                  <Info label="Role" value={selectedEmployee.role} />
                  <Info label="Supervisor" value={selectedEmployee.supervisor || "Not assigned"} />
                  <Info label="Country" value={selectedEmployee.country} />
                  <Info label="Employment Status" value={selectedEmployee.employment_status} />
                </div>
              </div>
              <div className={`agentShiftCard ${isTodayOffDay(selectedEmployee) ? "offDay" : ""}`}>
                <span>{isTodayOffDay(selectedEmployee) ? "Today’s Status" : "Today’s Shift"}</span>
                <strong>{getTodayShiftSummary(selectedEmployee).label}</strong>
                {isTodayOffDay(selectedEmployee) ? (
                  <small className="shiftDetails offDetails">
                    <b>Scheduled off today</b>
                    <em>Assigned off days: {formatOffDays(selectedEmployee.off_days)}</em>
                  </small>
                ) : (
                  <small className="shiftDetails">
                    {getTodayShiftSummary(selectedEmployee).detail.split(" · ").map((line) => <b key={line}>{line}</b>)}
                  </small>
                )}
              </div>
            </div>

            <div className="agentGrid">
              <Card title="My shift actions">
              <div className="agentActions">
                <button
                  className="primary"
                  onClick={() => agentAction("Shift Started", "Working")}
                >
                  Start Shift
                </button>

                <button onClick={() => agentAction("Shift Ended", "Working")}>
                  End Shift
                </button>
              </div>

              <div className="currentStatus">
                <label>
                  <span>Current Status / Disposition</span>
                  <select value={agentStatus} onChange={(e) => setAgentStatus(e.target.value)}>
                    <TimeCategoryOptions />
                  </select>
                </label>
                <button className="primary" onClick={() => agentAction("Status Changed", agentStatus)}>
                  Log Status
                </button>
                <button
                  disabled
                  className="disabledBtn otDisabledBtn"
                  title="Manual overtime is disabled. Overtime is created automatically after the scheduled shift end."
                >
                  Automatic OT Only
                </button>
              </div>
            </Card>

            <Card title="My balances">
                <div className="balanceGrid">
                  <div><span>PTO</span><strong>{balanceDays(selectedEmployee, "PTO")} day(s)</strong></div>
                  {showSickBalanceForCountry(selectedEmployee.country) && (
                    <div><span>Sick</span><strong>{balanceDays(selectedEmployee, "Sick Leave")} day(s)</strong></div>
                  )}
                  <div><span>Tenure</span><strong>{tenure(selectedEmployee.hire_date)}</strong></div>
                </div>
                <div className="monthlyAttendanceBox">
                  <strong>Monthly attendance · {employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).monthLabel}</strong>
                  <div className="reportMiniGrid">
                    <Info label="Worked" value={`${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).workingHours.toFixed(1)}h`} />
                    <Info label="Approved PTO" value={`${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).ptoApprovedDays} day(s)`} />
                    {!showSickBalanceForCountry(selectedEmployee.country) && (
                      <Info label="Approved Sick Status" value={`${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).sickApprovedDays} day(s)`} />
                    )}
                    <Info label="Approved VTO" value={`${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).vtoApprovedDays} day(s)`} />
                  </div>
                  <div className="miniRequestList">
                    {employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).approvedRequests.length ? employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).approvedRequests.map((request) => (
                      <span key={request.id}>{request.type}: {formatDateOnly(request.start_date)} · {requestDaysValue(request).toFixed(1)} day(s)</span>
                    )) : <span>No approved requests for this month yet.</span>}
                  </div>
                </div>
              </Card>

              <Card title="Submit my PTO / VTO / OT request">
                <p className="helperText">PTO, VTO, and sick requests are approved in full days. Select the start and end dates and the app calculates the number of requested days automatically.</p>
                <div className="requestPreview">
                  <Info label="Request Type" value={newRequest.type} />
                  <Info label="Requested" value={`${requestPreview.requestedHours} day(s)`} />
                  <Info label="Current Balance" value={requestPreview.impactsBalance ? `${requestPreview.currentBalance} day(s)` : "N/A"} />
                  <Info label="After Approval" value={requestPreview.impactsBalance ? `${requestPreview.projectedBalance} day(s)` : "No deduction"} />
                </div>
                <FormGrid>
                  <select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{REQUEST_TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select>
                  <input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })} />
                  <input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} />
                  <input type="number" min="0" step="0.25" title="Requests are now approved in full days." value={newRequest.start_date !== newRequest.end_date ? calculateRequestHours(newRequest) : newRequest.hours} disabled={true} onChange={(e) => setNewRequest({ ...newRequest, hours: e.target.value })} />
                  <input placeholder="Reason or notes" value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} />
                  <button className="primary wide" onClick={saveRequest}>Submit to Manager</button>
                </FormGrid>
              </Card>

              <Card title="My activity today">
                <ActivityList activities={visibleActivity} />
              </Card>
            </div>
          </section>
        )}

        {!isAgentOnly && tab === "dashboard" && (
          <section className="dashboardFloorSection">
            <Card title="Live floor traffic light view by LOB">
              <p className="helperText">
                Production-ready live floor view grouped by Line of Business.
              </p>

              <div className="lobTrafficSplit largeFloorView">
                {lobOptions
                  .filter((lob) => {
                    if (lob === "All") return false;
                    if (filters.lob && filters.lob !== "All") {
                      return lob === filters.lob;
                    }
                    return ["GoDay", "Lending Creative"].includes(lob);
                  })
                  .map((lob) => {
                    const lobEmployees = visibleEmployees.filter(
                      (employee) =>
                        employee.employment_status === "Active" &&
                        employee.lob === lob
                    );

                    const liveLobEmployees = lobEmployees.map((employee) => ({
  employee,
  live: getAgentLiveStatus(employee, timeEntries, requests)
}));

const alerts = liveLobEmployees.filter(({ live }) =>
  live.type === "red" || String(live.label || "").toLowerCase().includes("alert")
);

const active = liveLobEmployees.filter(({ live }) => live.type === "green");

const away = liveLobEmployees.filter(({ live }) =>
  live.type === "yellow" ||
  ["break", "lunch", "bathroom"].some((word) =>
    String(live.label || "").toLowerCase().includes(word)
  )
);

const noActivity = liveLobEmployees.filter(({ live }) =>
  live.type === "gray" ||
  String(live.label || "").toLowerCase().includes("offline") ||
  String(live.label || "").toLowerCase().includes("no activity")
);
                    return (
                      <section className="lobTrafficColumn" key={lob}>
                        <div className="lobTrafficHeader">
                          <h3>{lob}</h3>
                          <Badge>{liveLobEmployees.length} on floor / {lobEmployees.length} active</Badge>
                        </div>

                        

                        <div className="trafficKpiBar">
  <span>🚨 Alerts: {alerts.length}</span>
  <span>🟢 Active: {active.length}</span>
  <span>🟡 Break/Lunch/Bathroom: {away.length}</span>
  <span>⚪ No Activity: {noActivity.length}</span>
</div>

{[
  ["🚨 Alerts", alerts],
  ["🟢 Active", active],
  ["🟡 Break / Lunch / Bathroom", away],
  ["⚪ No Activity", noActivity],
]
.filter(([title, list]) => list.length > 0)
.map(([title, list]) => (
  <details
  className="trafficStatusGroup"
  key={`${lob}-${title}`}
  open={title === "Alerts" ? list.length > 0 : title === "No Activity"}
>
    <summary className="trafficStatusHeader">
      <strong>{title}</strong>
      <span>{list.length}</span>
    </summary>

    {list.length ? (
      <div className="trafficGrid production compactFloor">
        {list.map(({ employee, live }) => (
          <div className={`trafficCard ${live.type || "gray"}`} key={`${title}-${employee.id}`}>
            <span className="trafficDot" />
            <strong>{employee.full_name}</strong>
            <small>{employee.department} · {employee.sub_department || "N/A"}</small>
            <b>{live.label || "No Activity"}</b>
            <em>{live.detail || ""}</em>
          </div>
        ))}
      </div>
    ) : (
      <p className="muted">No agents in this category.</p>
    )}
  </details>
))}
                      </section>
                    );
                  })}
              </div>
            </Card>

            <Card title="Break / Lunch / Bathroom usage by team">
              {teamStats.length ? (
                teamStats.map((item) => (
                  <Progress
                    key={item.label}
                    label={item.label}
                    value={formatHours(item.minutes)}
                    percent={stats.total ? (item.minutes / stats.total) * 100 : 0}
                  />
                ))
              ) : (
                <p className="muted">No break-related data for this filter.</p>
              )}
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "employees" && (
          <section className="grid two">
            <Card title="Role-based access profiles">
              <p className="helperText">Reference guide for what each employee access profile can do. This has been moved from Dashboard to Employees so role management stays in one place.</p>
              <div className="roleProfileGrid">
                {Object.entries(ROLE_ACCESS_PROFILES).map(([key, profile]) => (
                  <div className="roleProfile" key={key}>
                    <strong>{profile.label}</strong>
                    <span>{profile.tasks.join(" · ")}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Add employee">
              <FormGrid>
                <input placeholder="Full name" value={newEmployee.full_name} onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })} />
                <input placeholder="Email" value={newEmployee.email} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} />
                <input placeholder="Country" value={newEmployee.country} onChange={(e) => setNewEmployee({ ...newEmployee, country: e.target.value })} />
                <select value={newEmployee.lob} onChange={(e) => setNewEmployee({ ...newEmployee, lob: e.target.value })}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select>
                <select value={newEmployee.department} onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}>{departments.map((department) => <option key={department}>{department}</option>)}</select>
                <select value={newEmployee.sub_department} onChange={(e) => setNewEmployee({ ...newEmployee, sub_department: e.target.value })}>{subDepartments.map((subDepartment) => <option key={subDepartment}>{subDepartment}</option>)}</select>
                <input placeholder="Role" value={newEmployee.role} onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })} />
                <input type="time" value={newEmployee.shift_start} onChange={(e) => setNewEmployee({ ...newEmployee, shift_start: e.target.value })} />
                <input type="time" value={newEmployee.shift_end} onChange={(e) => setNewEmployee({ ...newEmployee, shift_end: e.target.value })} />
                <input placeholder="Off days, example: Saturday, Sunday" value={newEmployee.off_days} onChange={(e) => setNewEmployee({ ...newEmployee, off_days: e.target.value })} />
                <button className="primary wide" onClick={saveEmployee}>Save employee</button>
              </FormGrid>
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "schedule" && (
          <section className="schedulePage">
            <Card title="Employee schedule management">
              <p className="helperText">Edit each employee’s assigned shift, break, lunch, second break, off days, LOB, department, and sub-department. Updates are reflected in the Agent Portal, reporting, payroll review, staffing rules, and Google Sheets when live sync is connected.</p>
              <Table
                headers={["Employee", "Day", "LOB", "Department", "Sub-Department", "Off Days", "Today", "Shift Start", "Shift End", "Break 1", "Lunch", "Break 2", "Break Min", "Lunch Min"]}
                rows={scheduleRows.map(({ employee: e, day, schedule }) => [
                  <strong>{e.full_name}</strong>,
                  day,
                  <select value={e.lob} onChange={(event) => updateEmployeeSchedule(e.id, "lob", event.target.value)}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select>,
                  <select value={e.department} onChange={(event) => updateEmployeeSchedule(e.id, "department", event.target.value)}>{departments.map((department) => <option key={department}>{department}</option>)}</select>,
                  <select value={e.sub_department || ""} onChange={(event) => updateEmployeeSchedule(e.id, "sub_department", event.target.value)}>{subDepartments.map((subDepartment) => <option key={subDepartment}>{subDepartment}</option>)}</select>,
                  <input value={e.off_days || ""} onChange={(event) => updateEmployeeSchedule(e.id, "off_days", event.target.value)} placeholder="Saturday, Sunday" />,
                  <Badge danger={isTodayOffDay(e)} muted={!isTodayOffDay(e)}>{isTodayOffDay(e) ? "Off Today" : "Scheduled"}</Badge>,
                  <input type="time" value={schedule.shift_start} disabled={!canEditSchedules(selectedEmployee?.access_level || selectedEmployee?.role || "Agent")} onChange={(event) => updateEmployeeSchedule(e.id, "shift_start", event.target.value)} />,
                  <input type="time" value={schedule.shift_end} disabled={!canEditSchedules(selectedEmployee?.access_level || selectedEmployee?.role || "Agent")} onChange={(event) => updateEmployeeSchedule(e.id, "shift_end", event.target.value)} />,
                  <div className="miniTimes"><input type="time" value={schedule.break_start === "Not Available" ? "" : schedule.break_start} onChange={(event) => updateEmployeeSchedule(e.id, "break_start", event.target.value)} /><input type="time" value={schedule.break_end === "Not Available" ? "" : schedule.break_end} onChange={(event) => updateEmployeeSchedule(e.id, "break_end", event.target.value)} /></div>,
                  <div className="miniTimes"><input type="time" value={schedule.lunch_start === "Not Available" ? "" : schedule.lunch_start} onChange={(event) => updateEmployeeSchedule(e.id, "lunch_start", event.target.value)} /><input type="time" value={schedule.lunch_end === "Not Available" ? "" : schedule.lunch_end} onChange={(event) => updateEmployeeSchedule(e.id, "lunch_end", event.target.value)} /></div>,
                  <div className="miniTimes"><input type="time" value={schedule.second_break_start === "Not Available" ? "" : schedule.second_break_start} onChange={(event) => updateEmployeeSchedule(e.id, "second_break_start", event.target.value)} /><input type="time" value={schedule.second_break_end === "Not Available" ? "" : schedule.second_break_end} onChange={(event) => updateEmployeeSchedule(e.id, "second_break_end", event.target.value)} /></div>,
                  `${e.break_minutes} min`,
                  `${e.lunch_minutes} min`,
                ])}
              />
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "time" && (
          <section className="grid split reverse">
            <Card title="Manager / TL editable time log">
              <p className="helperText">Managers and TLs can add new time entries and edit previous time logs for agents. Each saved correction is retained in the approval/audit trail.</p>
              <FormGrid>
                <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{filteredVisibleEmployees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
                <select value={newTime.category} onChange={(e) => setNewTime({ ...newTime, category: e.target.value })}><TimeCategoryOptions /></select>
                <input type="time" value={newTime.category_start} onChange={(e) => setNewTime({ ...newTime, category_start: e.target.value })} />
                <input type="time" value={newTime.category_end} onChange={(e) => setNewTime({ ...newTime, category_end: e.target.value })} />
                <input placeholder="Notes" value={newTime.notes} onChange={(e) => setNewTime({ ...newTime, notes: e.target.value })} />
                <button className="primary wide" onClick={saveTime}>Add time entry</button>
              </FormGrid>
            </Card>
            <Card title="Editable previous time logs">
              <p className="helperText">Use this table to correct historical clock-in/out, category, approval, payable status, or notes. Select Save on the corrected row to persist the update.</p>
              <Table
                headers={["Employee", "Date", "LOB", "Category", "Start", "End", "Duration", "Approval", "Payable", "Notes", "Save"]}
                rows={filteredTime.map((t) => [
                  <strong>{t.employee_name}</strong>,
                  <input type="date" value={t.date || today} onChange={(event) => editTimeEntryLocal(t.id, "date", event.target.value)} />,
                  t.lob,
                  <select value={t.category} onChange={(event) => editTimeEntryLocal(t.id, "category", event.target.value)}><TimeCategoryOptions /></select>,
                  <input type="time" value={formatMilitaryTime(t.category_start)} onChange={(event) => editTimeEntryLocal(t.id, "category_start", event.target.value)} />,
                  <input type="time" value={formatMilitaryTime(t.category_end)} onChange={(event) => editTimeEntryLocal(t.id, "category_end", event.target.value)} />,
                  formatHours(minutesBetween(t.category_start, t.category_end)),
                  <select value={t.approved || "Pending"} onChange={(event) => editTimeEntryLocal(t.id, "approved", event.target.value)}>
                    {["Pending", "Pending Approval", "Approved", "Denied", "Auto Logged"].map((status) => <option key={status}>{status}</option>)}
                  </select>,
                  <input value={t.payable_status || "Regular"} onChange={(event) => editTimeEntryLocal(t.id, "payable_status", event.target.value)} />,
                  <input value={t.notes || ""} onChange={(event) => editTimeEntryLocal(t.id, "notes", event.target.value)} placeholder="Correction notes" />,
                  <button className="primary" onClick={() => saveEditedTimeEntry(t.id)}>Save</button>,
                ])}
              />
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "requests" && (
          <section className="requestsPage">
            <div className="grid split reverse">
              <Card title="Submit PTO / VTO / leave"><p className="helperText">PTO, VTO, and sick requests are approved in full days. Select the start and end dates and the app calculates the number of requested days automatically.</p><FormGrid><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{filteredVisibleEmployees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select><select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{REQUEST_TYPE_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select><input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value, end_date: e.target.value })} /><input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} /><input type="number" min="0" step="0.25" title="Requests are now approved in full days." value={newRequest.start_date !== newRequest.end_date ? calculateRequestHours(newRequest) : newRequest.hours} disabled={true} onChange={(e) => setNewRequest({ ...newRequest, hours: e.target.value })} /><input placeholder="Reason" value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} /><button className="primary wide" onClick={saveRequest}>Submit request</button></FormGrid></Card>
              <Card title="Request history"><Table headers={["Employee", "Type", "Dates", "Days", "Current Balance", "After Approval", "Status"]} rows={filteredRequests.map((r) => [r.employee_name, r.type, `${r.start_date} to ${r.end_date}`, `${requestDaysValue(r).toFixed(1)} day(s)`, r.current_balance ?? "N/A", r.projected_balance ?? "N/A", <Badge>{r.status}</Badge>])} /></Card>
            </div>
            <Card title="Leave planning calendar and staffing capacity">
              <p className="helperText">Select a date to preview rule capacity by the current filters. Green dates are available by staffing rules; red dates may exceed PTO/VTO/Sick limits or minimum staffing.</p>
              <RequestCapacityCalendar calendar={requestCalendar} onSelectDate={(dateKey) => setNewRequest({ ...newRequest, start_date: dateKey, end_date: dateKey })} selectedDate={newRequest.start_date} />
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "manager" && (
          <section className="grid two">
            <Card title="Approvals Queue - Time-Off & Schedule Requests">
              <p className="helperText">Use this queue for requests submitted by employees, including PTO, VTO, Sick Leave, Paid Leave, Unpaid Leave, Schedule Change, and OT requests submitted as a formal request. Approval updates the Requests tab, creates an Approvals audit record, and deducts balances when applicable.</p>
              {requests.filter((r) => ["Pending", "Pending Manager Approval"].includes(r.status)).length ? requests.filter((r) => ["Pending", "Pending Manager Approval"].includes(r.status)).map((r) => <Approval key={r.id} title={r.employee_name} detail={`${r.type} · ${formatDateOnly(r.start_date)} to ${formatDateOnly(r.end_date)} · ${requestDaysValue(r).toFixed(1)} day(s) · Current: ${r.current_balance ?? "N/A"} day(s) · After: ${r.projected_balance ?? "N/A"} day(s)`} approve={() => setRequestStatus(r.id, "Approved")} deny={() => setRequestStatus(r.id, "Denied")} />) : <p className="muted">No pending employee requests at this time.</p>}
            </Card>
            <Card title="Time Log / Overtime Exception Data Backed Up">
              <p className="helperText">The previous time log and overtime exception approval rule has been removed from this approval view. Time log and overtime records are still retained in Time Logs, payroll review, reporting, and archive/export data for audit purposes.</p>
              <Table headers={["Employee", "Category", "Date", "Status", "Backup"]} rows={timeEntries.filter((t) => t.approved === "Pending").slice(0, 8).map((t) => [t.employee_name, t.category, formatDateOnly(t.date), t.approved, "Retained"])} />
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "payroll" && (
          <Card title="Payroll review"><Table headers={["Employee", "Country", "Holiday", "Scheduled", "Clock In/Out", "Late", "Worked", "OT", "Status"]} rows={filteredTime.map((t) => { const employee = employees.find((e) => e.id === t.employee_id); const holiday = isHolidayForCountry(employee?.country, t.date); const late = Math.max(0, minutesBetween(t.scheduled_start, t.clock_in)); const worked = minutesBetween(t.clock_in, t.clock_out); const ot = t.category === "Overtime" ? minutesBetween(t.category_start, t.category_end) : Math.max(0, minutesBetween(t.scheduled_end, t.clock_out)); return [t.employee_name, employee?.country || "N/A", holiday ? <Badge danger>{holiday.holiday_name}</Badge> : <Badge muted>No Holiday</Badge>, formatTimeRange(t.scheduled_start, t.scheduled_end), formatTimeRange(t.clock_in, t.clock_out), `${late} min`, formatHours(worked), formatHours(ot), <Badge danger={late > 0}>{late > 0 ? "Late" : "On Time"}</Badge>]; })} /></Card>
        )}

        {!isAgentOnly && tab === "reporting" && (
          <section className="reportingPage">
            <div className="reportHeader">
              <div>
                <h2>Admin Reporting Center</h2>
                <p>Review productivity, break/lunch adherence, overtime, requests, and schedule adherence by LOB, department, and agent.</p>
              </div>
              <div className="reportControls">
                <select value={reportView} onChange={(e) => setReportView(e.target.value)}>
                  <option>LOB</option>
                  <option>Department</option>
                </select>
                <button onClick={exportReportingCsv}><Download size={16} /> Export Summary CSV</button>
              </div>
            </div>
            <section className="reportGrid">
              {reportingSummary.map((group) => (
                <div className="reportCard" key={group.groupName}>
                  <div className="reportCardHead">
                    <div><span>{reportView}</span><strong>{group.groupName}</strong></div>
                    <Badge danger={group.adherenceRisk}>{group.adherenceRisk ? "Review" : "Healthy"}</Badge>
                  </div>
                  <div className="reportMiniGrid">
                    <Info label="Headcount" value={group.headcount} />
                    <Info label="Productivity" value={`${group.productivity}%`} />
                    <Info label="Break/Lunch Used" value={formatMinutes(group.breakMinutes)} />
                    <Info label="Scheduled Break/Lunch" value={formatMinutes(group.scheduledBreakLunch)} />
                    <Info label="Overtime" value={formatHours(group.otMinutes)} />
                    <Info label="Pending Requests" value={group.pendingRequests} />
                  </div>
                  <Progress label="Working Time" value={formatHours(group.workingMinutes)} percent={group.totalMinutes ? (group.workingMinutes / group.totalMinutes) * 100 : 0} />
                  <Progress label="Break/Lunch/Bathroom" value={formatHours(group.breakMinutes)} percent={group.totalMinutes ? (group.breakMinutes / group.totalMinutes) * 100 : 0} />
                  <Progress label="Overtime" value={formatHours(group.otMinutes)} percent={group.totalMinutes ? (group.otMinutes / group.totalMinutes) * 100 : 0} />
                </div>
              ))}
            </section>
            <section className="grid two">
              <Card title="Agent-level adherence detail">
                <Table
                  headers={["Employee", "LOB", "Department", "Sub-Department", "Productivity", "Late", "Break Used", "Scheduled Break", "Variance", "OT"]}
                  rows={agentReporting.map((e) => [e.full_name, e.lob, e.department, e.sub_department || "N/A", `${e.productivity}%`, formatMinutes(e.lateMinutes), formatMinutes(e.breakMinutes), formatMinutes(e.scheduledBreakLunch), <Badge danger={e.variance > 0} muted={e.variance <= 0}>{e.variance > 0 ? "+" : ""}{formatMinutes(e.variance)}</Badge>, formatHours(e.otMinutes)])}
                />
              </Card>
              <Card title="Overall time productivity">
                <div className="productivityHelp">
                  <strong>How productivity is calculated</strong>
                  <p>Productivity % = Working Time ÷ Total Tracked Time × 100. Break, lunch, bathroom, training, meetings, system issues, and other non-working dispositions reduce the percentage. Working time and approved overtime count as productive time.</p>
                </div>
                {categoryStats.map((item) => <Progress key={item.label} label={item.label} value={formatHours(item.minutes)} percent={stats.total ? (item.minutes / stats.total) * 100 : 0} />)}
                <div className="reportNote">Use this view to compare scheduled expectations against actual logged time by LOB, department, and agent. This helps review breaks, lunch, bathroom time, meetings, training, system issues, OT, and productivity.</div>
              </Card>
            </section>
          </section>
        )}

        {!isAgentOnly && tab === "rules" && (
          <section className="rulesPage">
            <section className="grid two">
              <Card title="Manage LOBs">
                <p className="helperText">Add or remove Lines of Business so managers can assign employees, reports, and staffing rules without editing the code.</p>
                <div className="inlineForm">
                  <input placeholder="Example: GoDay, Lending Creative, New Client" value={newLob} onChange={(e) => setNewLob(e.target.value)} />
                  <button className="primary" onClick={addLob}>Add LOB</button>
                </div>
                <div className="chipList">{lobs.map((lob) => <span className="chip" key={lob}>{lob}<button onClick={() => deleteLob(lob)}>×</button></span>)}</div>
              </Card>
              <Card title="Manage Departments">
                <p className="helperText">Add departments used for scheduling, reporting, PTO/VTO limits, and payroll tracking.</p>
                <div className="inlineForm">
                  <input placeholder="Example: Operations, QA, Training, HR" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} />
                  <button className="primary" onClick={addDepartment}>Add Department</button>
                </div>
                <div className="chipList">{departments.map((department) => <span className="chip" key={department}>{department}<button onClick={() => deleteDepartment(department)}>×</button></span>)}</div>
              </Card>
              <Card title="Manage Operations Sub-Departments">
                <p className="helperText">Use sub-departments to filter agents within Operations, such as Customer Service, Collections, CLS, Documents, and SME.</p>
                <div className="inlineForm">
                  <input placeholder="Example: CLS, Documents, SME" onKeyDown={(e) => { if (e.key === "Enter") { addSubDepartment(e.currentTarget.value); e.currentTarget.value = ""; } }} />
                  <button className="primary" onClick={(e) => { const input = e.currentTarget.parentElement.querySelector("input"); addSubDepartment(input.value); input.value = ""; }}>Add Sub-Department</button>
                </div>
                <div className="chipList">{subDepartments.map((subDepartment) => <span className="chip" key={subDepartment}>{subDepartment}<button onClick={() => deleteSubDepartment(subDepartment)}>×</button></span>)}</div>
              </Card>
            </section>

            <Card title="Attendance Email Automation Settings">
              <p className="helperText">Attendance emails are queued in Google Sheets when time is logged. Apps Script should send rows from emailQueue where Status is Pending Send. This avoids sending emails directly from the React app.</p>
              <div className="describedForm">
                <DescribedField title="Enable Attendance Emails" description="When enabled, the app creates emailQueue rows after attendance/time logs are saved.">
                  <select
                    value={attendanceEmailSettings.enabled ? "Enabled" : "Disabled"}
                    onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, enabled: e.target.value === "Enabled" })}
                  >
                    <option>Enabled</option>
                    <option>Disabled</option>
                  </select>
                </DescribedField>
                <DescribedField title="Delivery Mode" description="Daily Summary is recommended to avoid manager email spam. The queue row is created and Apps Script handles the send process.">
                  <select
                    value={attendanceEmailSettings.deliveryMode}
                    onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, deliveryMode: e.target.value })}
                  >
                    <option>Daily Summary</option>
                    <option>First Log Alert</option>
                    <option>Manual Review Only</option>
                  </select>
                </DescribedField>
                <DescribedField title="Daily Send Time" description="Recommended daily send time for Apps Script processing of pending attendance reports.">
                  <input
                    type="time"
                    value={attendanceEmailSettings.sendTime}
                    onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, sendTime: e.target.value })}
                  />
                </DescribedField>
                <DescribedField title="Recipient Groups" description="Choose who receives attendance summaries. Manager and TL use each employee profile fields.">
                  <div className="checkboxGrid">
                    <label><input type="checkbox" checked={attendanceEmailSettings.includeManager} onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeManager: e.target.checked })} /> Manager</label>
                    <label><input type="checkbox" checked={attendanceEmailSettings.includeSupervisor} onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeSupervisor: e.target.checked })} /> TL / Supervisor</label>
                    <label><input type="checkbox" checked={attendanceEmailSettings.includeHrWfm} onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeHrWfm: e.target.checked })} /> HR / WFM</label>
                  </div>
                </DescribedField>
                <DescribedField title="HR / WFM Emails" description="Optional extra recipients. Separate multiple emails with comma or semicolon.">
                  <input
                    placeholder="wfm@company.com, hr@company.com"
                    value={attendanceEmailSettings.hrWfmEmails}
                    onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, hrWfmEmails: e.target.value })}
                  />
                </DescribedField>
                <DescribedField title="LOB Filter" description="Limit automation to one LOB or keep All enabled.">
                  <select
                    value={attendanceEmailSettings.lobFilter}
                    onChange={(e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, lobFilter: e.target.value })}
                  >
                    <option>All</option>
                    {lobs.map((lob) => <option key={lob}>{lob}</option>)}
                  </select>
                </DescribedField>
              </div>
              <div className="emailAutomationSummary">
                <strong>Current setup:</strong> {attendanceEmailSettings.enabled ? "Enabled" : "Disabled"} · {attendanceEmailSettings.deliveryMode} · Send time {attendanceEmailSettings.sendTime} · Recipients: {attendanceEmailSettings.includeManager ? "Manager " : ""}{attendanceEmailSettings.includeSupervisor ? "TL/Supervisor " : ""}{attendanceEmailSettings.includeHrWfm ? "HR/WFM" : ""}
              </div>
              <button className="primary wide" onClick={queueAttendanceTestEmail}>Queue Test Attendance Email</button>
            </Card>

            <section className="grid split reverse">
              <Card title="Editable staffing rule engine">
                <div className="ruleGuide">
                  <h3>Rule setup instructions</h3>
                  <p>Complete each field below to control how many employees can be approved out of a specific LOB, department, and shift. These rules help managers avoid approving too many PTO, VTO, or sick leave requests when coverage is needed.</p>
                </div>
                <div className="describedForm">
                  <DescribedField title="LOB" description="Line of Business this rule applies to, such as GoDay or Lending Creative."><select value={newRule.lob} onChange={(e) => setNewRule({ ...newRule, lob: e.target.value })}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select></DescribedField>
                  <DescribedField title="Department" description="Department or team covered by this staffing rule."><select value={newRule.department} onChange={(e) => setNewRule({ ...newRule, department: e.target.value })}>{departments.map((department) => <option key={department}>{department}</option>)}</select></DescribedField>
                  <DescribedField title="Shift Start" description="The beginning of the scheduled shift block this rule controls."><input type="time" value={newRule.shift_start} onChange={(e) => setNewRule({ ...newRule, shift_start: e.target.value })} /></DescribedField>
                  <DescribedField title="Shift End" description="The end of the scheduled shift block this rule controls."><input type="time" value={newRule.shift_end} onChange={(e) => setNewRule({ ...newRule, shift_end: e.target.value })} /></DescribedField>
                  <DescribedField title="Rule Start Date" description="When this staffing rule becomes active for planning."><input type="date" value={newRule.start_date} onChange={(e) => setNewRule({ ...newRule, start_date: e.target.value })} /></DescribedField>
                  <DescribedField title="Rule End Date" description="Optional expiration date. Leave blank for ongoing rules."><input type="date" value={newRule.end_date} onChange={(e) => setNewRule({ ...newRule, end_date: e.target.value })} /></DescribedField>
                  <DescribedField title="Repeat Frequency" description="Planning frequency for this rule."><select value={newRule.recurrence} onChange={(e) => setNewRule({ ...newRule, recurrence: e.target.value })}>{["None", "Daily", "Weekly", "Monthly", "Seasonal"].map((x) => <option key={x}>{x}</option>)}</select></DescribedField>
                  <DescribedField title="Max PTO Out" description="Maximum employees who can be approved for PTO during this shift."><input type="number" value={newRule.max_pto_out} onChange={(e) => setNewRule({ ...newRule, max_pto_out: e.target.value })} /></DescribedField>
                  <DescribedField title="Max VTO Out" description="Maximum employees who can be released early or off as VTO during this shift."><input type="number" value={newRule.max_vto_out} onChange={(e) => setNewRule({ ...newRule, max_vto_out: e.target.value })} /></DescribedField>
                  <DescribedField title="Max Sick Out" description="Coverage threshold for sick leave. If exceeded, the rule flags a staffing risk."><input type="number" value={newRule.max_sick_out} onChange={(e) => setNewRule({ ...newRule, max_sick_out: e.target.value })} /></DescribedField>
                  <DescribedField title="Minimum Staff Required" description="Minimum employees that must remain available after all approvals."><input type="number" value={newRule.min_staff_required} onChange={(e) => setNewRule({ ...newRule, min_staff_required: e.target.value })} /></DescribedField>
                  <DescribedField title="Notes" description="Optional business context, exception instructions, or manager notes."><input value={newRule.notes} onChange={(e) => setNewRule({ ...newRule, notes: e.target.value })} /></DescribedField>
                </div>
                <button className="primary wide" onClick={saveRule}>Save Staffing Rule</button>
              </Card>
              <Card title="Current coverage rules and usage">
                <Table
                  headers={["LOB", "Department", "Shift", "Effective Dates", "Repeat", "Scheduled", "Approved Out", "Available", "Limits", "Status", "Action"]}
                  rows={rules.map((rule) => {
                    const usage = getRuleUsage(rule);
                    const exceeds = usage.pto > rule.max_pto_out || usage.vto > rule.max_vto_out || usage.sick > rule.max_sick_out || usage.available < rule.min_staff_required;
                    return [rule.lob, rule.department, formatTimeRange(rule.shift_start, rule.shift_end), `${formatDateOnly(rule.start_date || today)}${rule.end_date ? ` to ${formatDateOnly(rule.end_date)}` : " onward"}`, rule.recurrence || "Daily", usage.scheduled, usage.out, usage.available, `PTO ${usage.pto}/${rule.max_pto_out} · VTO ${usage.vto}/${rule.max_vto_out} · Sick ${usage.sick}/${rule.max_sick_out} · Min ${rule.min_staff_required}`, <Badge danger={exceeds}>{exceeds ? "Risk" : "Within Rule"}</Badge>, <button onClick={() => deleteRule(rule.id)}>Delete</button>];
                  })}
                />
              </Card>
            </section>
          </section>
        )}

        
      </main>
      {processingModal && <ProcessingOverlay status={processingModal.status} title={processingModal.title} message={processingModal.message} />}
      {managerOverrideModal && (
        <ManagerOverrideModal
          title={managerOverrideModal.title}
          message={managerOverrideModal.message}
          onCancel={() => resolveManagerOverride(false)}
          onConfirm={() => resolveManagerOverride(true)}
        />
      )}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
    
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <HRWorkforceApp />
    </AppErrorBoundary>
  );
}

function LoginScreen({ logo, email, password, setEmail, setPassword, onLogin, onForgotPassword, error, resetNotice, passwordResetUser, newPersonalPassword, confirmPersonalPassword, setNewPersonalPassword, setConfirmPersonalPassword, onCompletePasswordReset, databaseStatus, demoAccounts = [] }) {
  return (
    <div className="loginPage">
      <style>{styles}</style>
      <section className="loginCard">
        <div className="loginBrand">
          <img src={logo} alt="Magnemite.app" />
          <div>
            <strong>Magnemite</strong>
            <span>Workforce Management Made Simple</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <p>
          Access your HR portal, time tracking, PTO/VTO/OT requests, approvals,
          payroll review, and reporting according to your assigned role.
        </p>
        {!passwordResetUser ? (
          <div className="loginForm">
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@goday.ca" />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => e.key === "Enter" && onLogin()}
              />
            </label>
            {error && <div className="loginError">{error}</div>}
            {resetNotice && <div className="loginSuccess">{resetNotice}</div>}
            <button className="primary wide" onClick={onLogin}>Login</button>
            <button type="button" className="linkButton wide" onClick={onForgotPassword}>
              Forgot password? Generate temporary password email
            </button>
          </div>
        ) : (
          <div className="loginForm">
            <div className="loginSuccess">
              Temporary password accepted for {passwordResetUser.full_name}. Please create your personalized password.
            </div>
            <label>
              New personalized password
              <input
                type="password"
                value={newPersonalPassword}
                onChange={(e) => setNewPersonalPassword(e.target.value)}
                placeholder="Create new password"
              />
            </label>
            <label>
              Confirm personalized password
              <input
                type="password"
                value={confirmPersonalPassword}
                onChange={(e) => setConfirmPersonalPassword(e.target.value)}
                placeholder="Confirm new password"
                onKeyDown={(e) => e.key === "Enter" && onCompletePasswordReset()}
              />
            </label>
            {error && <div className="loginError">{error}</div>}
            <button className="primary wide" onClick={onCompletePasswordReset}>Save Password and Continue</button>
          </div>
        )}

        <div className="loginNote">
          <strong>Access is role-based.</strong>
          <span>
            Employees see only their own portal. TL, Manager, HR, Payroll, Admin,
            and Executive users can access admin areas based on their profile.
          </span>
        </div>
         <div className="syncBox loginSync">
          <Database size={16} />
          <span>{databaseStatus}</span>
        </div>
        <DeveloperMark />
      </section>
    </div>
  );
}

function DeveloperMark({ sidebar = false }) {
  return (
    <div className={sidebar ? "developerMark sidebarMark" : "developerMark"}>
      Developed by M.P.
    </div>
  );
}

function Toast({ toast, onClose }) {
  return (
    <div className={`toast ${toast.type || "success"}`}>
      <div className="toastIcon">{toast.type === "danger" ? "!" : toast.type === "warning" ? "!" : "✓"}</div>
      <section>
        <strong>{toast.title}</strong>
        {toast.message && <span>{toast.message}</span>}
      </section>
      <button type="button" onClick={onClose}>×</button>
    </div>
  );
}

function ProcessingOverlay({ status = "processing", title, message }) {
  const icon = status === "success" ? "✓" : status === "danger" ? "!" : status === "warning" ? "!" : "⏳";
  return (
    <div className="modalOverlay">
      <section className={`processingCard ${status}`}>
        <div className="processingSpinner">{icon}</div>
        <h2>{title}</h2>
        <p>{message}</p>
      </section>
    </div>
  );
}



function Field({ label, children }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Info({ label, value }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div>; }
function DescribedField({ title, description, children }) { return <div className="describedField"><div><strong>{title}</strong><p>{description}</p></div>{children}</div>; }
function Metric({ icon: Icon, label, value, hint }) { return <div className="metric"><div><Icon size={22} /></div><section><span>{label}</span><strong>{value}</strong><p>{hint}</p></section></div>; }
function Card({ title, action, children }) { return <section className="card"><header><h2>{title}</h2>{action}</header>{children}</section>; }
function Table({ headers, rows }) { return <div className="table"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>; }
function SearchBox({ value, onChange }) { return <div className="search"><Search size={16} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search..." /></div>; }
function FormGrid({ children }) { return <div className="formGrid">{children}</div>; }
function Badge({ children, muted, danger }) { return <span className={`badge ${muted ? "muted" : ""} ${danger ? "danger" : ""}`}>{children}</span>; }
function Progress({ label, value, percent }) { return <div className="progress"><div><span>{label}</span><strong>{value}</strong></div><i><b style={{ width: `${Math.max(4, percent)}%` }} /></i></div>; }
function Approval({ title, detail, approve, deny }) { return <div className="approval"><section><strong>{title}</strong><span>{detail}</span></section><div><button className="approve" onClick={approve}><CheckCircle size={18} /></button><button className="deny" onClick={deny}><XCircle size={18} /></button></div></div>; }
function getAgentLiveStatus(agent, statusLogs = [], approvals = []) {
  const dateKey = getLocalDateKey(new Date());
  const nowMinutes = timeToMinutes(new Date().toTimeString().slice(0, 5));

  const cleanKey = (value) =>
  String(value || "").trim().toLowerCase();

const agentIds = [
  agent.id,
  agent.employee_id,
  agent.employeeId,
  agent.employeeID
].map(cleanKey).filter(Boolean);

const agentName = cleanKey(agent.full_name || agent.name);
const agentEmail = cleanKey(agent.email);

const agentLogs = (statusLogs || [])
  .filter((log) => {
    const logDate = String(log.date || log.log_date || log.created_at || "").slice(0, 10);

    const logIds = [
      log.employee_id,
      log.employeeId,
      log.employeeID,
      log.id
    ].map(cleanKey).filter(Boolean);

    const idMatch = logIds.some((id) => agentIds.includes(id));
    const nameMatch = cleanKey(log.employee_name || log.full_name || log.name) === agentName;
    const emailMatch = cleanKey(log.employee_email || log.email) === agentEmail;

    return logDate === dateKey && (idMatch || nameMatch || emailMatch);
  })
  .sort((a, b) => {
    const aStamp = `${a.date || ""} ${a.time || ""} ${a.created_at || ""}`;
    const bStamp = `${b.date || ""} ${b.time || ""} ${b.created_at || ""}`;
    return bStamp.localeCompare(aStamp);
  });

  const approvedOverride = approvals.some((approval) =>
    String(approval.employee_id || approval.employeeId) === String(agent.employee_id || agent.id) &&
    approval.status === "Approved" &&
    approval.type === "Schedule Override" &&
    requestCoversDate(approval, dateKey)
  );

  const latestStatus = agentLogs
  .filter((log) => log.status || log.category || log.notes)
  .sort((a, b) => {
    const aStamp = `${a.date || ""} ${a.time || ""} ${a.created_at || ""}`;
    const bStamp = `${b.date || ""} ${b.time || ""} ${b.created_at || ""}`;
    return bStamp.localeCompare(aStamp);
  })[0];



  if (!latestStatus && !approvedOverride) {
    return { label: "OFFLINE", type: "gray", detail: "No live activity logged today" };
  }

const rawStatusText = [
  latestStatus?.status,
  latestStatus?.category,
  latestStatus?.notes,
  latestStatus?.disposition,
  latestStatus?.description
]
  .filter(Boolean)
  .join(" ")
  .toUpperCase();

let status = "Working";

const statusOnly = String(latestStatus?.status || "").toUpperCase();
const notesOnly = String(latestStatus?.notes || latestStatus?.disposition || latestStatus?.description || "").toUpperCase();

const statusSource = `${statusOnly} ${notesOnly}`;

if (statusSource.includes("LUNCH")) {
  status = "Lunch";
} else if (statusSource.includes("BREAK")) {
  status = "Break";
} else if (statusSource.includes("BATHROOM")) {
  status = "Bathroom";
} else if (statusSource.includes("MEETING")) {
  status = "Meeting";
} else if (statusSource.includes("TRAINING")) {
  status = "Training";
} else if (statusSource.includes("COACHING")) {
  status = "Coaching";
} else if (statusSource.includes("WORKING") || statusSource.includes("SHIFT STARTED")) {
  status = "Working";
} else if (statusOnly === "OVERTIME") {
  status = "Working";
}
  const statusUpper = status.toUpperCase();
  const latestStatusTime =
  latestStatus?.time ||
  String(latestStatus?.clock_in || "").slice(11, 16) ||
  String(latestStatus?.created_at || "").slice(11, 16);

const statusStart = timeToMinutes(latestStatusTime);
const elapsed = nowMinutes !== null && statusStart !== null
  ? Math.max(0, nowMinutes - statusStart)
  : 0;

const scheduleForToday = getStableSchedule(agent, [], todayDayName());

const firstBreakMinutes = minutesBetween(scheduleForToday.break_start, scheduleForToday.break_end);
const secondBreakMinutes = minutesBetween(scheduleForToday.second_break_start, scheduleForToday.second_break_end);

const scheduledBreak =
  statusUpper === "BREAK"
    ? Math.max(firstBreakMinutes, secondBreakMinutes, safeNumber(agent.break_minutes, 30))
    : firstBreakMinutes + secondBreakMinutes;

const scheduledLunch =
  minutesBetween(scheduleForToday.lunch_start, scheduleForToday.lunch_end);

const breakLimit = scheduledBreak > 0
  ? scheduledBreak
  : safeNumber(agent.break_minutes, 30);

const lunchLimit = scheduledLunch > 0
  ? scheduledLunch
  : safeNumber(agent.lunch_minutes, 60);

const bathroomLimit = 10;

  if (statusUpper === "LUNCH" && elapsed > lunchLimit) {
    return { label: "LUNCH ALERT", type: "red", detail: `${elapsed} min on lunch · limit ${lunchLimit} min` };
  }

  if (statusUpper === "BREAK" && elapsed > breakLimit) {
    return { label: "BREAK ALERT", type: "red", detail: `${elapsed} min on break · limit ${breakLimit} min` };
  }

  if (statusUpper === "BATHROOM" && elapsed > bathroomLimit) {
    return { label: "BATHROOM ALERT", type: "red", detail: `${elapsed} min in bathroom · limit ${bathroomLimit} min` };
  }

  if (["OFF-DAY UNSCHEDULED", "UNSCHEDULED", "EARLY UNSCHEDULED"].includes(statusUpper) && !approvedOverride) {
    return { label: statusUpper, type: "red", detail: "Requires manager review" };
  }

  if (["BREAK", "LUNCH", "BATHROOM"].includes(statusUpper)) {
    return { label: status, type: "yellow", detail: `${elapsed} min in current status` };
  }

  if (["MEETING", "TRAINING", "COACHING"].includes(statusUpper)) {
    return { label: status, type: "blue", detail: `${elapsed} min in scheduled task` };
  }

  if (["WORKING", "AVAILABLE", "CALL", "PRODUCTION"].includes(statusUpper) || approvedOverride) {
    return { label: status || "WORKING", type: "green", detail: approvedOverride ? "Approved schedule override" : "In production" };
  }

  return { label: status || "OFFLINE", type: "gray", detail: latestStatus?.action || "No current status" };
}


function RequestCapacityCalendar({ calendar, onSelectDate, selectedDate }) {
  const days = calendar?.days || [];
  const leadingBlanks = calendar?.leadingBlanks || 0;
  return (
    <div className="requestCalendar">
      <div className="calendarHeader"><strong>{calendar?.monthLabel || "Request Calendar"}</strong><span>Based on selected filters and staffing rules</span></div>
      <div className="calendarWeekdays">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <b key={day}>{day}</b>)}</div>
      <div className="calendarGrid">
        {Array.from({ length: leadingBlanks }).map((_, index) => <div className="calendarBlank" key={`blank-${index}`} />)}
        {days.map((day) => (
          <button
            type="button"
            key={day.dateKey}
            className={`calendarDay ${day.available ? "available" : "risk"} ${selectedDate === day.dateKey ? "selected" : ""}`}
            onClick={() => onSelectDate(day.dateKey)}
          >
            <strong>{day.day}</strong>
            <span>{day.available ? "Open" : "Review"}</span>
            <small>Scheduled {day.scheduledAgents}</small>
            <small>Off {day.offDayAgents} · PTO {day.ptoAgents} · VTO {day.vtoAgents} · Sick {day.sickAgents}</small>
            <em>Available after request: {day.projectedAvailable}</em>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityList({ activities }) {
  if (!activities.length) return <p className="muted">No activity logged yet today.</p>;
  return (
    <div className="activityList">
      {activities.map((a) => (
        <div className="activityItem" key={a.id}>
          <div>
            <span>Action</span>
            <strong>{a.action}</strong>
          </div>
          <div>
            <span>Status</span>
            <Badge muted>{a.status}</Badge>
          </div>
          <div>
            <span>Time</span>
            <strong>{formatMilitaryTime(a.time)}</strong>
          </div>
          <div>
            <span>Date</span>
            <strong>{formatDateOnly(a.date)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

const styles = `
* { box-sizing: border-box; }
:root { --green: #047857; --dark: #10251c; --deep: #062e23; --soft: #f4faf7; --border: #dfeee7; --muted: #64756d; }
html, body, #root { min-height: 100%; }\nbody { margin: 0; background: #f7faf8; color: var(--dark); font-family: Inter, Segoe UI, Roboto, Arial, sans-serif; }
.loginPage { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top left, #e8fff3, #f7faf8 42%, #ffffff); }
.loginCard { width: min(520px, 100%); background: white; border: 1px solid var(--border); border-radius: 28px; padding: 28px; box-shadow: 0 28px 80px rgba(4,120,87,.14); overflow: hidden; }
.loginBrand { display: flex; align-items: center; gap: 12px; margin-bottom: 22px; }
.loginBrand img { width: 52px; height: 52px; max-width: 52px; max-height: 52px; object-fit: contain; border: 1px solid var(--border); border-radius: 14px; padding: 6px; background: white; flex: 0 0 52px; }
.loginBrand strong { display: block; font-size: 18px; }
.loginBrand span { display: block; color: var(--muted); font-size: 13px; margin-top: 2px; }
.loginCard h1 { margin: 0; font-size: 38px; }
.loginCard p { color: var(--muted); line-height: 1.55; margin: 10px 0 20px; }
.loginForm { display: grid; gap: 12px; }
.loginForm label { display: grid; gap: 6px; color: var(--muted); font-size: 13px; font-weight: 800; }
.loginError { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 14px; padding: 10px 12px; font-size: 13px; }
.loginSuccess { background: #ecfdf5; color: #065f46; border: 1px solid #bbf7d0; border-radius: 14px; padding: 10px 12px; font-size: 13px; }
.linkButton { background: transparent; color: var(--green); border: 0; box-shadow: none; text-decoration: underline; padding: 8px 6px; }
.linkButton:hover { box-shadow: none; transform: none; }
.loginNote { margin-top: 16px; background: #f5fbf8; border: 1px solid var(--border); border-radius: 16px; padding: 14px; display: grid; gap: 5px; color: var(--muted); line-height: 1.45; }
.loginNote strong { color: var(--dark); }
.demoAccounts { margin-top: 16px; background: #ffffff; border: 1px solid var(--border); border-radius: 16px; padding: 14px; display: grid; gap: 8px; }
.demoAccounts > strong { color: var(--dark); font-size: 14px; }
.demoHint { color: var(--muted); font-size: 12px; }
.demoAccounts > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.demoAccounts button { text-align: left; display: grid; gap: 2px; align-items: start; padding: 9px 10px; border-radius: 12px; background: #f8fcfa; }
.demoAccounts button b { font-size: 12px; color: var(--dark); }
.demoAccounts button small { color: #047857; font-size: 11px; overflow-wrap: anywhere; }
.demoAccounts button em { color: var(--muted); font-size: 10px; font-style: normal; line-height: 1.25; }
.loginSync { margin-top: 14px; background: #0d2018; }
button, input, select { font: inherit; }
.app { min-height: 100vh; display: grid; grid-template-columns: 280px minmax(0, 1fr); width: 100%; overflow-x: hidden; align-items: stretch; }
.sidebar { background: linear-gradient(180deg, #063b2c 0%, #062e23 58%, #041c16 100%); color: white; padding: 22px; position: sticky; top: 0; min-height: 100vh; height: 100%; display: flex; flex-direction: column; gap: 22px; box-shadow: 18px 0 45px rgba(4, 37, 29, .12); }
.logoWrap { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.12); }
.logoWrap img { width: 46px; height: 46px; object-fit: contain; border-radius: 12px; background: white; padding: 5px; flex: 0 0 auto; }
.logoWrap strong { display: block; font-size: 16px; }
.logoWrap span { display: block; color: #a8c7b9; font-size: 12px; margin-top: 2px; }
.sidebar nav { display: grid; gap: 8px; }
.sidebar nav button { width: 100%; border: 0; background: transparent; color: #cce0d6; border-radius: 14px; padding: 12px; display: flex; align-items: center; gap: 10px; text-transform: capitalize; cursor: pointer; }
.sidebar nav button:hover, .sidebar nav button.active { background: #123d2c; color: white; }
.syncBox { margin-top: auto; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 8px; color: #bfe0d2; font-size: 13px; }
main { padding: 26px 28px 18px; min-width: 0; width: 100%; overflow-x: hidden; }
.topbar { background: linear-gradient(135deg, white, #edf8f2); border: 1px solid var(--border); border-radius: 26px; padding: 22px; display: flex; justify-content: space-between; gap: 18px; align-items: center; box-shadow: 0 18px 40px rgba(4,120,87,.08); max-width: 100%; overflow: hidden; }
h1 { margin: 0; font-size: clamp(28px, 3vw, 42px); letter-spacing: -1px; }
.topbar p { margin: 8px 0 0; color: var(--muted); }
.actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.topActions { align-items: center; max-width: 760px; }
.topActions button, .topActions .btn { white-space: nowrap; }
button, .btn { border: 1px solid var(--border); background: white; color: var(--dark); border-radius: 13px; padding: 10px 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; text-decoration: none; }
button:hover, .btn:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,0,0,.08); }
.primary { background: var(--green); color: white; border-color: var(--green); }
.disabledBtn, button:disabled, select option:disabled {
  opacity: .46 !important;
  cursor: not-allowed !important;
  background: #d9d9d9 !important;
  color: #666 !important;
  border-color: #c9c9c9 !important;
  box-shadow: none !important;
  transform: none !important;
}
.restrictedField {
  opacity: .55;
  pointer-events: none;
}
.otDisabledBtn {
  justify-content: center;
  min-width: 150px;
}

.btn input { display: none; }
.syncNotice { margin-top: 18px; background: #ecfdf5; border: 1px solid #bbf7d0; color: #065f46; border-radius: 16px; padding: 12px 14px; font-size: 13px; line-height: 1.45; font-weight: 700; }

.filterActions { display: flex; gap: 8px; align-items: end; grid-column: span 2; }
.requestsPage { margin-top: 18px; display: grid; gap: 18px; }
.requestCalendar { display: grid; gap: 12px; }
.calendarHeader { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.calendarHeader span { color: var(--muted); font-size: 13px; }
.calendarWeekdays, .calendarGrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
.calendarWeekdays b { text-align: center; color: var(--muted); font-size: 12px; }
.calendarBlank { min-height: 118px; border-radius: 14px; background: #f8fafc; }
.calendarDay { min-height: 118px; display: grid; gap: 3px; align-content: start; text-align: left; border-radius: 14px; padding: 10px; }
.calendarDay strong { font-size: 18px; }
.calendarDay span { font-weight: 900; font-size: 12px; text-transform: uppercase; }
.calendarDay small, .calendarDay em { font-size: 11px; color: var(--muted); font-style: normal; line-height: 1.25; }
.calendarDay.available { background: #ecfdf5; border-color: #bbf7d0; }
.calendarDay.risk { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
.calendarDay.selected { outline: 3px solid rgba(4,120,87,.22); }
.trafficCard.red { background: #fef2f2; border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,.13), 0 12px 28px rgba(185,28,28,.15); }
.trafficCard.red strong, .trafficCard.red b { color: #991b1b; }

.filterPanel { margin-top: 18px; background: white; border: 1px solid var(--border); border-radius: 22px; padding: 16px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; max-width: 100%; overflow: hidden; }
.field { display: grid; gap: 6px; }
.field span { color: var(--muted); font-size: 12px; font-weight: 800; }
input, select { width: 100%; border: 1px solid #d6e6de; background: white; color: var(--dark); border-radius: 12px; padding: 10px 11px; outline: none; min-height: 42px; }
input:focus, select:focus { border-color: var(--green); box-shadow: 0 0 0 4px rgba(4,120,87,.10); }
.metrics { margin-top: 18px; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; max-width: 100%; }
.metric { background: white; border: 1px solid var(--border); border-radius: 22px; padding: 18px; display: flex; gap: 14px; align-items: center; box-shadow: 0 8px 22px rgba(0,0,0,.035); min-width: 0; overflow: hidden; }
.metric > div { width: 46px; height: 46px; border-radius: 15px; background: #ecfdf5; color: var(--green); display: grid; place-items: center; }
.metric span { color: var(--muted); font-size: 13px; }
.metric strong { display: block; font-size: 30px; line-height: 1.05; margin: 4px 0; }
.metric p { margin: 0; color: #87958e; font-size: 12px; }
.grid { margin-top: 18px; display: grid; gap: 18px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.split { grid-template-columns: minmax(0, 2fr) 380px; }
.grid.split.reverse { grid-template-columns: minmax(320px, 420px) minmax(0, 2fr); }
.card { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 18px; min-width: 0; max-width: 100%; overflow: hidden; box-shadow: 0 8px 22px rgba(0,0,0,.035); }
.card header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.card h2 { margin: 0; font-size: 20px; letter-spacing: -.2px; }
.search { display: flex; align-items: center; gap: 8px; border: 1px solid #d6e6de; border-radius: 13px; padding-left: 10px; min-width: 250px; color: var(--muted); }
.search input { border: 0; box-shadow: none; }
.table { border: 1px solid #e6f0eb; border-radius: 16px; overflow: auto; max-width: 100%; }
table { width: 100%; min-width: 860px; border-collapse: collapse; background: white; table-layout: auto; }
th { background: #f3faf6; color: #64756d; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; text-align: left; padding: 14px 12px; position: sticky; top: 0; z-index: 1; }
td { padding: 14px 12px; border-top: 1px solid #edf4f0; vertical-align: middle; max-width: 320px; overflow-wrap: break-word; word-break: normal; line-height: 1.45; }
td input, td select { min-width: 110px; }
.textBtn { padding: 0; border: 0; box-shadow: none; background: transparent; display: block; text-align: left; color: #064e3b; }
.textBtn small { display: block; color: #7b8b84; margin-top: 3px; }
.badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 800; color: #047857; background: #ecfdf5; margin: 2px; white-space: nowrap; }
.badge.muted { color: #334155; background: #f1f5f9; }
.badge.danger { color: #b91c1c; background: #fef2f2; }
.formGrid { display: grid; gap: 10px; }
.wide { width: 100%; justify-content: center; }
.progress { margin: 15px 0; }
.progress div { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; color: #425249; }
.progress i { display: block; height: 12px; background: #edf7f1; border-radius: 999px; overflow: hidden; }
.progress b { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #58d68d, #047857); }
.muted { color: var(--muted); }
.approval { border: 1px solid #e6f0eb; border-radius: 18px; padding: 14px; display: grid; grid-template-columns: minmax(0, 1fr) auto; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px; max-width: 100%; overflow: hidden; }
.approval strong { display: block; }
.approval span { color: var(--muted); font-size: 13px; display: block; margin-top: 3px; line-height: 1.45; overflow-wrap: anywhere; }
.approval button { width: 38px; height: 38px; padding: 0; justify-content: center; }
.activityList { display: grid; gap: 10px; max-width: 100%; overflow: hidden; }
.activityItem { display: grid; grid-template-columns: minmax(160px, 1.4fr) minmax(120px, .9fr) minmax(80px, .6fr) minmax(110px, .8fr); gap: 10px; align-items: center; border: 1px solid #e6f0eb; border-radius: 16px; padding: 12px; background: #ffffff; max-width: 100%; }
.activityItem div { min-width: 0; }
.activityItem span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
.activityItem strong { display: block; font-size: 14px; overflow-wrap: anywhere; }
.approve { color: #047857; }
.deny { color: #b91c1c; }
.employeeFooter { margin-top: 18px; background: white; border: 1px solid var(--border); border-radius: 22px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
.employeeFooter span:first-child { color: var(--muted); font-size: 12px; font-weight: 800; }
.employeeFooter strong { display: block; font-size: 18px; margin: 4px 0; }
.employeeFooter p { margin: 0; color: var(--muted); }
.agentPortal { margin-top: 18px; }
.agentHero { background: linear-gradient(135deg, #ffffff, #eafaf2); border: 1px solid var(--border); border-radius: 26px; padding: 22px; display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; box-shadow: 0 18px 40px rgba(4,120,87,.08); max-width: 100%; overflow: hidden; }
.agentHero span { color: var(--green); font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
.agentHero h2 { margin: 4px 0; font-size: clamp(26px, 3vw, 38px); }
.agentHero p { margin: 0; color: var(--muted); }
.profileGrid, .requestPreview { margin-top: 16px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; max-width: 100%; }
.info { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 11px 12px; }
.info span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
.info strong { display: block; color: var(--dark); font-size: 14px; margin-top: 4px; }
.agentShiftCard { background: white; border: 1px solid var(--border); border-radius: 20px; padding: 16px; min-width: 280px; transition: background .2s ease, border-color .2s ease, box-shadow .2s ease; }
.agentShiftCard strong { display: block; font-size: 24px; margin: 4px 0 8px; }
.agentShiftCard small { color: var(--muted); display: block; line-height: 1.5; }
.shiftDetails { display: grid !important; gap: 4px; }
.shiftDetails b { display: block; color: #425249; font-weight: 700; }
.shiftDetails em { display: block; color: var(--muted); font-style: normal; margin-top: 2px; }
.agentShiftCard.offDay { background: #fef2f2; border-color: #fecaca; box-shadow: 0 12px 28px rgba(185, 28, 28, .08); }
.agentShiftCard.offDay span { color: #b91c1c; }
.agentShiftCard.offDay strong { color: #991b1b; }
.agentShiftCard.offDay .shiftDetails b { color: #991b1b; }
.agentShiftCard.offDay .shiftDetails em { color: #b91c1c; }
.agentGrid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; max-width: 100%; }
.agentActions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.currentStatus { margin-top: 14px; display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: end; }
.currentStatus label { display: grid; gap: 6px; }
.currentStatus span { color: var(--muted); font-size: 12px; font-weight: 800; }
.balanceGrid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.balanceGrid div { background: #f5fbf8; border: 1px solid var(--border); border-radius: 18px; padding: 14px; }
.balanceGrid span { display: block; color: var(--muted); font-size: 12px; font-weight: 800; }
.balanceGrid strong { display: block; margin-top: 4px; font-size: 22px; }
.schedulePage { margin-top: 18px; }
.miniTimes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-width: 190px; }
.rulesPage { margin-top: 18px; }\n.rulesPage .grid.split.reverse { grid-template-columns: minmax(320px, 430px) minmax(0, 1fr); align-items: start; }\n.rulesPage .table table { min-width: 980px; }
.helperText { margin: 0 0 12px; color: var(--muted); line-height: 1.45; max-width: 100%; overflow-wrap: anywhere; }
.roleAccessNote { color: var(--muted); font-size: 12px; line-height: 1.4; }
select:disabled { opacity: .55; cursor: not-allowed; background: #f1f5f9; }

.checkboxGrid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.checkboxGrid label { display: flex; align-items: center; gap: 8px; font-weight: 800; color: var(--dark); background: #f8fcfa; border: 1px solid var(--border); border-radius: 12px; padding: 9px 10px; }
.checkboxGrid input { width: auto; min-height: auto; }
.emailAutomationSummary { margin: 0 0 12px; background: #f5fbf8; border: 1px solid var(--border); border-radius: 14px; padding: 12px; color: var(--muted); line-height: 1.45; }
.emailAutomationSummary strong { color: var(--dark); }

.inlineForm { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
.chipList { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
.chip { display: inline-flex; align-items: center; gap: 8px; background: #ecfdf5; color: #047857; border-radius: 999px; padding: 7px 10px; font-size: 12px; font-weight: 800; }
.chip button { width: 22px; height: 22px; border-radius: 999px; padding: 0; justify-content: center; color: #047857; }
.ruleGuide { background: #f5fbf8; border: 1px solid var(--border); border-radius: 16px; padding: 14px; margin-bottom: 14px; }
.ruleGuide h3 { margin: 0 0 8px; font-size: 16px; }
.ruleGuide p { margin: 0; color: var(--muted); line-height: 1.55; }
.describedForm { display: grid; gap: 12px; margin-bottom: 14px; }
.describedField { display: grid; grid-template-columns: minmax(180px, .8fr) 1fr; gap: 14px; align-items: center; border: 1px solid #e6f0eb; border-radius: 16px; padding: 12px; }
.describedField strong { display: block; margin-bottom: 4px; }
.describedField p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.reportingPage { margin-top: 18px; }
.reportHeader { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 18px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.reportHeader h2 { margin: 0; font-size: 26px; }
.reportHeader p { margin: 6px 0 0; color: var(--muted); }
.reportControls { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.reportGrid { margin-top: 18px; display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 18px; max-width: 100%; }
.reportCard { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 18px; box-shadow: 0 8px 22px rgba(0,0,0,.035); min-width: 0; max-width: 100%; overflow: hidden; }
.reportCardHead { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
.reportCardHead span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
.reportCardHead strong { display: block; font-size: 22px; margin-top: 3px; }
.reportMiniGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
.reportNote, .productivityHelp { margin-top: 16px; background: #f5fbf8; border: 1px solid var(--border); border-radius: 16px; padding: 14px; color: var(--muted); line-height: 1.5; }
.productivityHelp { margin: 0 0 16px; }
.productivityHelp strong { display: block; color: var(--dark); margin-bottom: 6px; }
.productivityHelp p { margin: 0; }

.developerMark { color: #7b8b84; font-size: 11px; text-align: center; margin: 18px 0 0; letter-spacing: .02em; }
.sidebarMark { color: rgba(255,255,255,.62); border-top: 1px solid rgba(255,255,255,.12); padding-top: 14px; margin-top: 0; }
.toast { position: fixed; left: 50%; top: 50%; bottom: auto; transform: translate(-50%, -50%); z-index: 9999; min-width: min(460px, calc(100vw - 32px)); max-width: 560px; background: #064e3b; color: white; border: 1px solid rgba(255,255,255,.14); border-radius: 16px; box-shadow: 0 24px 70px rgba(4, 78, 59, .35); display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 14px 16px; }
.toast.info { background: #0f5132; }
.toast.warning { background: #92400e; }
.toast.danger { background: #991b1b; }
.toastIcon { width: 34px; height: 34px; border-radius: 999px; background: rgba(255,255,255,.16); display: grid; place-items: center; font-weight: 900; }
.toast section { min-width: 0; }
.toast strong { display: block; font-size: 14px; }
.toast span { display: block; margin-top: 3px; font-size: 12px; opacity: .9; line-height: 1.35; }
.toast button { color: white; background: transparent; border: 0; box-shadow: none; padding: 6px; font-size: 22px; line-height: 1; }

.errorPage { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #f7faf8; }
.errorCard { width: min(560px, 100%); background: white; border: 1px solid var(--border); border-radius: 24px; padding: 24px; box-shadow: 0 24px 70px rgba(4,120,87,.12); }
.errorCard h1 { margin: 0 0 8px; }
.errorCard p { color: var(--muted); line-height: 1.5; }
.errorCard pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; white-space: pre-wrap; color: #991b1b; }
.sessionBox { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 12px; display: grid; gap: 4px; color: #d9f4e8; }
.sessionBox span { font-size: 11px; color: #a8c7b9; text-transform: uppercase; letter-spacing: .05em; font-weight: 900; }
.sessionBox strong { font-size: 14px; overflow-wrap: anywhere; }
.sessionBox small { color: #a8c7b9; overflow-wrap: anywhere; }
.sessionBox button { margin-top: 8px; justify-content: center; background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.16); color: white; }
.modalBackdrop { position: fixed; inset: 0; z-index: 9998; background: rgba(4, 28, 22, .55); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 22px; }
.processingCard, .overrideCard { width: min(520px, 100%); background: white; border: 1px solid var(--border); border-radius: 24px; padding: 24px; box-shadow: 0 28px 90px rgba(4, 37, 29, .28); text-align: center; }
.processingCard h2, .overrideCard h2 { margin: 10px 0 8px; font-size: 24px; }
.processingCard.success .processingSpinner { background: #dcfce7; color: #047857; }
.processingCard.danger .processingSpinner { background: #fee2e2; color: #b91c1c; }
.processingCard.warning .processingSpinner { background: #fef3c7; color: #92400e; }
.processingCard p, .overrideCard p { color: var(--muted); line-height: 1.5; margin: 0; }
.spinner { width: 44px; height: 44px; border-radius: 999px; border: 4px solid #dceee6; border-top-color: var(--green); margin: 0 auto; animation: spin .8s linear infinite; }
.overrideCard { text-align: left; }
.overrideActions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
@keyframes spin { to { transform: rotate(360deg); } }

.tabMetrics { margin-top: 18px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.compactMetrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.trafficGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; }
.trafficCard { position: relative; border: 1px solid var(--border); border-radius: 16px; padding: 14px; background: #f8fafc; display: grid; gap: 4px; }
.trafficCard strong { padding-left: 22px; }
.trafficCard small, .trafficCard em { color: var(--muted); font-size: 12px; font-style: normal; }
.trafficCard b { font-size: 13px; text-transform: uppercase; }
.trafficDot { position: absolute; top: 16px; left: 14px; width: 12px; height: 12px; border-radius: 999px; background: #94a3b8; }
.trafficCard.green .trafficDot { background: #16a34a; }
.trafficCard.yellow .trafficDot { background: #f59e0b; }
.trafficCard.blue .trafficDot { background: #2563eb; }
.trafficCard.red .trafficDot { background: #dc2626; }
.trafficCard.gray .trafficDot { background: #64748b; }
.roleProfileGrid { display: grid; gap: 10px; }
.roleProfile { border: 1px solid var(--border); background: #f8fcfa; border-radius: 14px; padding: 12px; display: grid; gap: 4px; }
.roleProfile span { color: var(--muted); font-size: 12px; line-height: 1.45; }
option:disabled { color: #94a3b8; background: #f1f5f9; }

.disabledBtn, button:disabled, select option:disabled { opacity: .45; cursor: not-allowed; filter: grayscale(.3); }
button:disabled:hover { transform: none; box-shadow: none; }
@media (max-width: 1280px) { .metrics, .tabMetrics { grid-template-columns: repeat(3, minmax(0, 1fr)); } .filterPanel { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 1120px) { .app { grid-template-columns: 1fr; } .sidebar { position: static; min-height: auto; height: auto; } .sidebar nav { grid-template-columns: repeat(3, 1fr); } .syncBox { margin-top: 0; } .topbar, .reportHeader { flex-direction: column; align-items: stretch; } .actions { justify-content: flex-start; } .filterPanel { grid-template-columns: repeat(2, 1fr); } .agentHero { flex-direction: column; align-items: stretch; } .agentGrid, .reportGrid { grid-template-columns: 1fr; } .balanceGrid, .reportMiniGrid { grid-template-columns: repeat(2, 1fr); } .profileGrid, .requestPreview { grid-template-columns: repeat(2, 1fr); } .metrics, .grid.two, .grid.split, .grid.split.reverse { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .topbar, .agentHero, .reportHeader { padding: 16px; } .metrics, .tabMetrics { grid-template-columns: 1fr; } .filterPanel { grid-template-columns: 1fr; } .approval { grid-template-columns: 1fr; } .approval div { display: flex; gap: 8px; } .activityItem { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .demoAccounts > div { grid-template-columns: 1fr; } main, .sidebar { padding: 14px; } .filterPanel, .metrics, .profileGrid, .requestPreview, .reportMiniGrid, .inlineForm, .describedField, .activityItem { grid-template-columns: 1fr; } .currentStatus, .agentActions, .balanceGrid { grid-template-columns: 1fr; } .sidebar nav { grid-template-columns: 1fr; } .employeeFooter { flex-direction: column; align-items: flex-start; } .search { min-width: 0; width: 100%; } .card header { flex-direction: column; align-items: stretch; } }


.monthlyAttendanceBox { margin-top: 14px; padding: 14px; border: 1px solid #dceee7; border-radius: 16px; background: #f8fffc; }
.miniRequestList { display: grid; gap: 6px; margin-top: 10px; color: #546b61; font-size: 12px; }
.lobTrafficSplit { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; align-items: start; }
.dashboardFloorSection { display: grid; gap: 18px; }
.largeFloorView { grid-template-columns: repeat(auto-fit, minmax(430px, 1fr)); gap: 12px; }
.lobTrafficHeader { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.trafficGrid.production { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); max-height: none; overflow: visible; padding-right: 0; }
.compactFloor { gap: 8px; }
.compactFloor .trafficCard { min-height: 74px; padding: 9px 10px 8px 12px; border-radius: 13px; gap: 2px; }
.compactFloor .trafficCard strong { font-size: 12px; line-height: 1.2; padding-left: 16px; }
.compactFloor .trafficCard small, .compactFloor .trafficCard em { font-size: 10px; line-height: 1.2; }
.compactFloor .trafficCard b { font-size: 10px; line-height: 1.2; }
.compactFloor .trafficDot { top: 11px; left: 10px; width: 8px; height: 8px; }
.lobTrafficColumn { border: 1px solid #dceee7; border-radius: 18px; padding: 12px; background: #fbfffd; min-height: 220px; }
.lobTrafficColumn h3 { margin: 0 0 12px; color: #064a36; }
.trafficGrid.compact { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.trafficGrid.compact {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.trafficKpiBar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 12px;
}

.trafficKpiBar span {
  border: 1px solid #dceee7;
  background: #f8fffc;
  border-radius: 999px;
  padding: 6px 10px;
  font-weight: 900;
  font-size: 12px;
  color: #064a36;
}

.trafficStatusGroup {
  margin-top: 10px;
  border: 1px solid #dceee7;
  border-radius: 14px;
  padding: 10px;
  background: #fbfffd;
}

.trafficStatusHeader {
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #064a36;
  font-size: 13px;
}

.trafficStatusHeader span {
  background: #e6fff2;
  border-radius: 999px;
  padding: 3px 9px;
  font-weight: 900;

`;
