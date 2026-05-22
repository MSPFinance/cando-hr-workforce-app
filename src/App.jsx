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
const LOGO = "/cando-logo.png";

// DEMO MODE CONFIGURATION
// For demo/testing purposes this is intentionally blank so the app uses the built-in demo users below.
// When you are ready to reconnect live Google Sheets, replace "" with your working /exec Apps Script URL.
const GOOGLE_API_URL = import.meta.env.VITE_GOOGLE_API_URL || "";

// LOGIN + ROLE ACCESS
// Production path: this uses the Employees database to identify the user and role.
// For full enterprise security later, connect this to Google SSO or Supabase Auth.
const DEFAULT_LOGIN_EMAIL = "agent1@goday.ca";
const DEFAULT_LOGIN_PASSWORD = "Cando123!";
const ADMIN_ACCESS_LEVELS = ["TL", "Supervisor", "Team Lead", "Manager", "Approvals", "HR", "Payroll", "Admin", "Executive", "Reporting"];
const OT_REQUESTS_ENABLED = false;
const ROLE_PROFILE_OPTIONS = ["Employee", "TL", "Supervisor", "Manager", "HR", "Payroll", "Admin", "Executive", "Reporting"];

const ROLE_ACCESS_PROFILES = {
  Employee: { label: "Agent", tasks: ["My Portal", "Start/End Shift", "Status Logs", "PTO/VTO/Sick Requests"], tabs: ["agent"] },
  TL: { label: "Supervisor / Team Lead", tasks: ["Team Review", "Approvals Queue", "Live Floor View", "Basic Reporting"], tabs: ["agent", "dashboard", "requests", "manager", "reporting"] },
  Manager: { label: "Manager", tasks: ["Approvals Queue", "Schedule Review", "Payroll Review", "Reporting", "Rules"], tabs: ["agent", "dashboard", "employees", "schedule", "time", "requests", "manager", "payroll", "reporting", "rules"] },
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
  { label: "Manager", email: "manager@goday.ca", password: "Cando123!", access: "Manager dashboard, approvals, reporting, rules" },
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
    role: "Manager",
    access_level: "Manager",
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
  Supervisor: ["portal", "dashboard", "requests", "approvals", "reporting"],
  "Team Lead": ["portal", "dashboard", "requests", "approvals", "reporting"],
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
  return ["Manager", "Reporting", "HR", "Admin"].includes(role);
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

  if (typeof value === "number") {
    const fraction = value >= 1 ? value % 1 : value;
    const totalMinutes = Math.round(fraction * 24 * 60);
    const hours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
    const minutes = String(totalMinutes % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const raw = String(value).trim();
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

  return raw.slice(0, 5);
}

function formatTimeRange(start, end) {
  return `${formatMilitaryTime(start)} - ${formatMilitaryTime(end)}`;
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
  if (type === "PTO") return "pto_balance";
  if (type === "Sick Leave") return "sick_balance";
  if (type === "VTO") return "vto_balance";
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

function getStableSchedule(employee) {
  return {
    shift_start: formatMilitaryTime(employee?.shift_start || "08:00"),
    shift_end: formatMilitaryTime(employee?.shift_end || "17:00"),
    break_start: formatMilitaryTime(employee?.break_start || "10:00"),
    break_end: formatMilitaryTime(employee?.break_end || "10:15"),
    lunch_start: formatMilitaryTime(employee?.lunch_start || "12:00"),
    lunch_end: formatMilitaryTime(employee?.lunch_end || "13:00"),
    second_break_start: formatMilitaryTime(employee?.second_break_start || "15:00"),
    second_break_end: formatMilitaryTime(employee?.second_break_end || "15:15"),
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

  if (nowMinutes !== null && shiftStart !== null && nowMinutes < shiftStart) {
    return {
      category: "Early Unscheduled",
      approval: "Pending Approval",
      payableStatus: "Pending Manager Approval",
      locked: true,
      reason: "Employee started before scheduled shift",
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
  if (!employee) return { isOff: false, label: "No schedule", detail: "No employee selected." };
  const schedule = getStableSchedule(employee);
  if (isTodayOffDay(employee)) {
    return {
      isOff: true,
      label: `OFF · ${todayDayName()}`,
      detail: `Assigned off days: ${formatOffDays(schedule.off_days)}`,
    };
  }
  return {
    isOff: false,
    label: formatTimeRange(schedule.shift_start, schedule.shift_end),
    detail: `Break 1: ${formatTimeRange(schedule.break_start, schedule.break_end)} · Lunch: ${formatTimeRange(schedule.lunch_start, schedule.lunch_end)} · Break 2: ${formatTimeRange(schedule.second_break_start, schedule.second_break_end)} · Off days: ${formatOffDays(schedule.off_days)}`,
  };
}


function normalizeAccessValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw === "Agent") return "Employee";
  if (raw === "Team Lead") return "TL";
  return raw;
}

function getUserAccessLevel(employee) {
  return normalizeAccessValue(employee?.access_level || employee?.Access_Level || employee?.role || employee?.Role || "Employee") || "Employee";
}

function hasAdminAccess(employee) {
  const accessLevel = normalizeAccessValue(employee?.access_level || employee?.Access_Level);
  const role = normalizeAccessValue(employee?.role || employee?.Role);
  return ADMIN_ACCESS_LEVELS.includes(accessLevel) || ADMIN_ACCESS_LEVELS.includes(role);
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
    pending: requestsList.filter((r) => r.status === "Pending").length,
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
      alert(`Google Sheets write failed: ${result?.message || "Unknown error"}`);
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

function HRWorkforceApp() {
  const [employees, setEmployees] = useState(employeesSeed);
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
  const [adminMode, setAdminMode] = useState(true);
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
  const [sessionUserEmail, setSessionUserEmail] = useState(localStorage.getItem("candoHrUserEmail") || "");
  const [loginEmail, setLoginEmail] = useState(DEFAULT_LOGIN_EMAIL);
  const [loginPassword, setLoginPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [toast, setToast] = useState(null);
  const [processingModal, setProcessingModal] = useState(null);
  const [managerOverrideModal, setManagerOverrideModal] = useState(null);
  const actionLockRef = useRef(new Set());
  const toastTimerRef = useRef(null);
  const overrideResolverRef = useRef(null);


  useEffect(() => {
    async function loadGoogleDatabase() {
      const database = await googleGetDatabase();

      if (!database) {
        setDatabaseStatus("Demo mode active. Using built-in demo users and sample HR data.");
        return;
      }

      const sheetEmployees = (database.employees || []).map(mapEmployeeFromSheet);
      const sheetTime = (database.timeLogs || []).map(mapTimeFromSheet);
      const sheetRequests = (database.requests || []).map(mapRequestFromSheet);
      const sheetRules = (database.staffingRules || []).map(mapRuleFromSheet);
      const sheetLobs = (database.lobs || []).map((row) => row.LOB_Name).filter(Boolean);
      const sheetDepartments = (database.departments || []).map((row) => row.Department_Name).filter(Boolean);
      const sheetSubDepartments = (database.subDepartments || database.sub_departments || []).map((row) => row.Sub_Department_Name || row.Sub_Department || row.Name).filter(Boolean);

      if (sheetEmployees.length) setEmployees(sheetEmployees);
      if (sheetTime.length) setTimeEntries(sheetTime);
      if (sheetRequests.length) setRequests(sheetRequests);
      if (sheetRules.length) setRules(sheetRules);
      if (sheetLobs.length) setLobs([...new Set(sheetLobs)]);
      if (sheetDepartments.length) setDepartments([...new Set(sheetDepartments)]);
      if (sheetSubDepartments.length) setSubDepartments([...new Set(sheetSubDepartments)]);

      setDatabaseStatus("Google Sheets database connected live");
    }

    loadGoogleDatabase();
  }, []);

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
  const isAgentOnly = !adminMode || !canAccessAdmin;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser.id);
  const selectedEmployee = isAgentOnly ? currentUser : employees.find((e) => e.id === selectedEmployeeId) || currentUser;
const visibleEmployees = isAgentOnly ? [currentUser] : employees;
  const visibleTime = isAgentOnly ? timeEntries.filter((t) => t.employee_id === currentUser.id) : timeEntries;
  const visibleRequests = isAgentOnly ? requests.filter((r) => r.employee_id === currentUser.id) : requests;
  const visibleActivity = isAgentOnly ? activityLog.filter((a) => a.employee_id === currentUser.id) : activityLog;

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

  const filteredEmployees = visibleEmployees.filter((e) =>
    [e.full_name, e.email, e.lob, e.department, e.sub_department, e.role, e.country, e.supervisor, e.manager]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const requestPreview = useMemo(() => {
    const requestedHours = calculateRequestHours(newRequest);
    const requestedDays = requestedHours / 8;
    const currentBalance = getBalance(selectedEmployee, newRequest.type);
    return {
      requestedHours,
      requestedDays,
      currentBalance,
      projectedBalance: currentBalance === null ? null : Math.max(0, currentBalance - requestedHours),
      impactsBalance: currentBalance !== null,
    };
  }, [newRequest, selectedEmployee]);

  const stats = useMemo(() => {
    const total = filteredTime.reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    const working = filteredTime.filter((t) => t.category === "Working").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    const overtimeMinutes = filteredTime.filter((t) => t.category === "Overtime").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
    return {
      active: visibleEmployees.filter((e) => e.employment_status === "Active").length,
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
    const reportingEmployees = employees.filter((employee) =>
      (filters.lob === "All" || employee.lob === filters.lob) &&
      (filters.department === "All" || employee.department === filters.department) &&
      (filters.subDepartment === "All" || employee.sub_department === filters.subDepartment) &&
      (filters.employee === "All" || employee.full_name === filters.employee) &&
      (filters.country === "All" || employee.country === filters.country)
    );
    const groupedEmployees = groupBy(reportingEmployees, keyGetter);
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
  }, [employees, filteredTime, requests, reportView, filters]);

  const agentReporting = useMemo(() => {
    return employees.map((e) => {
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
  }, [employees, filteredTime]);

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
      };
      setRules([item, ...rules]);
      await googleAddRow("staffingRules", mapRuleToSheet(item));
    });
  }

  function deleteRule(id) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateEmployeeSchedule(employeeId, field, value) {
  if (!canEditSchedules(getUserAccessLevel(selectedEmployee))) {
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
    if (!["Manager", "HR", "Admin"].includes(getUserAccessLevel(currentUser))) {
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

  async function agentAction(action, status = agentStatus) {
    if (status === "Overtime" && action !== "Shift Ended") {
      showToast("Manual overtime disabled", "Overtime is created automatically after the scheduled shift end.", "warning");
      return null;
    }

    const now = new Date();
    const time = now.toTimeString().slice(0, 5);
    const schedule = getStableSchedule(selectedEmployee);

    if (isTodayOffDay(selectedEmployee) && !selectedEmployee.off_day_approved) {
      showToast("Approval required", "This is a scheduled off day. Work is blocked until management approves an off-day exception.", "warning");
      return null;
    }

    const autoClass = getAutoWorkClassification(selectedEmployee, time);

    const resolvedStatus =
      action === "Shift Ended" && shouldSplitAutoOvertime(selectedEmployee, time)
        ? "Overtime"
        : action === "Shift Started" || action === "Status Changed"
          ? autoClass.category === "Working" ? status : autoClass.category
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
        clock_in: action === "Shift Started" ? time : schedule.shift_start,
        clock_out: action === "Shift Ended" ? time : schedule.shift_end,
        category: resolvedStatus,
        category_start: time,
        category_end: time,
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

      if (supabase) await supabase.from("time_entries").insert(entriesToSave);
      for (const entry of entriesToSave) {
        await googleAddRow("timeLogs", mapTimeToSheet(entry));
      }

      setActivityLog((current) => [activity, ...current]);
      setTimeEntries((current) => [...entriesToSave, ...current]);
    });
  }

  async function saveTime() {
    if (isAgentOnly) return;
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
      if (supabase) await supabase.from("time_entries").insert(item);
      await googleAddRow("timeLogs", mapTimeToSheet(item));
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
      if (supabase) await supabase.from("time_off_requests").insert(item);
      await googleAddRow("requests", mapRequestToSheet(item));
      await googleAddRow("emailQueue", { Email_ID: cleanId("EMAIL"), Event_Type: "Request Pending Approval", To_Email: selectedEmployee.manager || selectedEmployee.supervisor || "", Employee_Email: selectedEmployee.email, Employee_Name: selectedEmployee.full_name, Request_ID: item.id, Subject: `Pending ${item.type} request approval`, Status: "Pending Send", Created_At: new Date() });
      setRequests((current) => [item, ...current]);
    });
  }

  function getApprovalRiskMessage(request) {
    const employee = employees.find((e) => e.id === request.employee_id);
    if (!employee) return "Employee profile was not found. Please confirm before approving.";

    const balance = getBalance(employee, request.type);
    if (balance !== null && safeNumber(request.hours, 0) > safeNumber(balance, 0)) {
      return `${request.employee_name} is requesting ${request.hours}h of ${request.type}, but the available balance is ${balance}h. Manager override is required to continue.`;
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
            await supabase.from("employees").update({ [field]: updatedEmployee[field] }).eq("id", latestRequest.employee_id);
          }

          if (updatedEmployee) {
            await googleUpdateRow("employees", "Employee_ID", latestRequest.employee_id, mapEmployeeToSheet(updatedEmployee));
          }
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

      if (supabase) await supabase.from("time_off_requests").update({ status }).eq("id", id);

      await googleUpdateRow("requests", "Request_ID", id, mapRequestToSheet(updatedRequest));
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

      if (supabase) await supabase.from("time_entries").update({ approved }).eq("id", id);

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
    doc.text("CandoContact HR Workforce Report", 14, 16);
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
    const expectedPassword = employee?.temp_password || DEFAULT_LOGIN_PASSWORD;

    if (!employee) {
      setAuthError("No active employee profile was found for this email. Please contact HR or your manager.");
      return;
    }

    if (String(loginPassword || "") !== String(expectedPassword || "")) {
      setAuthError("Invalid password. Please try again or request a reset from HR/Admin.");
      return;
    }

    const userHasAdminAccess = hasAdminAccess(employee);

    localStorage.setItem("candoHrUserEmail", employee.email);
    setSessionUserEmail(employee.email);
    setSelectedEmployeeId(employee.id);
    setAdminMode(userHasAdminAccess);
    setTab(userHasAdminAccess ? "dashboard" : "agent");
    setAuthError("");
  }

  function logout() {
    localStorage.removeItem("candoHrUserEmail");
    setSessionUserEmail("");
    setLoginPassword("");
    setAdminMode(false);
    setTab("agent");
  }

  const headerRequestSummary = requestStatusSummary(filteredRequests);
  const scheduledTodayCount = visibleEmployees.filter((employee) => !isTodayOffDay(employee) && employee.employment_status === "Active").length;
  const activeEmployeeCount = visibleEmployees.filter((employee) => employee.employment_status === "Active").length;

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
        <section className="tabMetrics">
          <Metric icon={Users} label="Active Employees" value={activeEmployeeCount} hint="Active profiles" />
          <Metric icon={CalendarDays} label="Scheduled Today" value={scheduledTodayCount} hint="Not on off day" />
          <Metric icon={BarChart3} label="Productivity" value={`${stats.productivity}%`} hint="Working vs tracked" />
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
        error={authError}
        databaseStatus={databaseStatus}
        demoAccounts={DEMO_ACCOUNTS}
      />
    );
  }

  return (
    <div className="app">
      <style>{styles}</style>

      <aside className="sidebar">
        <div className="logoWrap">
          <img src={LOGO} alt="CandoContact" />
          <div><strong>CandoContact</strong><span>HR Workforce</span></div>
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
            <h1>{isAgentOnly ? "My HR Portal" : "Workforce Command Center"}</h1>
            <p>{isAgentOnly ? "Manage your shift, status/disposition, balances, and time-off requests." : "Time tracking, schedules, PTO/VTO, OT, payroll review, rules, and reporting."}</p>
          </div>
          {isAgentOnly && (
            <div className="actions">
              {canAccessAdmin && (
                <button
                  className="primary"
                  onClick={() => {
                    setAdminMode(true);
                    setTab("dashboard");
                  }}
                >
                  Admin Dashboard
                </button>
              )}
              <button onClick={logout}>Logout</button>
            </div>
          )}
          {!isAgentOnly && (
            <div className="actions">
              <button onClick={() => { setAdminMode(false); setTab("agent"); }}>Return to Agent View</button>
              <button onClick={logout}>Logout</button>
              <label className="btn"><Upload size={16} /> Import CSV<input type="file" accept=".csv" onChange={importEmployees} /></label>
              <button onClick={exportTimeCsv}><Download size={16} /> Time CSV</button>
              <button onClick={exportRequestsCsv}><Download size={16} /> Requests CSV</button>
              <button className="primary" onClick={exportPdf}><Download size={16} /> PDF</button>
              <button onClick={createArchiveBackup}><Download size={16} /> Archive Backup</button>
            </div>
          )}
        </header>

        <HeaderMetrics />

        {!isAgentOnly && (
          <section className="filterPanel">
            <Field label="LOB"><select value={filters.lob} onChange={(e) => setFilters({ ...filters, lob: e.target.value })}>{lobOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Department"><select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>{departmentOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Sub-Department"><select value={filters.subDepartment} onChange={(e) => setFilters({ ...filters, subDepartment: e.target.value })}>{subDepartmentOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Employee"><select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>{employeeOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Country"><select value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })}>{countryOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Type"><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>{categoryOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Start"><input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></Field>
            <Field label="End"><input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></Field>
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
                <strong>{isTodayOffDay(selectedEmployee) ? `OFF · ${todayDayName()}` : formatTimeRange(selectedEmployee.shift_start, selectedEmployee.shift_end)}</strong>
                {isTodayOffDay(selectedEmployee) ? (
                  <small className="shiftDetails offDetails">
                    <b>Scheduled off today</b>
                    <em>Assigned off days: {formatOffDays(selectedEmployee.off_days)}</em>
                  </small>
                ) : (
                  <small className="shiftDetails">
                    <b>Break 1: {formatTimeRange(selectedEmployee.break_start, selectedEmployee.break_end)}</b>
                    <b>Lunch: {formatTimeRange(selectedEmployee.lunch_start, selectedEmployee.lunch_end)}</b>
                    <b>Break 2: {formatTimeRange(selectedEmployee.second_break_start, selectedEmployee.second_break_end)}</b>
                    <em>Off days: {formatOffDays(selectedEmployee.off_days)}</em>
                  </small>
                )}
              </div>
            </div>

            <div className="agentGrid">
              <Card title="My shift actions">
                <div className="agentActions">
                  <button className="primary" onClick={() => agentAction("Shift Started", "Working")}>Start Shift</button>
                  <button onClick={() => agentAction("Shift Ended", "Working")}>End Shift</button>
                </div>
                <div className="currentStatus">
                  <label><span>Current Status / Disposition</span><select value={agentStatus} onChange={(e) => setAgentStatus(e.target.value)}><TimeCategoryOptions /></select></label>
                  <button className="primary" onClick={() => agentAction("Status Changed", agentStatus)}>Log Status</button>
                  <button disabled className="disabledBtn otDisabledBtn" title="Manual overtime is disabled. Overtime is created automatically after the scheduled shift end.">Automatic OT Only</button>
                </div>
              </Card>

              <Card title="My balances">
                <div className="balanceGrid">
                  <div><span>PTO</span><strong>{balanceDays(selectedEmployee, "PTO")} day(s)</strong></div>
                  <div><span>Sick</span><strong>{balanceDays(selectedEmployee, "Sick Leave")} day(s)</strong></div>
                  <div><span>VTO</span><strong>{balanceDays(selectedEmployee, "VTO")} day(s)</strong></div>
                  <div><span>Tenure</span><strong>{tenure(selectedEmployee.hire_date)}</strong></div>
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
                  <select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change"].map((x) => <option key={x} disabled={x === "Overtime" && !OT_REQUESTS_ENABLED}>{x === "Overtime" && !OT_REQUESTS_ENABLED ? "Overtime Request (Disabled)" : x}</option>)}</select>
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
          <section className="dashboardLayout">
            <Card title="Live floor traffic light view">
              <div className="trafficGrid">
                {visibleEmployees.filter((employee) => employee.employment_status === "Active").map((employee) => {
                  const live = employeeLiveStatus(employee, timeEntries, activityLog);
                  return (
                    <div className={`trafficCard ${live.color}`} key={employee.id}>
                      <span className="trafficDot" />
                      <strong>{employee.full_name}</strong>
                      <small>{employee.department} · {employee.sub_department || "N/A"}</small>
                      <b>{live.status}</b>
                      <em>{live.note}</em>
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card title="Overall time productivity">
              <div className="productivityHelp">
                <strong>How productivity is calculated</strong>
                <p>Productivity % = Working Time ÷ Total Tracked Time × 100. Break, lunch, bathroom, training, meetings, system issues, and other non-working dispositions reduce the percentage. Working time and approved overtime count as productive time.</p>
              </div>
              {categoryStats.map((item) => <Progress key={item.label} label={item.label} value={formatHours(item.minutes)} percent={stats.total ? (item.minutes / stats.total) * 100 : 0} />)}
            </Card>
            <Card title="Break / Lunch / Bathroom usage by team">{teamStats.length ? teamStats.map((item) => <Progress key={item.label} label={item.label} value={formatHours(item.minutes)} percent={stats.total ? (item.minutes / stats.total) * 100 : 0} />) : <p className="muted">No break-related data for this filter.</p>}</Card>
          </section>
        )}

        {!isAgentOnly && tab === "employees" && (
          <section className="grid split">
            <Card title="Employee role access profiles reference">
              <div className="roleProfileGrid compactRoleProfiles">
                {Object.entries(ROLE_ACCESS_PROFILES).map(([key, profile]) => (
                  <div className="roleProfile" key={key}>
                    <strong>{profile.label}</strong>
                    <span>{profile.tasks.join(" · ")}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Employee master database" action={<SearchBox value={search} onChange={setSearch} />}>
              <Table headers={["Employee", "LOB", "Department", "Sub-Department", "Role", "Country", "Shift", "Off Days", "Status"]} rows={filteredEmployees.map((e) => [<button className="textBtn" onClick={() => setSelectedEmployeeId(e.id)}>{e.full_name}<small>{e.email}</small></button>, e.lob, e.department, e.sub_department || "N/A", e.role, e.country, formatTimeRange(e.shift_start, e.shift_end), formatOffDays(e.off_days), <Badge>{e.employment_status}</Badge>])} />
            </Card>
            <Card title="Employee role access management">
              <p className="helperText">Update existing user role profiles without changing their schedule or employee data. Role changes control which tabs and actions are available to the user.</p>
              <Table
                headers={["Employee", "Email", "Current Role", "Access Level", "Update Access"]}
                rows={filteredEmployees.map((employee) => [
                  <strong>{employee.full_name}</strong>,
                  employee.email,
                  employee.role,
                  <Badge>{employee.access_level}</Badge>,
                  <select
                    value={employee.access_level || "Employee"}
                    disabled={!["Manager", "HR", "Admin"].includes(getUserAccessLevel(currentUser))}
                    onChange={(event) => updateEmployeeRole(employee.id, event.target.value)}
                  >
                    {ROLE_PROFILE_OPTIONS.map((roleOption) => (
                      <option key={roleOption} value={roleOption}>{roleOption}</option>
                    ))}
                  </select>,
                ])}
              />
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
                headers={["Employee", "LOB", "Department", "Sub-Department", "Off Days", "Today", "Shift Start", "Shift End", "Break 1", "Lunch", "Break 2", "Break Min", "Lunch Min"]}
                rows={employees.map((e) => [
                  <strong>{e.full_name}</strong>,
                  <select value={e.lob} onChange={(event) => updateEmployeeSchedule(e.id, "lob", event.target.value)}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select>,
                  <select value={e.department} onChange={(event) => updateEmployeeSchedule(e.id, "department", event.target.value)}>{departments.map((department) => <option key={department}>{department}</option>)}</select>,
                  <select value={e.sub_department || ""} onChange={(event) => updateEmployeeSchedule(e.id, "sub_department", event.target.value)}>{subDepartments.map((subDepartment) => <option key={subDepartment}>{subDepartment}</option>)}</select>,
                  <input value={e.off_days || ""} onChange={(event) => updateEmployeeSchedule(e.id, "off_days", event.target.value)} placeholder="Saturday, Sunday" />,
                  <Badge danger={isTodayOffDay(e)} muted={!isTodayOffDay(e)}>{isTodayOffDay(e) ? "Off Today" : "Scheduled"}</Badge>,
                  <input type="time" value={e.shift_start} disabled={!canEditSchedules(getUserAccessLevel(selectedEmployee))} onChange={(event) => updateEmployeeSchedule(e.id, "shift_start", event.target.value)} />,
                  <input type="time" value={e.shift_end} disabled={!canEditSchedules(getUserAccessLevel(selectedEmployee))} onChange={(event) => updateEmployeeSchedule(e.id, "shift_end", event.target.value)} />,
                  <div className="miniTimes"><input type="time" value={e.break_start} onChange={(event) => updateEmployeeSchedule(e.id, "break_start", event.target.value)} /><input type="time" value={e.break_end} onChange={(event) => updateEmployeeSchedule(e.id, "break_end", event.target.value)} /></div>,
                  <div className="miniTimes"><input type="time" value={e.lunch_start} onChange={(event) => updateEmployeeSchedule(e.id, "lunch_start", event.target.value)} /><input type="time" value={e.lunch_end} onChange={(event) => updateEmployeeSchedule(e.id, "lunch_end", event.target.value)} /></div>,
                  <div className="miniTimes"><input type="time" value={e.second_break_start} onChange={(event) => updateEmployeeSchedule(e.id, "second_break_start", event.target.value)} /><input type="time" value={e.second_break_end} onChange={(event) => updateEmployeeSchedule(e.id, "second_break_end", event.target.value)} /></div>,
                  `${e.break_minutes} min`,
                  `${e.lunch_minutes} min`,
                ])}
              />
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "time" && (
          <section className="grid split reverse">
            <Card title="Log time category"><FormGrid><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select><select value={newTime.category} onChange={(e) => setNewTime({ ...newTime, category: e.target.value })}><TimeCategoryOptions /></select><input type="time" value={newTime.category_start} onChange={(e) => setNewTime({ ...newTime, category_start: e.target.value })} /><input type="time" value={newTime.category_end} onChange={(e) => setNewTime({ ...newTime, category_end: e.target.value })} /><input placeholder="Notes" value={newTime.notes} onChange={(e) => setNewTime({ ...newTime, notes: e.target.value })} /><button className="primary wide" onClick={saveTime}>Add time entry</button></FormGrid></Card>
            <Card title="Daily time utilization"><Table headers={["Employee", "Date", "LOB", "Category", "Time", "Duration", "Approval", "Payable"]} rows={filteredTime.map((t) => [t.employee_name, t.date, t.lob, <Badge muted={t.locked} danger={t.approved === "Pending Approval"}>{t.category}</Badge>, formatTimeRange(t.category_start, t.category_end), formatHours(minutesBetween(t.category_start, t.category_end)), <Badge danger={t.approved === "Pending Approval"}>{t.approved}</Badge>, t.payable_status || "Regular"]) } /></Card>
          </section>
        )}

        {!isAgentOnly && tab === "requests" && (
          <section className="grid split reverse">
            <Card title="Submit PTO / VTO / leave"><p className="helperText">PTO, VTO, and sick requests are approved in full days. Select the start and end dates and the app calculates the number of requested days automatically.</p><FormGrid><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select><select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change"].map((x) => <option key={x} disabled={x === "Overtime" && !OT_REQUESTS_ENABLED}>{x === "Overtime" && !OT_REQUESTS_ENABLED ? "Overtime Request (Disabled)" : x}</option>)}</select><input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })} /><input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} /><input type="number" min="0" step="0.25" title="Requests are now approved in full days." value={newRequest.start_date !== newRequest.end_date ? calculateRequestHours(newRequest) : newRequest.hours} disabled={true} onChange={(e) => setNewRequest({ ...newRequest, hours: e.target.value })} /><input placeholder="Reason" value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} /><button className="primary wide" onClick={saveRequest}>Submit request</button></FormGrid></Card>
            <Card title="Request history"><Table headers={["Employee", "Type", "Dates", "Hours", "Days", "Current", "After", "Status"]} rows={filteredRequests.map((r) => [r.employee_name, r.type, `${r.start_date} to ${r.end_date}`, r.hours, Number(r.requested_days || r.hours / 8).toFixed(1), r.current_balance ?? "N/A", r.projected_balance ?? "N/A", <Badge>{r.status}</Badge>])} /></Card>
          </section>
        )}

        {!isAgentOnly && tab === "manager" && (
          <section className="grid two">
            <Card title="Approvals Queue - Time-Off & Schedule Requests">
              <p className="helperText">Use this queue for requests submitted by employees, including PTO, VTO, Sick Leave, Paid Leave, Unpaid Leave, Schedule Change, and OT requests submitted as a formal request. Approval updates the Requests tab, creates an Approvals audit record, and deducts balances when applicable.</p>
              {requests.filter((r) => r.status === "Pending").length ? requests.filter((r) => r.status === "Pending").map((r) => <Approval key={r.id} title={r.employee_name} detail={`${r.type} · ${formatDateOnly(r.start_date)} to ${formatDateOnly(r.end_date)} · ${r.hours}h / ${Number(r.requested_days || r.hours / 8).toFixed(1)} days · Current: ${r.current_balance ?? "N/A"}h · After: ${r.projected_balance ?? "N/A"}h`} approve={() => setRequestStatus(r.id, "Approved")} deny={() => setRequestStatus(r.id, "Denied")} />) : <p className="muted">No pending employee requests at this time.</p>}
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
              <Card title="Category utilization summary">
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
                <p className="helperText">Add departments used for scheduling, reporting, productivity review, PTO/VTO limits, and payroll tracking.</p>
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
                  headers={["LOB", "Department", "Shift", "Scheduled", "Approved Out", "Available", "Limits", "Status", "Action"]}
                  rows={rules.map((rule) => {
                    const usage = getRuleUsage(rule);
                    const exceeds = usage.pto > rule.max_pto_out || usage.vto > rule.max_vto_out || usage.sick > rule.max_sick_out || usage.available < rule.min_staff_required;
                    return [rule.lob, rule.department, formatTimeRange(rule.shift_start, rule.shift_end), usage.scheduled, usage.out, usage.available, `PTO ${usage.pto}/${rule.max_pto_out} · VTO ${usage.vto}/${rule.max_vto_out} · Sick ${usage.sick}/${rule.max_sick_out} · Min ${rule.min_staff_required}`, <Badge danger={exceeds}>{exceeds ? "Risk" : "Within Rule"}</Badge>, <button onClick={() => deleteRule(rule.id)}>Delete</button>];
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

function LoginScreen({ logo, email, password, setEmail, setPassword, onLogin, error, databaseStatus, demoAccounts = [] }) {
  return (
    <div className="loginPage">
      <style>{styles}</style>
      <section className="loginCard">
        <div className="loginBrand">
          <img src={logo} alt="CandoContact" />
          <div>
            <strong>CandoContact</strong>
            <span>HR Workforce Portal</span>
          </div>
        </div>
        <h1>Sign in</h1>
        <p>
          Access your HR portal, time tracking, PTO/VTO/OT requests, approvals,
          payroll review, and reporting according to your assigned role.
        </p>
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
          <button className="primary wide" onClick={onLogin}>Login</button>
        </div>
        <div className="loginNote">
          <strong>Access is role-based.</strong>
          <span>
            Employees see only their own portal. TL, Manager, HR, Payroll, Admin,
            and Executive users can access admin areas based on their profile.
          </span>
        </div>
        <div className="demoAccounts">
          <strong>Demo accounts for testing</strong>
          <span className="demoHint">Use password <b>Cando123!</b> for all demo users.</span>
          <div>
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                }}
              >
                <b>{account.label}</b>
                <small>{account.email}</small>
                <em>{account.access}</em>
              </button>
            ))}
          </div>
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


/* Dashboard traffic light optimization */
.dashboardLayout {
  margin-top: 18px;
  display: grid;
  grid-template-columns: 1fr;
  gap: 18px;
}

.dashboardLayout > .card:first-child {
  min-height: 420px;
}

.dashboardLayout > .card:first-child .trafficGrid {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

.dashboardLayout > .card:first-child .trafficCard {
  min-height: 128px;
  padding: 18px;
  border-radius: 20px;
  font-size: 15px;
}

.dashboardLayout > .card:first-child .trafficCard strong {
  font-size: 17px;
}

.dashboardLayout > .card:first-child .trafficCard b {
  font-size: 14px;
}

.dashboardLayout > .card:first-child .trafficDot {
  width: 14px;
  height: 14px;
  top: 20px;
  left: 16px;
}

.compactRoleProfiles {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

@media (min-width: 1280px) {
  .dashboardLayout {
    grid-template-columns: 1fr;
  }
}

`;
