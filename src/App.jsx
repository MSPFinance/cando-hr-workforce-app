import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BarChart3, CalendarDays, CheckCircle, Clock, Database, Download, FileCheck, Search, Upload, Users, XCircle, Settings, } from "lucide-react";
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
// Source: Google Sheet tab "Roster".
// This reads approved operational fields from the master workforce sheet.
// This reads approved operational fields from the shared workforce sheet while protecting identity/auth fields.
// Protected fields that are NEVER overwritten by this sync: email, password/temp_password, role, access_level, hire_date, birthday, and employee id.
const WORKFORCE_SYNC_SHEET_ID = "1cmYlztzC9oc8z6LSD6ER_UqU2F17Lq7fiMAAWLnMy5s";
const WORKFORCE_SYNC_SHEET_NAMES = ["Roster"];
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
    "hire_date",
"birthday",
"vacation_days",
"vacation_taken",
"available_days",
"pto_balance",
"pto_balance_days",
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
    
];
function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}
function isWeeklyWorkforceSyncWindow(date = new Date()) {
    if (!WORKFORCE_SYNC_AUTOMATIC_ENABLED)
        return false;
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
    { label: "Agent", email: "agent1@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Employee portal only" },
    { label: "Team Lead", email: "tl@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Team lead / admin access" },
    { label: "Approvals", email: "manager@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Approvals, reporting, rules" },
    { label: "HR", email: "hr@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Employee records and HR review" },
    { label: "Payroll", email: "payroll@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Payroll review and exceptions" },
    { label: "Admin", email: "admin@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Full admin access" },
    { label: "Executive", email: "executive@goday.ca", password: DEFAULT_LOGIN_PASSWORD, access: "Executive reporting view" },
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
        temp_password: DEFAULT_LOGIN_PASSWORD,
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
    return timeCategories.map((category) => (React.createElement("option", { key: category, value: category, disabled: isSystemManagedTimeCategory(category) }, isSystemManagedTimeCategory(category) ? `${category} (Automatic only)` : category)));
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
    if (!formatted || typeof formatted !== "string")
        return null;
    const match = formatted.match(/^(\d{1,2}):(\d{2})$/);
    if (!match)
        return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes))
        return null;
    return hours * 60 + minutes;
}
function minutesBetween(start, end) {
    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    if (startMinutes === null || endMinutes === null)
        return 0;
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
    if (!hireDate)
        return "N/A";
    const start = new Date(hireDate);
    const now = new Date();
    const months = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth());
    return `${Math.floor(months / 12)}y ${months % 12}m`;
}
function formatMilitaryTime(value) {
    if (value === null || value === undefined || value === "")
        return "";
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
    if (!value)
        return "";
    if (typeof value === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))
        return value;
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return String(value);
    return date.toISOString().slice(0, 10);
}
function requestDaysInclusive(startDate, endDate) {
    if (!startDate || !endDate)
        return 0;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
        return 0;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
}
function calculateRequestHours(request) {
    // PTO/VTO/Sick approvals are tracked as full days.
    // The existing Hours_Requested field is retained for Google Sheets compatibility,
    // but the value now represents requested days in the UI and approval workflow.
    return requestDaysInclusive(request.start_date, request.end_date);
}
function getBalance(employee, type) {
    if (type === "PTO")
        return balanceDays(employee, "PTO");
    if (type === "Sick Leave")
        return balanceDays(employee, "Sick Leave");
    if (type === "VTO")
        return balanceDays(employee, "VTO");
    return null;
}
function balanceField(type) {
    if (type === "PTO")
        return "pto_balance";
    if (type === "Sick Leave")
        return "sick_balance";
    if (type === "VTO")
        return "vto_balance";
    return null;
}
function groupBy(items, keyGetter) {
    const map = new Map();
    items.forEach((item) => {
        const key = keyGetter(item) || "Unassigned";
        if (!map.has(key))
            map.set(key, []);
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
        }
        else if (char === '"') {
            inQuotes = !inQuotes;
        }
        else if (char === "," && !inQuotes) {
            values.push(current);
            current = "";
        }
        else {
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
    if (!lines.length)
        return [];
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
        if (value !== undefined && value !== null && String(value).trim() !== "")
            return value;
    }
    return "";
}
function splitTimeRange(value) {
  const text = String(value || "").trim();
  if (!text || text.toUpperCase() === "OFF") return { start: "", end: "" };

  const parts = text.split("-").map((part) => part.trim());
  return {
    start: parts[0] || "",
    end: parts[1] || ""
  };
}
function mapWorkforceSyncRow(row) {
    const employeeId = String(firstValue(row, ["Employee_ID", "Employee ID", "ID", "employee_id", "Employee Id"]) || "").trim();
    const fullName = String(firstValue(row, ["Full_Name", "Full Name", "Employee", "Employee Name", "Name", "Agent", "Agent Name"]) || "").trim();
    const sourceEmail = String(firstValue(row, ["Email Address", "Email", "Auth_Email", "Work Email", "Company Email"]) || "").trim();
    // For production the preferred match key is Employee_ID.
    // During staging/demo, Full Name can be used as a safe fallback so roster sync can be tested before real users exist.
    if (!employeeId && !fullName && !sourceEmail)
        return null;
    const payload = {};
    const setText = (field, keys) => {
        const value = firstValue(row, keys);
        if (String(value || "").trim() !== "")
            payload[field] = String(value).trim();
    };
    const setTime = (field, keys) => {
        const value = firstValue(row, keys);
        if (String(value || "").trim() !== "")
            payload[field] = formatMilitaryTime(value);
    };
    const setNumber = (field, keys) => {
  const value = firstValue(row, keys);
  if (String(value || "").trim() !== "") {
    const numericValue = Number(String(value).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numericValue)) payload[field] = numericValue;
  }
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
    setText("hire_date", ["Hire Date"]);
setText("birthday", ["Birthday"]);

setNumber("vacation_days", ["Vacations"]);
setNumber("vacation_taken", ["Vacation taken"]);
setNumber("available_days", ["Available days"]);

if (payload.vacation_days !== undefined && payload.vacation_taken !== undefined && payload.available_days === undefined) {
  payload.available_days = payload.vacation_days - payload.vacation_taken;
}

if (payload.available_days !== undefined) {
  payload.pto_balance = payload.available_days;
  payload.pto_balance_days = payload.available_days;
}
   setTime("shift_start", ["Start Time (EST)", "Shift_Start", "Shift Start", "Scheduled_Shift_Start", "Scheduled Shift Start", "Start Time"]);
setTime("shift_end", ["End Time (EST)", "Shift_End", "Shift End", "Scheduled_Shift_End", "Scheduled Shift End", "End Time"]);

const lunchRange = firstValue(row, ["Lunch"]);
const firstBreakRange = firstValue(row, ["First Break"]);
const secondBreakRange = firstValue(row, ["Second Break"]);

const lunch = splitTimeRange(lunchRange);
const firstBreak = splitTimeRange(firstBreakRange);
const secondBreak = splitTimeRange(secondBreakRange);

if (lunch.start) payload.lunch_start = formatMilitaryTime(lunch.start);
if (lunch.end) payload.lunch_end = formatMilitaryTime(lunch.end);

if (firstBreak.start) payload.break_start = formatMilitaryTime(firstBreak.start);
if (firstBreak.end) payload.break_end = formatMilitaryTime(firstBreak.end);

if (secondBreak.start) payload.second_break_start = formatMilitaryTime(secondBreak.start);
if (secondBreak.end) payload.second_break_end = formatMilitaryTime(secondBreak.end);
if (
  employeeId === "53002263" ||
  sourceEmail.toLowerCase() === "mpenon@goday.ca"
) {
  console.log("ROSTER SYNC TEST - Maggie", {
    employeeId,
    fullName,
    sourceEmail,
    payload,
    rawRow: row,
  });
}
    if (payload.break_start && payload.break_end) {
        payload.break_minutes = minutesBetween(payload.break_start, payload.break_end);
    }
    if (payload.second_break_start && payload.second_break_end) {
        payload.break_minutes = safeNumber(payload.break_minutes, 0) + minutesBetween(payload.second_break_start, payload.second_break_end);
    }
    if (payload.lunch_start && payload.lunch_end) {
        payload.lunch_minutes = minutesBetween(payload.lunch_start, payload.lunch_end);
    }
    return {
        employeeId,
        fullName,
        sourceEmail,
        payload,
    };
}
async function fetchWorkforceSheetRows() {
    if (!WORKFORCE_SYNC_SHEET_ID)
        return [];
    for (const sheetName of WORKFORCE_SYNC_SHEET_NAMES) {
        const url = `https://docs.google.com/spreadsheets/d/${WORKFORCE_SYNC_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
        try {
            const response = await fetch(url, { cache: "no-store" });
            if (!response.ok)
                continue;
            const text = await response.text();
            if (!text || text.toLowerCase().includes("html"))
                continue;
            const rows = parseCsvText(text);
            const mappedRows = rows.map(mapWorkforceSyncRow).filter(Boolean);
            if (mappedRows.length)
                return mappedRows;
        }
        catch (error) {
            console.warn(`Workforce sync sheet ${sheetName} failed:`, error?.message || error);
        }
    }
    return [];
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
        if (row.employeeId)
            byId.set(normalizeKey(row.employeeId), row);
        if (row.fullName)
            byName.set(normalizeName(row.fullName), row);
        if (row.sourceEmail)
            byEmail.set(normalizeKey(row.sourceEmail), row);
    });
    const buildSafePayload = (payload = {}) => WORKFORCE_SYNC_ALLOWED_FIELDS.reduce((clean, field) => {
        if (payload[field] !== undefined && payload[field] !== null && payload[field] !== "") {
            clean[field] = payload[field];
        }
        return clean;
    }, {});
    const employees = currentEmployees.map((employee) => {
        const matchedRow = byId.get(normalizeKey(employee.id)) ||
            byName.get(normalizeName(employee.full_name)) ||
            byEmail.get(normalizeKey(employee.email));
        if (!matchedRow)
            return employee;
        matchedRosterKeys.add(makeRosterKey(matchedRow));
        const safePayload = buildSafePayload(matchedRow.payload);
        if (!Object.keys(safePayload).length)
            return employee;
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
            if (!rosterKey || matchedRosterKeys.has(rosterKey))
                return;
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
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function normalizeOffDays(value) {
    if (Array.isArray(value))
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    return String(value || "")
        .split(/[,|;]/)
        .map((item) => item.trim())
        .filter(Boolean);
}
function formatOffDays(value) {
    const days = normalizeOffDays(value);
    return days.length ? days.join(", ") : "None assigned";
}
function getStableSchedule(employee, employeeSchedules = []) {
  const scheduleRecord = employeeSchedules.find((schedule) =>
    String(schedule.employee_id || "").trim() === String(employee?.employee_id || "").trim() ||
    String(schedule.employee_email || "").toLowerCase().trim() === String(employee?.email || "").toLowerCase().trim()
  );

  const source = scheduleRecord || employee || {};

  return {
    shift_start: formatMilitaryTime(source.shift_start || source.start_time || "08:00"),
    shift_end: formatMilitaryTime(source.shift_end || source.end_time || "17:00"),
    break_start: formatMilitaryTime(source.break_start || "10:00"),
    break_end: formatMilitaryTime(source.break_end || "10:15"),
    lunch_start: formatMilitaryTime(source.lunch_start || "12:00"),
    lunch_end: formatMilitaryTime(source.lunch_end || "13:00"),
    second_break_start: formatMilitaryTime(source.second_break_start || "15:00"),
    second_break_end: formatMilitaryTime(source.second_break_end || "15:15"),
    off_days: source.off_days || "",
    sub_department: employee?.sub_department || "",
  };
}

   
function getScheduleChangePayload(request) {
    if (!request || request.type !== "Schedule Change")
        return {};
    // Future-proofing: if a schedule-change request is later submitted with explicit
    // schedule fields, only these approved fields can update the employee master schedule.
    return SCHEDULE_FIELDS.reduce((payload, field) => {
        if (request[field] !== undefined && request[field] !== "")
            payload[field] = request[field];
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
    if (nowMinutes !== null && shiftStart !== null && nowMinutes < shiftStart - 5) {
        return {
            category: "Early Unscheduled",
            approval: "Pending Approval",
            payableStatus: "Pending Manager Approval",
            locked: true,
            reason: "Employee started more than 5 minutes before scheduled shift",
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
    if (!employee || isTodayOffDay(employee))
        return false;
    const endMinutes = timeToMinutes(endTime);
    const shiftEnd = timeToMinutes(employee.shift_end);
    return endMinutes !== null && shiftEnd !== null && endMinutes > shiftEnd;
}
function getShiftStartOrNow(employee, time) {
    if (!employee)
        return time;
    const nowMinutes = timeToMinutes(time);
    const shiftStart = timeToMinutes(employee.shift_start);
    if (nowMinutes !== null && shiftStart !== null && nowMinutes < shiftStart)
        return time;
    return employee.shift_start || time;
}
function getTodayShiftSummary(employee) {
    if (!employee)
        return { isOff: false, label: "No schedule", detail: "No employee selected." };
    const schedule = getStableSchedule(employee, employeeSchedules);
console.log("Today Shift Debug v2", {
  employee_id: employee?.employee_id,
  email: employee?.email,
  schedule,
  employeeSchedules,
});
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
function hasPendingScheduleOverride(requestsList, employeeId) {
    return requestsList.some((request) => request.employee_id === employeeId &&
        request.type === "Schedule Override" &&
        ["Pending", "Pending Manager Approval"].includes(request.status));
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
    if (!startDate)
        return false;
    return dateValue >= startDate && dateValue <= (endDate || startDate);
}
function hasApprovedScheduleOverride(requestsList, employeeId, dateValue = today) {
    return requestsList.some((request) => request.employee_id === employeeId &&
        request.type === "Schedule Override" &&
        request.status === "Approved" &&
        requestCoversDate(request, dateValue));
}
function showSickBalanceForCountry(country) {
    return String(country || "").toLowerCase() === "canada";
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
        sickApprovedDays: sickApproved.reduce((sum, request) => sum + safeNumber(request.requested_days || request.hours / 8, 0), 0),
        ptoApprovedDays: ptoApproved.reduce((sum, request) => sum + safeNumber(request.requested_days || request.hours / 8, 0), 0),
        vtoApprovedHours: vtoApproved.reduce((sum, request) => sum + safeNumber(request.hours, 0), 0),
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

    if (type === "PTO") {
        return safeNumber(
            employee.available_days ??
            employee.pto_balance_days ??
            employee.pto_balance,
            0
        );
    }

    if (type === "Sick Leave") {
        return safeNumber(employee.sick_balance_days ?? safeNumber(employee.sick_balance, 0) / 8, 0);
    }

    if (type === "VTO") {
        return safeNumber(employee.vto_balance_days ?? safeNumber(employee.vto_balance, 0) / 8, 0);
    }

    return 0;
}
function balanceFieldDays(type) {
    if (type === "PTO")
        return "pto_balance_days";
    if (type === "Sick Leave")
        return "sick_balance_days";
    if (type === "VTO")
        return "vto_balance_days";
    return null;
}
function isHolidayForCountry(country, date, holidays = countryHolidaySeed) {
    return holidays.find((holiday) => holiday.country === country && formatDateOnly(holiday.holiday_date) === formatDateOnly(date));
}
function employeeLiveStatus(employee, timeEntries = [], activityLog = []) {
    const latestActivity = activityLog.find((a) => a.employee_id === employee.id);
    const latestTime = timeEntries.find((t) => t.employee_id === employee.id);
    const status = latestActivity?.status || latestTime?.category || "Offline";
    getStableSchedule(employee, employeeSchedules)
    if (isTodayOffDay(employee))
        return { status: "Off Day", color: "gray", note: "Scheduled off" };
    if (status === "Working")
        return { status, color: "green", note: formatTimeRange(schedule.shift_start, schedule.shift_end) };
    if (["Break", "Lunch"].includes(status))
        return { status, color: "yellow", note: "Away from production" };
    if (["Meeting", "Training", "Coaching"].includes(status))
        return { status, color: "blue", note: "Scheduled task" };
    if (["Overtime", "Early Unscheduled", "Off-Day Unscheduled"].includes(status))
        return { status, color: "red", note: "Requires review" };
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
        const callbackName = "candoHrCallback_" +
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
        }
        catch (error) {
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
    if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING"))
        return null;
    try {
        const responseData = await googleJsonpWithRetry({ action: "getAll" }, 2);
        console.log("Google Sheets GET result:", responseData);
        return responseData?.success ? responseData.data : null;
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
            return (React.createElement("div", { className: "errorPage" },
                React.createElement("style", null, styles),
                React.createElement("section", { className: "errorCard" },
                    React.createElement("h1", null, "Something needs attention"),
                    React.createElement("p", null, "The app did not load this section correctly. This prevents a blank screen during testing."),
                    React.createElement("pre", null, this.state.message),
                    React.createElement("button", { className: "primary", onClick: () => window.location.reload() }, "Reload app"))));
        }
        return this.props.children;
    }
}
function ManagerOverrideModal({ title, message, onCancel, onConfirm }) {
    return (React.createElement("div", { className: "modalBackdrop" },
        React.createElement("div", { className: "overrideCard" },
            React.createElement("h2", null, title || "Manager approval required"),
            React.createElement("p", null, message ||
                "This action requires manager review before it can be completed."),
            React.createElement("div", { className: "overrideActions" },
                React.createElement("button", { type: "button", className: "btn", onClick: onCancel }, "Cancel"),
                React.createElement("button", { type: "button", className: "primary", onClick: onConfirm }, "Approve Override")))));
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
    const [adminMode, setAdminMode] = useState(false);
    const [search, setSearch] = useState("");
    const [reportView, setReportView] = useState("LOB");
    const [filters, setFilters] = useState({ lob: "All", department: "All", subDepartment: "All", employee: "All", country: "All", category: "All", startDate: "", endDate: "" });
    const [filterRefreshTick, setFilterRefreshTick] = useState(0);
    function updateFilters(patch) {
        setFilters((current) => ({ ...current, ...patch }));
    }
    function refreshFilters() {
        setFilterRefreshTick((current) => current + 1);
        setFilters((current) => ({ ...current }));
        showToast("Filters refreshed", "The current filters were reapplied to the latest loaded database data.", "info");
    }
    function clearFilters() {
        setFilters({ lob: "All", department: "All", subDepartment: "All", employee: "All", country: "All", category: "All", startDate: "", endDate: "" });
        setSearch("");
        setFilterRefreshTick((current) => current + 1);
    }
    const [agentStatus, setAgentStatus] = useState("Working");
    const [newTime, setNewTime] = useState({ category: "Working", category_start: "08:00", category_end: "09:00", notes: "" });
    const [newRequest, setNewRequest] = useState({ type: "PTO", start_date: today, end_date: today, hours: 8, reason: "" });
    const [requestCalendarDate, setRequestCalendarDate] = useState(today);
    const [requestCalendarEndDate, setRequestCalendarEndDate] = useState(getLocalDateKey(new Date(Date.now() + 29 * 86400000)));
    const [selectedCapacityDate, setSelectedCapacityDate] = useState(today);
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
    const attendanceEmailQueueRef = useRef(new Set());
    async function syncWorkforcePlanningSheet(options = {}) {
        const { silent = false, automatic = false } = options;
        try {
            const workforceRows = await fetchWorkforceSheetRows();
            if (!workforceRows.length) {
                if (!silent) {
                    showToast("Workforce sheet not synced", "No matching rows were found. Confirm the sheet is shared with viewer access and has Employee_ID plus operational columns.", "warning");
                }
                return { updatedCount: 0, importedCount: 0, missingCount: 0 };
            }
            let syncResult = { updatedCount: 0, importedCount: 0, missingCount: 0 };
            setEmployees((current) => {
                syncResult = mergeWorkforceRowsIntoEmployees(current, workforceRows, { importMissing: true });
                return syncResult.employees;
            });
            const syncDate = getLocalDateKey(new Date());
            const syncedAt = new Date().toLocaleString();
            const syncMode = automatic ? "Automatic Saturday Sync" : "Manual Sync";
            if (automatic) {
                localStorage.setItem(WORKFORCE_SYNC_LAST_RUN_KEY, syncDate);
                weeklyWorkforceSyncRef.current = syncDate;
            }
            setLastWorkforceSync({ ...syncResult, syncedAt, syncMode, nextScheduledSync: "Saturday 5:00 AM" });
            setDatabaseStatus(`${syncMode} completed: ${syncResult.updatedCount} employee(s) updated and ${syncResult.importedCount || 0} employee(s) imported. Protected identity fields were not overwritten.`);
            if (!silent) {
                showToast("Workforce sheet synced", `${syncResult.updatedCount} employee(s) updated and ${syncResult.importedCount || 0} imported. Email, password, role, hire date, access level, and ID were protected.`, "success");
            }
            return syncResult;
        }
        catch (error) {
            console.error("Workforce planning sync failed:", error);
            if (!silent)
                showToast("Workforce sync failed", error?.message || "Please verify the shared sheet access.", "danger");
            return { updatedCount: 0, importedCount: 0, missingCount: 0 };
        }
    }
    useEffect(() => {
        async function loadGoogleDatabase() {
            const database = await googleGetDatabase();
            if (!database) {
                setDatabaseStatus("Demo mode active. Using built-in demo users and sample HR data. Production employee, request, time log, approval, and payroll data are loading from Supabase. Google Sheets roster sync remains available as an admin-only backup/import tool.");
                return;
            }
            const sheetEmployees = (database.employees || []).map(mapEmployeeFromSheet);
            const sheetEmployeeSchedules = database.employee_schedules || database.employeeSchedules || [];
            const sheetTime = (database.timeLogs || []).map(mapTimeFromSheet);
            const sheetRequests = (database.requests || []).map(mapRequestFromSheet);
            const sheetRules = (database.staffingRules || []).map(mapRuleFromSheet);
            const sheetLobs = (database.lobs || []).map((row) => row.LOB_Name).filter(Boolean);
            const sheetDepartments = (database.departments || []).map((row) => row.Department_Name).filter(Boolean);
            const sheetSubDepartments = (database.subDepartments || database.sub_departments || []).map((row) => row.Sub_Department_Name || row.Sub_Department || row.Name).filter(Boolean);
            if (sheetEmployees.length)
                setEmployees(sheetEmployees);
            if (sheetEmployeeSchedules.length)
  setEmployeeSchedules(sheetEmployeeSchedules);
            if (sheetTime.length)
                setTimeEntries(sheetTime);
            if (sheetRequests.length)
                setRequests(sheetRequests);
            if (sheetRules.length)
                setRules(sheetRules);
            if (sheetLobs.length)
                setLobs([...new Set(sheetLobs)]);
            if (sheetDepartments.length)
                setDepartments([...new Set(sheetDepartments)]);
            if (sheetSubDepartments.length)
                setSubDepartments([...new Set(sheetSubDepartments)]);
            setDatabaseStatus("Supabase database connected live. Workforce roster sync can still run from Google Sheets manually by an admin when needed.");
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
        if (toastTimerRef.current)
            clearTimeout(toastTimerRef.current);
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
            }
            else {
                setProcessingModal(null);
            }
            return result;
        }
        catch (error) {
            console.error(error);
            setProcessingModal({
                status: "danger",
                title: "Action failed",
                message: error?.message || "The update was not saved. Please review and try again.",
            });
            showToast("Action failed", error?.message || "Please review the console or try again.", "danger");
            setTimeout(() => setProcessingModal(null), 2600);
            return null;
        }
        finally {
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
    const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser.id);
    const selectedEmployee = isAgentOnly ? currentUser : employees.find((e) => e.id === selectedEmployeeId) || currentUser;
    const visibleEmployees = isAgentOnly ? [currentUser] : employees;
    const visibleTime = isAgentOnly ? timeEntries.filter((t) => t.employee_id === currentUser.id) : timeEntries;
    const visibleRequests = isAgentOnly ? requests.filter((r) => r.employee_id === currentUser.id) : requests;
    const visibleActivity = isAgentOnly ? activityLog.filter((a) => a.employee_id === currentUser.id) : activityLog;
    const filteredVisibleEmployees = visibleEmployees.filter((employee) => {
        return ((filters.lob === "All" || employee.lob === filters.lob) &&
            (filters.department === "All" || employee.department === filters.department) &&
            (filters.subDepartment === "All" || employee.sub_department === filters.subDepartment) &&
            (filters.employee === "All" || employee.full_name === filters.employee) &&
            (filters.country === "All" || employee.country === filters.country));
    });
    useEffect(() => {
        if (!isAuthenticated || isAgentOnly)
            return undefined;
        const checkWeeklySync = () => {
            const now = new Date();
            if (!isWeeklyWorkforceSyncWindow(now))
                return;
            const todayKey = getLocalDateKey(now);
            const lastStoredSync = localStorage.getItem(WORKFORCE_SYNC_LAST_RUN_KEY);
            if (lastStoredSync === todayKey || weeklyWorkforceSyncRef.current === todayKey)
                return;
            weeklyWorkforceSyncRef.current = todayKey;
            syncWorkforcePlanningSheet({ silent: true, automatic: true });
        };
        checkWeeklySync();
        const interval = window.setInterval(checkWeeklySync, 60000);
        return () => window.clearInterval(interval);
    }, [isAuthenticated, isAgentOnly]);
    const lobOptions = ["All", ...new Set([...lobs, ...visibleEmployees.map((e) => e.lob).filter(Boolean)])];
    const departmentOptions = ["All", ...new Set([...departments, ...visibleEmployees.map((e) => e.department).filter(Boolean)])];
    const subDepartmentOptions = ["All", ...new Set([...subDepartments, ...visibleEmployees.map((e) => e.sub_department).filter(Boolean)])];
    const employeeOptions = ["All", ...visibleEmployees.map((e) => e.full_name)];
    const countryOptions = ["All", ...new Set(visibleEmployees.map((e) => e.country).filter(Boolean))];
    const categoryOptions = ["All", ...timeCategories, "Sick Leave", "Paid Leave", "Unpaid Leave"];
    const filteredTime = visibleTime.filter((t) => {
        const dateOk = (!filters.startDate || t.date >= filters.startDate) && (!filters.endDate || t.date <= filters.endDate);
        return (dateOk &&
            (filters.lob === "All" || t.lob === filters.lob) &&
            (filters.department === "All" || t.department === filters.department) &&
            (filters.subDepartment === "All" || (t.sub_department || employees.find((e) => e.id === t.employee_id)?.sub_department || "") === filters.subDepartment) &&
            (filters.employee === "All" || t.employee_name === filters.employee) &&
            (filters.country === "All" || employees.find((e) => e.id === t.employee_id)?.country === filters.country) &&
            (filters.category === "All" || t.category === filters.category));
    });
    const filteredRequests = visibleRequests.filter((r) => {
        const employee = employees.find((e) => e.id === r.employee_id);
        const dateOk = (!filters.startDate || r.start_date >= filters.startDate) && (!filters.endDate || r.end_date <= filters.endDate);
        return (dateOk &&
            (filters.lob === "All" || employee?.lob === filters.lob) &&
            (filters.department === "All" || employee?.department === filters.department) &&
            (filters.subDepartment === "All" || employee?.sub_department === filters.subDepartment) &&
            (filters.employee === "All" || r.employee_name === filters.employee) &&
            (filters.country === "All" || employee?.country === filters.country) &&
            (filters.category === "All" || r.type === filters.category));
    });
    const filteredEmployees = filteredVisibleEmployees.filter((e) => [e.full_name, e.email, e.lob, e.department, e.sub_department, e.role, e.country, e.supervisor, e.manager]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()));
    const requestPreview = useMemo(() => {
        const requestedHours = calculateRequestHours(newRequest);
        const requestedDays = requestedHours;
        const currentBalance = getBalance(selectedEmployee, newRequest.type);
        return {
            requestedHours,
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
            payrollExceptions: filteredTime.filter((t) => t.approved === "Pending").length,
            productivity: total ? Math.round((working / total) * 100) : 0,
            overtimeMinutes,
            total,
        };
    }, [filteredTime, filteredVisibleEmployees, visibleRequests]);
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
        const groupedEmployees = groupBy(filteredVisibleEmployees, keyGetter);
        const groups = [];
        groupedEmployees.forEach((groupEmployees, groupName) => {
            const ids = new Set(groupEmployees.map((e) => e.id));
            const groupTime = filteredTime.filter((t) => ids.has(t.employee_id));
            const groupRequests = filteredRequests.filter((r) => ids.has(r.employee_id));
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
    }, [filteredVisibleEmployees, filteredTime, filteredRequests, reportView]);
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

    function isEmployeeOffOnDate(employee, dateValue) {
        const parsedDate = new Date(`${dateValue}T00:00:00`);
        if (Number.isNaN(parsedDate.getTime()))
            return false;
        const dayName = WEEK_DAYS[parsedDate.getDay()].toLowerCase();
        return normalizeOffDays(employee?.off_days).some((day) => day.toLowerCase() === dayName);
    }
    function getCapacityRuleForEmployee(employee) {
        return rules.find((rule) => (!rule.lob || rule.lob === employee?.lob) &&
            (!rule.department || rule.department === employee?.department) &&
            (!rule.sub_department || rule.sub_department === employee?.sub_department)) ||
            rules.find((rule) => (!rule.lob || rule.lob === employee?.lob) &&
                (!rule.department || rule.department === employee?.department)) ||
            rules.find((rule) => rule.lob === employee?.lob) ||
            rules[0];
    }
    function getRequestCapacityForDate(dateValue) {
        const scopedEmployees = filteredVisibleEmployees.filter((employee) => employee.employment_status === "Active");
        const scheduledAgents = scopedEmployees.filter((employee) => !isEmployeeOffOnDate(employee, dateValue));
        const offDayAgents = scopedEmployees.filter((employee) => isEmployeeOffOnDate(employee, dateValue));
        const approvedForDate = requests.filter((request) => request.status === "Approved" && requestCoversDate(request, dateValue));
        const pendingForDate = requests.filter((request) => ["Pending", "Pending Manager Approval"].includes(request.status) && requestCoversDate(request, dateValue));
        const countType = (items, type) => items.filter((request) => request.type === type).length;
        const ptoAgents = countType(approvedForDate, "PTO");
        const vtoAgents = countType(approvedForDate, "VTO");
        const sickAgents = countType(approvedForDate, "Sick Leave");
        const selectedRule = getCapacityRuleForEmployee(selectedEmployee);
        const capacityLimit = newRequest.type === "VTO"
            ? safeNumber(selectedRule?.max_vto_out, 0)
            : newRequest.type === "Sick Leave"
                ? safeNumber(selectedRule?.max_sick_out, 0)
                : safeNumber(selectedRule?.max_pto_out, 0);
        const usedForSelectedType = newRequest.type === "VTO" ? vtoAgents : newRequest.type === "Sick Leave" ? sickAgents : ptoAgents;
        const availableSlots = Math.max(0, capacityLimit - usedForSelectedType);
        return {
            date: dateValue,
            scheduledAgents: scheduledAgents.length,
            offDayAgents: offDayAgents.length,
            ptoAgents,
            vtoAgents,
            sickAgents,
            pending: pendingForDate.length,
            capacityLimit,
            availableSlots,
            selectedRule,
            isOpen: capacityLimit === 0 ? true : availableSlots > 0,
        };
    }
    function getRequestCalendarAlternatives() {
        const start = new Date(`${requestCalendarDate || today}T00:00:00`);
        const end = new Date(`${requestCalendarEndDate || requestCalendarDate || today}T00:00:00`);
        if (Number.isNaN(start.getTime()))
            return [getRequestCapacityForDate(today)];
        const normalizedEnd = Number.isNaN(end.getTime()) || end < start ? start : end;
        const totalDays = Math.min(31, Math.max(1, Math.round((normalizedEnd - start) / 86400000) + 1));
        return Array.from({ length: totalDays }).map((_, index) => {
            const date = new Date(start);
            date.setDate(date.getDate() + index);
            const dateValue = getLocalDateKey(date);
            return getRequestCapacityForDate(dateValue);
        });
    }

    function addLob() {
        const value = newLob.trim();
        if (!value)
            return;
        if (!lobs.includes(value))
            setLobs([...lobs, value]);
        googleAddRow("lobs", { LOB_ID: cleanId("LOB"), LOB_Name: value, Status: "Active", Created_Date: new Date() });
        setNewLob("");
    }
    function addDepartment() {
        const value = newDepartment.trim();
        if (!value)
            return;
        if (!departments.includes(value))
            setDepartments([...departments, value]);
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
        if (!cleanValue)
            return;
        if (!subDepartments.includes(cleanValue))
            setSubDepartments([...subDepartments, cleanValue]);
        googleAddRow("subDepartments", { Sub_Department_ID: cleanId("SUBDEPT"), Sub_Department_Name: cleanValue, Status: "Active", Created_Date: new Date() });
    }
    function deleteSubDepartment(value) {
        setSubDepartments(subDepartments.filter((subDepartment) => subDepartment !== value));
    }
    async function saveEmployee() {
        if (isAgentOnly)
            return;
        if (!newEmployee.full_name || !newEmployee.email) {
            showToast("Missing employee information", "Name and email are required before saving.", "warning");
            return;
        }
        return runProtectedAction("save-employee-" + normalizeEmail(newEmployee.email), "Employee profile", async () => {
            const generatedPassword = DEFAULT_LOGIN_PASSWORD;
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
                temporary_password: generatedPassword,
                must_change_password: true,
                force_password_change: true,
                requires_password_reset: true,
                password_last_updated: "",
            };
            if (supabase)
                await supabase.from("employees").upsert(item);
            await googleAddRow("employees", mapEmployeeToSheet(item));
            setEmployees([item, ...employees]);
            setSelectedEmployeeId(item.id);
            setNewEmployee({ ...newEmployee, full_name: "", email: "" });
            setTimeout(() => {
                alert(`User created successfully.

Email: ${item.email}
Temporary Password: ${generatedPassword}

User can now log into the Agent Portal.`);
            }, 250);
        });
    }
    async function saveRule() {
        if (isAgentOnly)
            return;
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
            if (employee.id !== employeeId)
                return employee;
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
            setEmployees((current) => current.map((employee) => (employee.id === employeeId ? updatedEmployee : employee)));
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
        if (!attendanceEmailSettings.enabled || !employee)
            return "";
        if (attendanceEmailSettings.lobFilter !== "All" && employee.lob !== attendanceEmailSettings.lobFilter)
            return "";
        const recipients = [];
        if (attendanceEmailSettings.includeManager && employee.manager)
            recipients.push(employee.manager);
        if (attendanceEmailSettings.includeSupervisor && employee.supervisor)
            recipients.push(employee.supervisor);
        if (attendanceEmailSettings.includeHrWfm && attendanceEmailSettings.hrWfmEmails) {
            attendanceEmailSettings.hrWfmEmails
                .split(/[;,]/)
                .map((email) => email.trim())
                .filter(Boolean)
                .forEach((email) => recipients.push(email));
        }
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
        if (!ATTENDANCE_DAILY_EMAILS_ENABLED || !attendanceEmailSettings.enabled || !employee)
            return;
        const recipients = getAttendanceEmailRecipients(employee);
        if (!recipients)
            return;
        const dateKey = getLocalDateKey(new Date());
        const queueKey = `${employee.id}-${recipients}-${dateKey}-${attendanceEmailSettings.deliveryMode}`;
        // Daily Summary creates one pending emailQueue row per employee/recipient/date in the current app session.
        // Apps Script should process emailQueue rows with Status = "Pending Send" using GmailApp.sendEmail().
        if (attendanceEmailQueueRef.current.has(queueKey))
            return;
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
        }
        catch (error) {
            console.error("Daily attendance email queue failed:", error);
        }
    }
    async function queueAttendanceTestEmail() {
        if (isAgentOnly)
            return;
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
        const now = new Date();
        const time = now.toTimeString().slice(0, 5);
        getStableSchedule(selectedEmployee, employeeSchedules)
        const autoClass = getAutoWorkClassification(selectedEmployee, time);
        if (["Shift Started", "Status Changed"].includes(action) &&
            ["Off-Day Unscheduled", "Early Unscheduled"].includes(autoClass.category) &&
            !requests.some((request) => String(request.employee_id) === String(selectedEmployee.id) &&
                request.type === "Schedule Override" &&
                request.status === "Approved" &&
                String(request.requested_at || request.date || request.created_at || "").slice(0, 10) === today)) {
            const reason = autoClass.category === "Off-Day Unscheduled"
                ? "Attempted login on scheduled off day"
                : "Attempted login before scheduled shift start";
            if (!hasPendingScheduleOverride(requests, selectedEmployee.id)) {
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
                }
                catch (error) {
                    console.error("Schedule override sync failed:", error);
                }
            }
            window.alert("You are not available to log in at this time. Please reach your manager. A Schedule Override request has been created for manager approval.");
            showToast("Manager approval required", "You are outside your approved schedule. A Schedule Override request was submitted and work is blocked until approval.", "warning");
            return null;
        }
        const hasApprovedScheduleOverride = requests.some((request) => String(request.employee_id) === String(selectedEmployee.id) &&
            request.type === "Schedule Override" &&
            request.status === "Approved" &&
            String(request.requested_at || request.date || "").slice(0, 10) === today);
        const resolvedStatus = action === "Shift Ended" && shouldSplitAutoOvertime(selectedEmployee, time)
            ? "Overtime"
            : hasApprovedScheduleOverride
                ? status
                : action === "Shift Started" || action === "Status Changed"
                    ? autoClass.category === "Working"
                        ? status
                        : autoClass.category
                    : status;
        const approvalStatus = resolvedStatus === "Off-Day Unscheduled" || resolvedStatus === "Early Unscheduled"
            ? "Pending Approval"
            : resolvedStatus === "Overtime"
                ? "Pending"
                : action.includes("Shift")
                    ? "Pending"
                    : "Auto Logged";
        const key = `agent-action-${selectedEmployee.id}-${action}-${resolvedStatus}-${time}`;
        return runProtectedAction(key, action, async () => {
            const duplicate = timeEntries.some((entry) => entry.employee_id === selectedEmployee.id &&
                entry.date === today &&
                entry.category === resolvedStatus &&
                entry.category_start === time &&
                entry.notes === action);
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
            }
            else {
                entriesToSave.push(baseTimeEntry);
            }
            if (supabase)
                await supabase.from("time_entries").insert(entriesToSave);
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
            if (employee.employment_status !== "Active")
                return false;
            const employeeEntries = timeEntries.filter((entry) => entry.employee_id === employee.id && entry.date === dateValue);
            const hasShiftStart = employeeEntries.some((entry) => entry.notes === "Shift Started" || entry.category === "Working");
            const hasShiftEnd = employeeEntries.some((entry) => entry.notes === "Shift Ended" || entry.notes === "System auto logout at 12:59" || entry.category === "Auto Logout");
            return hasShiftStart && !hasShiftEnd;
        });
    }
    async function autoStopDailyTimers(dateValue = new Date().toISOString().slice(0, 10), stopTime = DAILY_TIMER_STOP_TIME) {
        const openEmployees = getOpenShiftEmployeesForDate(dateValue);
        if (!openEmployees.length)
            return;
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
            if (supabase)
                await supabase.from("time_entries").insert(autoEntries);
            for (const entry of autoEntries) {
                await googleAddRow("timeLogs", mapTimeToSheet(entry));
            }
        }
        catch (error) {
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
            const duplicate = timeEntries.some((entry) => entry.employee_id === selectedEmployee.id &&
                entry.date === today &&
                entry.category === newTime.category &&
                entry.category_start === newTime.category_start &&
                entry.category_end === newTime.category_end &&
                entry.notes === newTime.notes);
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
            if (supabase)
                await supabase.from("time_entries").insert(item);
            await googleAddRow("timeLogs", mapTimeToSheet(item));
            await queueDailyAttendanceEmail(selectedEmployee, [item]);
            setTimeEntries((current) => [item, ...current]);
        });
    }
    async function saveRequest() {
        const key = `request-${selectedEmployee.id}-${newRequest.type}-${newRequest.start_date}-${newRequest.end_date}-${newRequest.hours}-${newRequest.reason}`;
        return runProtectedAction(key, "Request submission", async () => {
            const duplicate = requests.some((request) => request.employee_id === selectedEmployee.id &&
                request.type === newRequest.type &&
                request.start_date === newRequest.start_date &&
                request.end_date === newRequest.end_date &&
                request.status === "Pending" &&
                String(request.reason || "").trim() === String(newRequest.reason || "").trim());
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
            if (supabase)
                await supabase.from("time_off_requests").insert(item);
            await googleAddRow("requests", mapRequestToSheet(item));
            await googleAddRow("emailQueue", { Email_ID: cleanId("EMAIL"), Event_Type: "Request Pending Approval", To_Email: selectedEmployee.manager || selectedEmployee.supervisor || "", Employee_Email: selectedEmployee.email, Employee_Name: selectedEmployee.full_name, Request_ID: item.id, Subject: `Pending ${item.type} request approval`, Status: "Pending Send", Created_At: new Date() });
            setRequests((current) => [item, ...current]);
        });
    }
    function getApprovalRiskMessage(request) {
        const employee = employees.find((e) => e.id === request.employee_id);
        if (!employee)
            return "Employee profile was not found. Please confirm before approving.";
        const balance = getBalance(employee, request.type);
        if (balance !== null && safeNumber(request.hours, 0) > safeNumber(balance, 0)) {
            return `${request.employee_name} is requesting ${request.hours} PTO day(s), but the available balance is ${balance} day(s). Manager override is required to continue.`;
        }
        const rule = rules.find((r) => r.lob === employee.lob &&
            r.department === employee.department &&
            r.shift_start === employee.shift_start &&
            r.shift_end === employee.shift_end);
        if (!rule)
            return null;
        const usage = getRuleUsage(rule);
        const nextPto = usage.pto + (request.type === "PTO" ? 1 : 0);
        const nextVto = usage.vto + (request.type === "VTO" ? 1 : 0);
        const nextSick = usage.sick + (request.type === "Sick Leave" ? 1 : 0);
        const nextAvailable = usage.scheduled - (nextPto + nextVto + nextSick);
        const exceedsRule = nextPto > safeNumber(rule.max_pto_out, 0) ||
            nextVto > safeNumber(rule.max_vto_out, 0) ||
            nextSick > safeNumber(rule.max_sick_out, 0) ||
            nextAvailable < safeNumber(rule.min_staff_required, 0);
        if (!exceedsRule)
            return null;
        return `Approving this ${request.type} may exceed the staffing rule for ${employee.lob} / ${employee.department}. Current after approval: PTO ${nextPto}/${rule.max_pto_out}, VTO ${nextVto}/${rule.max_vto_out}, Sick ${nextSick}/${rule.max_sick_out}, Available ${nextAvailable}, Minimum required ${rule.min_staff_required}. Manager override is required.`;
    }
    async function setRequestStatus(id, status) {
        if (isAgentOnly)
            return;
        const request = requests.find((r) => r.id === id);
        if (!request)
            return;
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
                        if (e.id !== latestRequest.employee_id)
                            return e;
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
                if (latestRequest.type === "Schedule Override" && updatedEmployee) {
                    updatedEmployees = updatedEmployees.map((employee) => employee.id === latestRequest.employee_id
                        ? {
                            ...employee,
                            off_day_approved: true,
                            schedule_exception_date: latestRequest.start_date || today,
                            schedule_exception_reason: latestRequest.reason || "Approved schedule override",
                        }
                        : employee);
                    updatedEmployee = updatedEmployees.find((employee) => employee.id === latestRequest.employee_id);
                    if (updatedEmployee) {
                        await googleUpdateRow("employees", "Employee_ID", latestRequest.employee_id, mapEmployeeToSheet(updatedEmployee));
                    }
                    showToast("Schedule exception approved", `${latestRequest.employee_name} can now log in outside the standard schedule for ${formatDateOnly(latestRequest.start_date || today)} only.`, "success");
                }
                if (latestRequest.type === "Schedule Change" && updatedEmployee) {
                    const schedulePayload = getScheduleChangePayload(latestRequest);
                    if (Object.keys(schedulePayload).length) {
                        updatedEmployees = updatedEmployees.map((employee) => {
                            if (employee.id !== latestRequest.employee_id)
                                return employee;
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
                projected_balance: status === "Approved" && updatedEmployee && balanceField(latestRequest.type)
                    ? updatedEmployee[balanceField(latestRequest.type)]
                    : latestRequest.projected_balance,
            };
            if (supabase)
                await supabase.from("time_off_requests").update({ status }).eq("id", id);
            await googleUpdateRow("requests", "Request_ID", id, mapRequestToSheet(updatedRequest));
            await googleAddRow("emailQueue", { Email_ID: cleanId("EMAIL"), Event_Type: `Request ${status}`, To_Email: updatedEmployee?.email || "", Employee_Email: updatedEmployee?.email || "", Employee_Name: latestRequest.employee_name, Request_ID: latestRequest.id, Subject: `${latestRequest.type} request ${status}`, Status: "Pending Send", Created_At: new Date() });
            await googleAddRow("approvals", mapApprovalToSheet({
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
            }));
            setEmployees(updatedEmployees);
            setRequests((current) => current.map((r) => (r.id === id ? updatedRequest : r)));
        });
    }
    async function setTimeStatus(id, approved) {
        if (isAgentOnly)
            return;
        const timeEntry = timeEntries.find((t) => t.id === id);
        if (!timeEntry)
            return;
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
            if (supabase)
                await supabase.from("time_entries").update({ approved }).eq("id", id);
            await googleUpdateRow("timeLogs", "Log_ID", id, mapTimeToSheet(updatedTimeEntry));
            await googleAddRow("approvals", mapApprovalToSheet({
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
            }));
            setTimeEntries((current) => current.map((t) => (t.id === id ? updatedTimeEntry : t)));
        });
    }
    function editTimeEntryLocal(id, field, value) {
        if (!canEditTimeLogs(currentUser?.access_level || currentUser?.role || "Employee")) {
            showToast("Access denied", "Only TLs, Managers, Reporting, HR, Payroll, and Admin users can edit previous time logs.", "danger");
            return;
        }
        setTimeEntries((current) => current.map((entry) => {
            if (entry.id !== id)
                return entry;
            const next = { ...entry, [field]: value };
            if (field === "category" && value === "Overtime") {
                next.approved = "Pending";
                next.payable_status = "Pending Manager Approval";
                next.auto_rule = next.auto_rule || "Manual correction changed to overtime for payroll review";
            }
            return next;
        }));
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
                await supabase.from("time_entries").update(correctedEntry).eq("id", id);
            }
            await googleUpdateRow("timeLogs", "Log_ID", id, mapTimeToSheet(correctedEntry));
            await googleAddRow("approvals", mapApprovalToSheet({
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
            }));
            setTimeEntries((current) => current.map((entry) => (entry.id === id ? correctedEntry : entry)));
            showToast("Time log saved", "The previous time log was corrected and retained for audit review.", "success");
        });
    }
    function importEmployees(event) {
        if (isAgentOnly)
            return;
        const file = event.target.files?.[0];
        if (!file)
            return;
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
            if (supabase && imported.length)
                await supabase.from("employees").upsert(imported);
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
        doc.text("Magnemite HR Workforce Report", 14, 16);
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
            downloadFile(`cando-hr-archive-${today}.json`, JSON.stringify(archive, null, 2), "application/json");
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
            employee.temp_password,
            employee.temporary_password,
            DEFAULT_LOGIN_PASSWORD,
            "Welcome2026!",
        ]
            .filter((value) => value !== undefined && value !== null && String(value) !== "")
            .some((value) => loginPasswordValue === String(value));
        const mustCreatePersonalPassword = Boolean(
            employee.requires_password_reset === true ||
            employee.force_password_change === true ||
            employee.must_change_password === true ||
            String(employee.requires_password_reset || "").toLowerCase() === "true" ||
            String(employee.force_password_change || "").toLowerCase() === "true" ||
            String(employee.must_change_password || "").toLowerCase() === "true" ||
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
        setEmployees((current) => current.map((item) => (item.id === employee.id ? updatedEmployee : item)));
        try {
            if (supabase) {
                const { error: employeeUpdateError } = await supabase.from("employees").update({
                    temp_password: temporaryPassword,
                    temporary_password: temporaryPassword,
                    must_change_password: true,
                    force_password_change: true,
                    requires_password_reset: true,
                    password_reset_status: "Temporary Password Issued",
                    password_reset_requested_at: new Date().toISOString(),
                }).eq("id", employee.id);
                if (employeeUpdateError) console.warn("Supabase employee temp password update warning:", employeeUpdateError.message || employeeUpdateError);
                const { error: queueError } = await supabase.from("email_queue").insert({
                    recipient: employee.email,
                    to_email: employee.email,
                    subject: "Temporary password for Magnemite.app",
                    body: `Hello ${employee.full_name || "Employee"}, your temporary password is: ${temporaryPassword}. After login, the app will ask you to create a personalized password.`,
                    status: "Pending Send",
                    event_type: "Forgot Password Temporary Password",
                    created_at: new Date().toISOString(),
                });
                if (queueError) console.warn("Supabase email_queue warning:", queueError.message || queueError);
            }
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
        }
        catch (error) {
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
            password_reset_status: "Completed",
            password_last_updated: new Date().toISOString(),
        };
        try {
            if (supabase) {
                const { error } = await supabase.from("employees").update({
                    temp_password: newPersonalPassword,
                    temporary_password: "",
                    must_change_password: false,
                    force_password_change: false,
                    requires_password_reset: false,
                    password_reset_status: "Completed",
                    password_last_updated: updatedEmployee.password_last_updated,
                }).eq("id", passwordResetUser.id);
                if (error) console.warn("Supabase personalized password update warning:", error.message || error);
            }
            await googleUpdateRow("employees", "Employee_ID", passwordResetUser.id, mapEmployeeToSheet(updatedEmployee));
        }
        catch (error) {
            console.error("Personalized password update failed:", error);
        }
        setEmployees((current) => current.map((item) => (item.id === passwordResetUser.id ? updatedEmployee : item)));
        localStorage.setItem("candoHrUserEmail", updatedEmployee.email);
        setSessionUserEmail(updatedEmployee.email);
        setSelectedEmployeeId(updatedEmployee.id);
        setPasswordResetUser(null);
        setNewPersonalPassword("");
        setConfirmPersonalPassword("");
        setLoginPassword("");
        setAdminMode(false);
        setAuthError("");
        setResetNotice("");
        showToast("Password updated", "Your personalized password was saved successfully.", "success");
    }

    function logout() {
        localStorage.removeItem("candoHrUserEmail");
        setSessionUserEmail("");
        setLoginPassword("");
        setPasswordResetUser(null);
        setNewPersonalPassword("");
        setConfirmPersonalPassword("");
        setResetNotice("");
        setAuthError("");
        setAdminMode(false);
        setTab("agent");
    }
    const headerRequestSummary = requestStatusSummary(filteredRequests);
    const scheduledTodayCount = filteredVisibleEmployees.filter((employee) => !isTodayOffDay(employee) && employee.employment_status === "Active").length;
    const activeEmployeeCount = filteredVisibleEmployees.filter((employee) => employee.employment_status === "Active").length;
    function HeaderMetrics() {
        if (isAgentOnly)
            return null;
        if (["requests", "manager"].includes(tab)) {
            return (React.createElement("section", { className: "tabMetrics" },
                React.createElement(Metric, { icon: CalendarDays, label: "Total Requests", value: headerRequestSummary.total, hint: "All filtered requests" }),
                React.createElement(Metric, { icon: Clock, label: "Pending", value: headerRequestSummary.pending, hint: "Awaiting approval" }),
                React.createElement(Metric, { icon: CheckCircle, label: "Approved", value: headerRequestSummary.approved, hint: "Approved requests" }),
                React.createElement(Metric, { icon: XCircle, label: "Denied", value: headerRequestSummary.denied, hint: "Denied requests" })));
        }
        if (["dashboard", "employees", "schedule"].includes(tab)) {
            return (React.createElement("section", { className: "tabMetrics compactMetrics" },
                React.createElement(Metric, { icon: Users, label: "Active Employees", value: activeEmployeeCount, hint: "Active profiles" }),
                React.createElement(Metric, { icon: CalendarDays, label: "Scheduled Today", value: scheduledTodayCount, hint: "Not on off day" })));
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
        return (React.createElement(LoginScreen, { logo: LOGO, email: loginEmail, password: loginPassword, setEmail: setLoginEmail, setPassword: setLoginPassword, onLogin: login, onForgotPassword: handleForgotPassword, error: authError, resetNotice: resetNotice, passwordResetUser: passwordResetUser, newPersonalPassword: newPersonalPassword, confirmPersonalPassword: confirmPersonalPassword, setNewPersonalPassword: setNewPersonalPassword, setConfirmPersonalPassword: setConfirmPersonalPassword, onCompletePasswordReset: completePasswordReset, databaseStatus: databaseStatus, demoAccounts: DEMO_ACCOUNTS }));
    }
    return (React.createElement("div", { className: "app" },
        React.createElement("style", null, styles),
        React.createElement("aside", { className: "sidebar" },
            React.createElement("div", { className: "logoWrap" },
                React.createElement("img", { src: LOGO, alt: "CandoContact" }),
                React.createElement("div", null,
                    React.createElement("strong", null, "Magnemite"),
                    React.createElement("span", null, "Workforce Management Made Simple"))),
            React.createElement("nav", null, navItems.map(([key, Icon]) => (React.createElement("button", { key: key, className: tab === key ? "active" : "", onClick: () => setTab(key) },
                React.createElement(Icon, { size: 18 }),
                " ",
                key === "agent" ? "My Portal" : key === "manager" ? "Approvals" : key)))),
            isAuthenticated && (React.createElement("div", { className: "sessionBox" },
                React.createElement("span", null, "Signed in as"),
                React.createElement("strong", null, currentUser.full_name),
                React.createElement("small", null, currentUser.email),
                React.createElement("button", { onClick: logout }, "Logout"))),
            React.createElement("div", { className: "syncBox" },
                React.createElement(Database, { size: 16 }),
                React.createElement("span", null, databaseStatus)),
            React.createElement(DeveloperMark, { sidebar: true })),
        React.createElement("main", null,
            React.createElement("header", { className: "topbar" },
                React.createElement("div", null,
                    React.createElement("h1", null, isAgentOnly ? "My HR Portal" : "Magnemite Workforce Command Center"),
                    React.createElement("p", null, isAgentOnly ? "Manage your shift, status/disposition, balances, and time-off requests." : "Time tracking, schedules, PTO/VTO, OT, payroll review, rules, and reporting.")),
                isAgentOnly && (React.createElement("div", { className: "actions" },
                    canAccessAdmin && React.createElement("button", { className: "primary", onClick: () => setAdminMode(true) }, "Admin / Manager Access"),
                    React.createElement("button", { onClick: logout }, "Logout"))),
                !isAgentOnly && (React.createElement("div", { className: "actions commandActions" },
                    React.createElement("button", { type: "button", onClick: () => setTab("agent") }, "Return to Agent View"),
                    React.createElement("button", { type: "button", onClick: exportPdf },
                        React.createElement(Download, { size: 14 }),
                        " Download PDF"),
                    React.createElement("button", { type: "button", onClick: exportTimeCsv },
                        React.createElement(Download, { size: 14 }),
                        " Time CSV"),
                    React.createElement("button", { type: "button", onClick: exportRequestsCsv },
                        React.createElement(Download, { size: 14 }),
                        " Requests CSV"),
                    React.createElement("button", {
  type: "button",
  className: "actionUpload",
  onClick: () => syncWorkforcePlanningSheet({ silent: false, automatic: false })
},
  React.createElement(Upload, { size: 14 }),
  " Sync Roster"
),
                    React.createElement("button", { type: "button", onClick: createArchiveBackup }, "Create Backup"),
                    React.createElement("button", { type: "button", onClick: logout }, "Logout"))),
                !isAgentOnly && (React.createElement("section", { className: "filterPanel" },
                    React.createElement(Field, { label: "LOB" },
                        React.createElement("select", { value: filters.lob, onChange: (e) => updateFilters({ lob: e.target.value }) }, lobOptions.map((x) => (React.createElement("option", { key: x, value: x }, x))))),
                    React.createElement(Field, { label: "Department" },
                        React.createElement("select", { value: filters.department, onChange: (e) => updateFilters({ department: e.target.value }) }, departmentOptions.map((x) => React.createElement("option", { key: x }, x)))),
                    React.createElement(Field, { label: "Sub-Department" },
                        React.createElement("select", { value: filters.subDepartment, onChange: (e) => updateFilters({ subDepartment: e.target.value }) }, subDepartmentOptions.map((x) => React.createElement("option", { key: x }, x)))),
                    React.createElement(Field, { label: "Employee" },
                        React.createElement("select", { value: filters.employee, onChange: (e) => updateFilters({ employee: e.target.value }) }, employeeOptions.map((x) => React.createElement("option", { key: x }, x)))),
                    React.createElement(Field, { label: "Country" },
                        React.createElement("select", { value: filters.country, onChange: (e) => updateFilters({ country: e.target.value }) }, countryOptions.map((x) => React.createElement("option", { key: x }, x)))),
                    React.createElement(Field, { label: "Type" },
                        React.createElement("select", { value: filters.category, onChange: (e) => updateFilters({ category: e.target.value }) }, categoryOptions.map((x) => React.createElement("option", { key: x }, x)))),
                    React.createElement(Field, { label: "Start" },
                        React.createElement("input", { type: "date", value: filters.startDate, onChange: (e) => updateFilters({ startDate: e.target.value }) })),
                    React.createElement(Field, { label: "End" },
                        React.createElement("input", { type: "date", value: filters.endDate, onChange: (e) => updateFilters({ endDate: e.target.value }) })),
                    React.createElement("button", { type: "button", className: "primary", onClick: refreshFilters }, "Refresh Filters"),
                    React.createElement("button", { type: "button", onClick: clearFilters }, "Clear Filters")))),
            React.createElement(HeaderMetrics, null),
            !isAgentOnly && lastWorkforceSync && (React.createElement("section", { className: "syncNotice" },
                lastWorkforceSync.syncMode || "Workforce planning sheet synced",
                ": ",
                lastWorkforceSync.updatedCount,
                " employee(s) updated \u00B7 ",
                lastWorkforceSync.missingCount,
                " sheet row(s) not matched \u00B7 ",
                lastWorkforceSync.syncedAt,
                ". Next automatic sync: Saturday 5:00 AM. Protected: email, password, role, access level, hire date, birthday, and employee ID.")),
            tab === "agent" && (React.createElement("section", { className: "agentPortal" },
                React.createElement("div", { className: "agentHero" },
                    React.createElement("div", null,
                        React.createElement("span", null, "Agent Portal"),
                        React.createElement("h2", null,
                            "Welcome, ",
                            selectedEmployee.full_name),
                        React.createElement("p", null,
                            selectedEmployee.role,
                            " \u00B7 ",
                            selectedEmployee.lob,
                            " \u00B7 ",
                            selectedEmployee.department,
                            selectedEmployee.sub_department ? ` · ${selectedEmployee.sub_department}` : ""),
                        React.createElement("div", { className: "profileGrid" },
                            React.createElement(Info, { label: "LOB", value: selectedEmployee.lob }),
                            React.createElement(Info, { label: "Department", value: selectedEmployee.department }),
                            React.createElement(Info, { label: "Sub-Department", value: selectedEmployee.sub_department || "N/A" }),
                            React.createElement(Info, { label: "Role", value: selectedEmployee.role }),
                            React.createElement(Info, { label: "Supervisor", value: selectedEmployee.supervisor || "Not assigned" }),
                            React.createElement(Info, { label: "Country", value: selectedEmployee.country }),
                            React.createElement(Info, { label: "Employment Status", value: selectedEmployee.employment_status }))),
                    React.createElement("div", { className: `agentShiftCard ${isTodayOffDay(selectedEmployee) ? "offDay" : ""}` },
                    
                        React.createElement("span", null, isTodayOffDay(selectedEmployee) ? "Today’s Status" : "Today’s Shift"),
                        React.createElement("strong", null, isTodayOffDay(selectedEmployee) ? `OFF · ${todayDayName()}` : formatTimeRange(selectedEmployee.shift_start, selectedEmployee.shift_end)),
                        isTodayOffDay(selectedEmployee) ? (React.createElement("small", { className: "shiftDetails offDetails" },
                            React.createElement("b", null, "Scheduled off today"),
                            React.createElement("em", null,
                                "Assigned off days: ",
                                formatOffDays(selectedEmployee.off_days)))) : (React.createElement("small", { className: "shiftDetails" },
                            React.createElement("b", null,
                                "Break 1: ",
                                formatTimeRange(selectedEmployee.break_start, selectedEmployee.break_end)),
                            React.createElement("b", null,
                                "Lunch: ",
                                formatTimeRange(selectedEmployee.lunch_start, selectedEmployee.lunch_end)),
                            React.createElement("b", null,
                                "Break 2: ",
                                formatTimeRange(selectedEmployee.second_break_start, selectedEmployee.second_break_end)),
                            React.createElement("em", null,
                                "Off days: ",
                                formatOffDays(selectedEmployee.off_days)))))),
                React.createElement("div", { className: "agentGrid" },
                    React.createElement(Card, { title: "My shift actions" },
                        React.createElement("div", { className: "agentActions" },
                            React.createElement("button", { className: "primary", onClick: () => agentAction("Shift Started", "Working") }, "Start Shift"),
                            React.createElement("button", { onClick: () => agentAction("Shift Ended", "Working") }, "End Shift")),
                        React.createElement("div", { className: "currentStatus" },
                            React.createElement("label", null,
                                React.createElement("span", null, "Current Status / Disposition"),
                                React.createElement("select", { value: agentStatus, onChange: (e) => setAgentStatus(e.target.value) },
                                    React.createElement(TimeCategoryOptions, null))),
                            React.createElement("button", { className: "primary", onClick: () => agentAction("Status Changed", agentStatus) }, "Log Status"),
                            React.createElement("button", { disabled: true, className: "disabledBtn otDisabledBtn", title: "Manual overtime is disabled. Overtime is created automatically after the scheduled shift end." }, "Automatic OT Only"))),
                    React.createElement(Card, { title: "My balances" },
                        React.createElement("div", { className: "balanceGrid" },
                            React.createElement("div", null,
                                React.createElement("span", null, "PTO"),
                                React.createElement("strong", null,
                                    balanceDays(selectedEmployee, "PTO"),
                                    " day(s)")),
                            showSickBalanceForCountry(selectedEmployee.country) && (React.createElement("div", null,
                                React.createElement("span", null, "Sick"),
                                React.createElement("strong", null,
                                    balanceDays(selectedEmployee, "Sick Leave"),
                                    " day(s)"))),
                            React.createElement("div", null,
                                React.createElement("span", null, "Tenure"),
                                React.createElement("strong", null, tenure(selectedEmployee.hire_date)))),
                        React.createElement("div", { className: "monthlyAttendanceBox" },
                            React.createElement("strong", null,
                                "Monthly attendance \u00B7 ",
                                employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).monthLabel),
                            React.createElement("div", { className: "reportMiniGrid" },
                                React.createElement(Info, { label: "Worked", value: `${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).workingHours.toFixed(1)}h` }),
                                React.createElement(Info, { label: "Approved PTO", value: `${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).ptoApprovedDays} day(s)` }),
                                !showSickBalanceForCountry(selectedEmployee.country) && (React.createElement(Info, { label: "Approved Sick Status", value: `${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).sickApprovedDays} day(s)` })),
                                React.createElement(Info, { label: "Approved VTO", value: `${employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).vtoApprovedHours}h` })),
                            React.createElement("div", { className: "miniRequestList" }, employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).approvedRequests.length ? employeeMonthlyAttendance(selectedEmployee, timeEntries, requests).approvedRequests.map((request) => (React.createElement("span", { key: request.id },
                                request.type,
                                ": ",
                                formatDateOnly(request.start_date),
                                " \u00B7 ",
                                request.type === "VTO" ? `${request.hours}h` : `${Number(request.requested_days || request.hours / 8).toFixed(1)} day(s)`))) : React.createElement("span", null, "No approved requests for this month yet.")))),
                    React.createElement(Card, { title: "Submit my PTO / VTO / OT request" },
                        React.createElement("p", { className: "helperText" }, "PTO, VTO, and sick requests are approved in full days. Select the start and end dates and the app calculates the number of requested days automatically."),
                        React.createElement("div", { className: "requestPreview" },
                            React.createElement(Info, { label: "Request Type", value: newRequest.type }),
                            React.createElement(Info, { label: "Requested", value: `${requestPreview.requestedHours} day(s)` }),
                            React.createElement(Info, { label: "Current Balance", value: requestPreview.impactsBalance ? `${requestPreview.currentBalance} day(s)` : "N/A" }),
                            React.createElement(Info, { label: "After Approval", value: requestPreview.impactsBalance ? `${requestPreview.projectedBalance} day(s)` : "No deduction" })),
                        React.createElement(FormGrid, null,
                            React.createElement("select", { value: newRequest.type, onChange: (e) => setNewRequest({ ...newRequest, type: e.target.value }) }, ["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave"].map((x) => React.createElement("option", { key: x, disabled: x === "Overtime" && !OT_REQUESTS_ENABLED }, x === "Overtime" && !OT_REQUESTS_ENABLED ? "Overtime Request (Disabled)" : x))),
                            React.createElement("input", { type: "date", value: newRequest.start_date, onChange: (e) => setNewRequest({ ...newRequest, start_date: e.target.value }) }),
                            React.createElement("input", { type: "date", value: newRequest.end_date, onChange: (e) => setNewRequest({ ...newRequest, end_date: e.target.value }) }),
                            React.createElement("input", { type: "number", min: "0", step: "0.25", title: "Requests are now approved in full days.", value: newRequest.start_date !== newRequest.end_date ? calculateRequestHours(newRequest) : newRequest.hours, disabled: true, onChange: (e) => setNewRequest({ ...newRequest, hours: e.target.value }) }),
                            React.createElement("input", { placeholder: "Reason or notes", value: newRequest.reason, onChange: (e) => setNewRequest({ ...newRequest, reason: e.target.value }) }),
                            React.createElement("button", { className: "primary wide", onClick: saveRequest }, "Submit to Manager"))),
                    React.createElement(Card, { title: "My activity today" },
                        React.createElement(ActivityList, { activities: visibleActivity }))))),
            !isAgentOnly && tab === "dashboard" && (React.createElement("section", { className: "dashboardFloorSection" },
                React.createElement(Card, { title: "Live floor traffic light view by LOB" },
                    React.createElement("p", { className: "helperText" }, "Production-ready live floor view grouped by Line of Business."),
                    React.createElement("div", { className: "lobTrafficSplit largeFloorView" }, lobOptions
                        .filter((lob) => {
                        if (lob === "All")
                            return false;
                        if (filters.lob && filters.lob !== "All") {
                            return lob === filters.lob;
                        }
                        return ["GoDay", "Lending Creative"].includes(lob);
                    })
                        .map((lob) => {
                        const lobEmployees = filteredVisibleEmployees.filter((employee) => employee.employment_status === "Active" &&
                            employee.lob === lob &&
                            !isTodayOffDay(employee));
                        const lobLiveRows = lobEmployees.map((employee) => ({
                            employee,
                            live: getAgentLiveStatus(employee, timeEntries, requests),
                        }));
                        const alertCount = lobLiveRows.filter((row) => row.live?.isAlert || String(row.live?.type || "").includes("alert")).length;
                        const activeCount = lobLiveRows.filter((row) => row.live?.type === "green").length;
                        const awayCount = lobLiveRows.filter((row) => row.live?.type === "yellow").length;
                        const noActivityCount = lobLiveRows.filter((row) => row.live?.type === "gray").length;
                        return (React.createElement("section", { className: "lobTrafficColumn", key: lob },
                            React.createElement("div", { className: "lobTrafficHeader" },
                                React.createElement("h3", null, lob),
                                React.createElement(Badge, null,
                                    lobEmployees.length,
                                    " scheduled")),
                            React.createElement("div", { className: "trafficSummary" },
                                React.createElement("span", { className: alertCount ? "danger" : "" },
                                    "Alerts ", alertCount),
                                React.createElement("span", null,
                                    "Active ", activeCount),
                                React.createElement("span", null,
                                    "Away ", awayCount),
                                React.createElement("span", null,
                                    "No activity ", noActivityCount)),
                            React.createElement("div", { className: "trafficGrid production" },
                                lobLiveRows.map(({ employee, live }) => {
                                    return (React.createElement("div", { className: `trafficCard ${live.type || "gray"}`, key: employee.id },
                                        React.createElement("span", { className: "trafficDot" }),
                                        React.createElement("strong", null, employee.full_name),
                                        React.createElement("small", null,
                                            employee.department,
                                            " \u00B7",
                                            " ",
                                            employee.sub_department || "N/A"),
                                        React.createElement("b", null, live.label || "NO ACTIVITY"),
                                        React.createElement("em", null, live.detail || "")));
                                }),
                                !lobEmployees.length && (React.createElement("p", { className: "muted" }, "No scheduled active agents for this LOB today.")))));                    }))),
                React.createElement(Card, { title: "Break / Lunch / Bathroom usage by team" }, teamStats.length ? (teamStats.map((item) => (React.createElement(Progress, { key: item.label, label: item.label, value: formatHours(item.minutes), percent: stats.total ? (item.minutes / stats.total) * 100 : 0 })))) : (React.createElement("p", { className: "muted" }, "No break-related data for this filter."))))),
            !isAgentOnly && tab === "employees" && (React.createElement("section", { className: "grid split reverse" },
                React.createElement(Card, { title: "Role-based access profiles" },
                    React.createElement("p", { className: "helperText" }, "Reference guide for what each employee access profile can do. This has been moved from Dashboard to Employees so role management stays in one place."),
                    React.createElement("div", { className: "roleProfileGrid" }, Object.entries(ROLE_ACCESS_PROFILES).map(([key, profile]) => (React.createElement("div", { className: "roleProfile", key: key },
                        React.createElement("strong", null, profile.label),
                        React.createElement("span", null, profile.tasks.join(" · "))))))),
                React.createElement(Card, { title: "Add employee" },
                    React.createElement(FormGrid, null,
                        React.createElement("input", { placeholder: "Full name", value: newEmployee.full_name, onChange: (e) => setNewEmployee({ ...newEmployee, full_name: e.target.value }) }),
                        React.createElement("input", { placeholder: "Email", value: newEmployee.email, onChange: (e) => setNewEmployee({ ...newEmployee, email: e.target.value }) }),
                        React.createElement("input", { placeholder: "Country", value: newEmployee.country, onChange: (e) => setNewEmployee({ ...newEmployee, country: e.target.value }) }),
                        React.createElement("select", { value: newEmployee.lob, onChange: (e) => setNewEmployee({ ...newEmployee, lob: e.target.value }) }, lobs.map((lob) => React.createElement("option", { key: lob }, lob))),
                        React.createElement("select", { value: newEmployee.department, onChange: (e) => setNewEmployee({ ...newEmployee, department: e.target.value }) }, departments.map((department) => React.createElement("option", { key: department }, department))),
                        React.createElement("select", { value: newEmployee.sub_department, onChange: (e) => setNewEmployee({ ...newEmployee, sub_department: e.target.value }) }, subDepartments.map((subDepartment) => React.createElement("option", { key: subDepartment }, subDepartment))),
                        React.createElement("input", { placeholder: "Role", value: newEmployee.role, onChange: (e) => setNewEmployee({ ...newEmployee, role: e.target.value }) }),
                        React.createElement("input", { type: "time", value: newEmployee.shift_start, onChange: (e) => setNewEmployee({ ...newEmployee, shift_start: e.target.value }) }),
                        React.createElement("input", { type: "time", value: newEmployee.shift_end, onChange: (e) => setNewEmployee({ ...newEmployee, shift_end: e.target.value }) }),
                        React.createElement("input", { placeholder: "Off days, example: Saturday, Sunday", value: newEmployee.off_days, onChange: (e) => setNewEmployee({ ...newEmployee, off_days: e.target.value }) }),
                        React.createElement("button", { className: "primary wide", onClick: saveEmployee }, "Save employee"))))),
            !isAgentOnly && tab === "schedule" && (React.createElement("section", { className: "schedulePage" },
                React.createElement(Card, { title: "Employee schedule management" },
                    React.createElement("p", { className: "helperText" }, "Edit each employee\u2019s assigned shift, break, lunch, second break, off days, LOB, department, and sub-department. Updates are reflected in the Agent Portal, reporting, payroll review, staffing rules, and Google Sheets when live sync is connected."),
                    React.createElement(Table, { headers: ["Employee", "LOB", "Department", "Sub-Department", "Off Days", "Today", "Shift Start", "Shift End", "Break 1", "Lunch", "Break 2", "Break Min", "Lunch Min"], rows: filteredVisibleEmployees.map((e) => [
                            React.createElement("strong", null, e.full_name),
                            React.createElement("select", { value: e.lob, onChange: (event) => updateEmployeeSchedule(e.id, "lob", event.target.value) }, lobs.map((lob) => React.createElement("option", { key: lob }, lob))),
                            React.createElement("select", { value: e.department, onChange: (event) => updateEmployeeSchedule(e.id, "department", event.target.value) }, departments.map((department) => React.createElement("option", { key: department }, department))),
                            React.createElement("select", { value: e.sub_department || "", onChange: (event) => updateEmployeeSchedule(e.id, "sub_department", event.target.value) }, subDepartments.map((subDepartment) => React.createElement("option", { key: subDepartment }, subDepartment))),
                            React.createElement("input", { value: e.off_days || "", onChange: (event) => updateEmployeeSchedule(e.id, "off_days", event.target.value), placeholder: "Saturday, Sunday" }),
                            React.createElement(Badge, { danger: isTodayOffDay(e), muted: !isTodayOffDay(e) }, isTodayOffDay(e) ? "Off Today" : "Scheduled"),
                            React.createElement("input", { type: "time", value: e.shift_start, disabled: !canEditSchedules(selectedEmployee?.access_level || selectedEmployee?.role || "Agent"), onChange: (event) => updateEmployeeSchedule(e.id, "shift_start", event.target.value) }),
                            React.createElement("input", { type: "time", value: e.shift_end, disabled: !canEditSchedules(selectedEmployee?.access_level || selectedEmployee?.role || "Agent"), onChange: (event) => updateEmployeeSchedule(e.id, "shift_end", event.target.value) }),
                            React.createElement("div", { className: "miniTimes" },
                                React.createElement("input", { type: "time", value: e.break_start, onChange: (event) => updateEmployeeSchedule(e.id, "break_start", event.target.value) }),
                                React.createElement("input", { type: "time", value: e.break_end, onChange: (event) => updateEmployeeSchedule(e.id, "break_end", event.target.value) })),
                            React.createElement("div", { className: "miniTimes" },
                                React.createElement("input", { type: "time", value: e.lunch_start, onChange: (event) => updateEmployeeSchedule(e.id, "lunch_start", event.target.value) }),
                                React.createElement("input", { type: "time", value: e.lunch_end, onChange: (event) => updateEmployeeSchedule(e.id, "lunch_end", event.target.value) })),
                            React.createElement("div", { className: "miniTimes" },
                                React.createElement("input", { type: "time", value: e.second_break_start, onChange: (event) => updateEmployeeSchedule(e.id, "second_break_start", event.target.value) }),
                                React.createElement("input", { type: "time", value: e.second_break_end, onChange: (event) => updateEmployeeSchedule(e.id, "second_break_end", event.target.value) })),
                            `${e.break_minutes} min`,
                            `${e.lunch_minutes} min`,
                        ]) })))),
            !isAgentOnly && tab === "time" && (React.createElement("section", { className: "grid split reverse" },
                React.createElement(Card, { title: "Manager / TL editable time log" },
                    React.createElement("p", { className: "helperText" }, "Managers and TLs can add new time entries and edit previous time logs for agents. Each saved correction is retained in the approval/audit trail."),
                    React.createElement(FormGrid, null,
                        React.createElement("select", { value: selectedEmployeeId, onChange: (e) => setSelectedEmployeeId(e.target.value) }, filteredVisibleEmployees.map((e) => React.createElement("option", { key: e.id, value: e.id }, e.full_name))),
                        React.createElement("select", { value: newTime.category, onChange: (e) => setNewTime({ ...newTime, category: e.target.value }) },
                            React.createElement(TimeCategoryOptions, null)),
                        React.createElement("input", { type: "time", value: newTime.category_start, onChange: (e) => setNewTime({ ...newTime, category_start: e.target.value }) }),
                        React.createElement("input", { type: "time", value: newTime.category_end, onChange: (e) => setNewTime({ ...newTime, category_end: e.target.value }) }),
                        React.createElement("input", { placeholder: "Notes", value: newTime.notes, onChange: (e) => setNewTime({ ...newTime, notes: e.target.value }) }),
                        React.createElement("button", { className: "primary wide", onClick: saveTime }, "Add time entry"))),
                React.createElement(Card, { title: "Editable previous time logs" },
                    React.createElement("p", { className: "helperText" }, "Use this table to correct historical clock-in/out, category, approval, payable status, or notes. Select Save on the corrected row to persist the update."),
                    React.createElement(Table, { headers: ["Employee", "Date", "LOB", "Category", "Start", "End", "Duration", "Approval", "Payable", "Notes", "Save"], rows: filteredTime.map((t) => [
                            React.createElement("strong", null, t.employee_name),
                            React.createElement("input", { type: "date", value: t.date || today, onChange: (event) => editTimeEntryLocal(t.id, "date", event.target.value) }),
                            t.lob,
                            React.createElement("select", { value: t.category, onChange: (event) => editTimeEntryLocal(t.id, "category", event.target.value) },
                                React.createElement(TimeCategoryOptions, null)),
                            React.createElement("input", { type: "time", value: formatMilitaryTime(t.category_start), onChange: (event) => editTimeEntryLocal(t.id, "category_start", event.target.value) }),
                            React.createElement("input", { type: "time", value: formatMilitaryTime(t.category_end), onChange: (event) => editTimeEntryLocal(t.id, "category_end", event.target.value) }),
                            formatHours(minutesBetween(t.category_start, t.category_end)),
                            React.createElement("select", { value: t.approved || "Pending", onChange: (event) => editTimeEntryLocal(t.id, "approved", event.target.value) }, ["Pending", "Pending Approval", "Approved", "Denied", "Auto Logged"].map((status) => React.createElement("option", { key: status }, status))),
                            React.createElement("input", { value: t.payable_status || "Regular", onChange: (event) => editTimeEntryLocal(t.id, "payable_status", event.target.value) }),
                            React.createElement("input", { value: t.notes || "", onChange: (event) => editTimeEntryLocal(t.id, "notes", event.target.value), placeholder: "Correction notes" }),
                            React.createElement("button", { className: "primary", onClick: () => saveEditedTimeEntry(t.id) }, "Save"),
                        ]) })))),
            !isAgentOnly && tab === "requests" && (React.createElement("section", { className: "requestsLayout" },
                React.createElement(Card, { title: "Submit PTO / VTO / leave" },
                    React.createElement("p", { className: "helperText" }, "PTO, VTO, and sick requests are approved in full days. Select the start and end dates and the app calculates the number of requested days automatically."),
                    React.createElement(FormGrid, null,
                        React.createElement("select", { value: selectedEmployeeId, onChange: (e) => setSelectedEmployeeId(e.target.value) }, filteredVisibleEmployees.map((e) => React.createElement("option", { key: e.id, value: e.id }, e.full_name))),
                        React.createElement("select", { value: newRequest.type, onChange: (e) => setNewRequest({ ...newRequest, type: e.target.value }) }, ["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave"].map((x) => React.createElement("option", { key: x, disabled: x === "Overtime" && !OT_REQUESTS_ENABLED }, x === "Overtime" && !OT_REQUESTS_ENABLED ? "Overtime Request (Disabled)" : x))),
                        React.createElement("input", { type: "date", value: newRequest.start_date, onChange: (e) => setNewRequest({ ...newRequest, start_date: e.target.value }) }),
                        React.createElement("input", { type: "date", value: newRequest.end_date, onChange: (e) => setNewRequest({ ...newRequest, end_date: e.target.value }) }),
                        React.createElement("input", { type: "number", min: "0", step: "0.25", title: "Requests are now approved in full days.", value: newRequest.start_date !== newRequest.end_date ? calculateRequestHours(newRequest) : newRequest.hours, disabled: true, onChange: (e) => setNewRequest({ ...newRequest, hours: e.target.value }) }),
                        React.createElement("input", { placeholder: "Reason", value: newRequest.reason, onChange: (e) => setNewRequest({ ...newRequest, reason: e.target.value }) }),
                        React.createElement("button", { className: "primary wide", onClick: saveRequest }, "Submit request"))),
                React.createElement(Card, { title: "PTO / VTO Capacity Calendar" },
                    React.createElement("p", { className: "helperText" }, "Visual planning only. Use the current LOB, department, sub-department, country, employee, and date-range filters to review staffing capacity before approving PTO, VTO, or Sick Leave. This calendar does not create or update requests."),
                    React.createElement(FormGrid, null,
                        React.createElement(Field, { label: "Calendar Start" },
                            React.createElement("input", { type: "date", value: requestCalendarDate, onChange: (e) => { setRequestCalendarDate(e.target.value); setSelectedCapacityDate(e.target.value); } })),
                        React.createElement(Field, { label: "Calendar End" },
                            React.createElement("input", { type: "date", value: requestCalendarEndDate, onChange: (e) => setRequestCalendarEndDate(e.target.value) })),
                        React.createElement("div", { className: "calendarReadOnlyNote" }, "Read-only planning view · up to 31 days shown")),
                    React.createElement("div", { className: "requestCapacityGrid" },
                        React.createElement(Info, { label: "Scheduled Agents", value: getRequestCapacityForDate(selectedCapacityDate).scheduledAgents }),
                        React.createElement(Info, { label: "Off Day Agents", value: getRequestCapacityForDate(selectedCapacityDate).offDayAgents }),
                        React.createElement(Info, { label: "Approved PTO", value: getRequestCapacityForDate(selectedCapacityDate).ptoAgents }),
                        React.createElement(Info, { label: "Approved VTO", value: getRequestCapacityForDate(selectedCapacityDate).vtoAgents }),
                        React.createElement(Info, { label: "Approved Sick", value: getRequestCapacityForDate(selectedCapacityDate).sickAgents }),
                        React.createElement(Info, { label: "Pending Requests", value: getRequestCapacityForDate(selectedCapacityDate).pending }),
                        React.createElement(Info, { label: "Rule Limit", value: getRequestCapacityForDate(selectedCapacityDate).capacityLimit || "No limit" }),
                        React.createElement(Info, { label: "Available Slots", value: getRequestCapacityForDate(selectedCapacityDate).availableSlots })),
                    React.createElement("div", { className: "capacityCalendar monthly" }, getRequestCalendarAlternatives().map((day) => React.createElement("button", { key: day.date, type: "button", className: `calendarDay ${day.isOpen ? "open" : "closed"} ${day.date === selectedCapacityDate ? "selected" : ""}`, onClick: () => setSelectedCapacityDate(day.date), title: "Select date for planning summary only" },
                        React.createElement("strong", null, day.date),
                        React.createElement("span", null, day.isOpen ? "Open" : "At capacity"),
                        React.createElement("small", null, `Scheduled ${day.scheduledAgents} · Off ${day.offDayAgents}`),
                        React.createElement("small", null, `PTO ${day.ptoAgents} · VTO ${day.vtoAgents} · Sick ${day.sickAgents} · Pending ${day.pending}`))))),
                React.createElement(Card, { title: "Request history" },
                    React.createElement("p", { className: "helperText" }, "Full request visibility using the current filters. Use horizontal scroll if needed."),
                    React.createElement(Table, { headers: ["Employee", "Type", "Start", "End", "Days", "Current", "After", "Status", "Manager", "Reason"], rows: filteredRequests.map((r) => [r.employee_name, r.type, formatDateOnly(r.start_date), formatDateOnly(r.end_date), Number(r.requested_days || r.hours / 8).toFixed(1), r.current_balance ?? "N/A", r.projected_balance ?? "N/A", React.createElement(Badge, null, r.status), r.manager || "N/A", r.reason || ""] ) })))),
            !isAgentOnly && tab === "manager" && (React.createElement("section", { className: "grid two" },
                React.createElement(Card, { title: "Approvals Queue - Time-Off & Schedule Requests" },
                    React.createElement("p", { className: "helperText" }, "Use this queue for requests submitted by employees, including PTO, VTO, Sick Leave, Paid Leave, Unpaid Leave, and OT requests submitted as a formal request. Approval updates the Requests tab, creates an Approvals audit record, and deducts balances when applicable."),
                    requests.filter((r) => ["Pending", "Pending Manager Approval"].includes(r.status)).length ? requests.filter((r) => ["Pending", "Pending Manager Approval"].includes(r.status)).map((r) => React.createElement(Approval, { key: r.id, title: r.employee_name, detail: `${r.type} · ${formatDateOnly(r.start_date)} to ${formatDateOnly(r.end_date)} · ${r.hours}h / ${Number(r.requested_days || r.hours / 8).toFixed(1)} days · Current: ${r.current_balance ?? "N/A"}h · After: ${r.projected_balance ?? "N/A"}h`, approve: () => setRequestStatus(r.id, "Approved"), deny: () => setRequestStatus(r.id, "Denied") })) : React.createElement("p", { className: "muted" }, "No pending employee requests at this time.")),
                React.createElement(Card, { title: "Time Log / Overtime Exception Data Backed Up" },
                    React.createElement("p", { className: "helperText" }, "The previous time log and overtime exception approval rule has been removed from this approval view. Time log and overtime records are still retained in Time Logs, payroll review, reporting, and archive/export data for audit purposes."),
                    React.createElement(Table, { headers: ["Employee", "Category", "Date", "Status", "Backup"], rows: timeEntries.filter((t) => t.approved === "Pending").slice(0, 8).map((t) => [t.employee_name, t.category, formatDateOnly(t.date), t.approved, "Retained"]) })))),
            !isAgentOnly && tab === "payroll" && (React.createElement(Card, { title: "Payroll review" },
                React.createElement(Table, { headers: ["Employee", "Country", "Holiday", "Scheduled", "Clock In/Out", "Late", "Worked", "OT", "Status"], rows: filteredTime.map((t) => { const employee = employees.find((e) => e.id === t.employee_id); const holiday = isHolidayForCountry(employee?.country, t.date); const late = Math.max(0, minutesBetween(t.scheduled_start, t.clock_in)); const worked = minutesBetween(t.clock_in, t.clock_out); const ot = t.category === "Overtime" ? minutesBetween(t.category_start, t.category_end) : Math.max(0, minutesBetween(t.scheduled_end, t.clock_out)); return [t.employee_name, employee?.country || "N/A", holiday ? React.createElement(Badge, { danger: true }, holiday.holiday_name) : React.createElement(Badge, { muted: true }, "No Holiday"), formatTimeRange(t.scheduled_start, t.scheduled_end), formatTimeRange(t.clock_in, t.clock_out), `${late} min`, formatHours(worked), formatHours(ot), React.createElement(Badge, { danger: late > 0 }, late > 0 ? "Late" : "On Time")]; }) }))),
            !isAgentOnly && tab === "reporting" && (React.createElement("section", { className: "reportingPage" },
                React.createElement("div", { className: "reportHeader" },
                    React.createElement("div", null,
                        React.createElement("h2", null, "Admin Reporting Center"),
                        React.createElement("p", null, "Review productivity, break/lunch adherence, overtime, requests, and schedule adherence by LOB, department, and agent.")),
                    React.createElement("div", { className: "reportControls" },
                        React.createElement("select", { value: reportView, onChange: (e) => setReportView(e.target.value) },
                            React.createElement("option", null, "LOB"),
                            React.createElement("option", null, "Department")),
                        React.createElement("button", { onClick: exportReportingCsv },
                            React.createElement(Download, { size: 16 }),
                            " Export Summary CSV"))),
                React.createElement("section", { className: "reportGrid" }, reportingSummary.map((group) => (React.createElement("div", { className: "reportCard", key: group.groupName },
                    React.createElement("div", { className: "reportCardHead" },
                        React.createElement("div", null,
                            React.createElement("span", null, reportView),
                            React.createElement("strong", null, group.groupName)),
                        React.createElement(Badge, { danger: group.adherenceRisk }, group.adherenceRisk ? "Review" : "Healthy")),
                    React.createElement("div", { className: "reportMiniGrid" },
                        React.createElement(Info, { label: "Headcount", value: group.headcount }),
                        React.createElement(Info, { label: "Productivity", value: `${group.productivity}%` }),
                        React.createElement(Info, { label: "Break/Lunch Used", value: formatMinutes(group.breakMinutes) }),
                        React.createElement(Info, { label: "Scheduled Break/Lunch", value: formatMinutes(group.scheduledBreakLunch) }),
                        React.createElement(Info, { label: "Overtime", value: formatHours(group.otMinutes) }),
                        React.createElement(Info, { label: "Pending Requests", value: group.pendingRequests })),
                    React.createElement(Progress, { label: "Working Time", value: formatHours(group.workingMinutes), percent: group.totalMinutes ? (group.workingMinutes / group.totalMinutes) * 100 : 0 }),
                    React.createElement(Progress, { label: "Break/Lunch/Bathroom", value: formatHours(group.breakMinutes), percent: group.totalMinutes ? (group.breakMinutes / group.totalMinutes) * 100 : 0 }),
                    React.createElement(Progress, { label: "Overtime", value: formatHours(group.otMinutes), percent: group.totalMinutes ? (group.otMinutes / group.totalMinutes) * 100 : 0 }))))),
                React.createElement("section", { className: "grid two" },
                    React.createElement(Card, { title: "Agent-level adherence detail" },
                        React.createElement(Table, { headers: ["Employee", "LOB", "Department", "Sub-Department", "Productivity", "Late", "Break Used", "Scheduled Break", "Variance", "OT"], rows: agentReporting.map((e) => [e.full_name, e.lob, e.department, e.sub_department || "N/A", `${e.productivity}%`, formatMinutes(e.lateMinutes), formatMinutes(e.breakMinutes), formatMinutes(e.scheduledBreakLunch), React.createElement(Badge, { danger: e.variance > 0, muted: e.variance <= 0 },
                                    e.variance > 0 ? "+" : "",
                                    formatMinutes(e.variance)), formatHours(e.otMinutes)]) })),
                    React.createElement(Card, { title: "Overall time productivity" },
                        React.createElement("div", { className: "productivityHelp" },
                            React.createElement("strong", null, "How productivity is calculated"),
                            React.createElement("p", null, "Productivity % = Working Time \u00F7 Total Tracked Time \u00D7 100. Break, lunch, bathroom, training, meetings, system issues, and other non-working dispositions reduce the percentage. Working time and approved overtime count as productive time.")),
                        categoryStats.map((item) => React.createElement(Progress, { key: item.label, label: item.label, value: formatHours(item.minutes), percent: stats.total ? (item.minutes / stats.total) * 100 : 0 })),
                        React.createElement("div", { className: "reportNote" }, "Use this view to compare scheduled expectations against actual logged time by LOB, department, and agent. This helps review breaks, lunch, bathroom time, meetings, training, system issues, OT, and productivity."))))),
            !isAgentOnly && tab === "rules" && (React.createElement("section", { className: "rulesPage" },
                React.createElement("section", { className: "grid two" },
                    React.createElement(Card, { title: "Manage LOBs" },
                        React.createElement("p", { className: "helperText" }, "Add or remove Lines of Business so managers can assign employees, reports, and staffing rules without editing the code."),
                        React.createElement("div", { className: "inlineForm" },
                            React.createElement("input", { placeholder: "Example: GoDay, Lending Creative, New Client", value: newLob, onChange: (e) => setNewLob(e.target.value) }),
                            React.createElement("button", { className: "primary", onClick: addLob }, "Add LOB")),
                        React.createElement("div", { className: "chipList" }, lobs.map((lob) => React.createElement("span", { className: "chip", key: lob },
                            lob,
                            React.createElement("button", { onClick: () => deleteLob(lob) }, "\u00D7"))))),
                    React.createElement(Card, { title: "Manage Departments" },
                        React.createElement("p", { className: "helperText" }, "Add departments used for scheduling, reporting, PTO/VTO limits, and payroll tracking."),
                        React.createElement("div", { className: "inlineForm" },
                            React.createElement("input", { placeholder: "Example: Operations, QA, Training, HR", value: newDepartment, onChange: (e) => setNewDepartment(e.target.value) }),
                            React.createElement("button", { className: "primary", onClick: addDepartment }, "Add Department")),
                        React.createElement("div", { className: "chipList" }, departments.map((department) => React.createElement("span", { className: "chip", key: department },
                            department,
                            React.createElement("button", { onClick: () => deleteDepartment(department) }, "\u00D7"))))),
                    React.createElement(Card, { title: "Manage Operations Sub-Departments" },
                        React.createElement("p", { className: "helperText" }, "Use sub-departments to filter agents within Operations, such as Customer Service, Collections, CLS, Documents, and SME."),
                        React.createElement("div", { className: "inlineForm" },
                            React.createElement("input", { placeholder: "Example: CLS, Documents, SME", onKeyDown: (e) => { if (e.key === "Enter") {
                                    addSubDepartment(e.currentTarget.value);
                                    e.currentTarget.value = "";
                                } } }),
                            React.createElement("button", { className: "primary", onClick: (e) => { const input = e.currentTarget.parentElement.querySelector("input"); addSubDepartment(input.value); input.value = ""; } }, "Add Sub-Department")),
                        React.createElement("div", { className: "chipList" }, subDepartments.map((subDepartment) => React.createElement("span", { className: "chip", key: subDepartment },
                            subDepartment,
                            React.createElement("button", { onClick: () => deleteSubDepartment(subDepartment) }, "\u00D7")))))),
                React.createElement(Card, { title: "Attendance Email Automation Settings" },
                    React.createElement("p", { className: "helperText" }, "Attendance emails are queued in Google Sheets when time is logged. Apps Script should send rows from emailQueue where Status is Pending Send. This avoids sending emails directly from the React app."),
                    React.createElement("div", { className: "describedForm" },
                        React.createElement(DescribedField, { title: "Enable Attendance Emails", description: "When enabled, the app creates emailQueue rows after attendance/time logs are saved." },
                            React.createElement("select", { value: attendanceEmailSettings.enabled ? "Enabled" : "Disabled", onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, enabled: e.target.value === "Enabled" }) },
                                React.createElement("option", null, "Enabled"),
                                React.createElement("option", null, "Disabled"))),
                        React.createElement(DescribedField, { title: "Delivery Mode", description: "Daily Summary is recommended to avoid manager email spam. The queue row is created and Apps Script handles the send process." },
                            React.createElement("select", { value: attendanceEmailSettings.deliveryMode, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, deliveryMode: e.target.value }) },
                                React.createElement("option", null, "Daily Summary"),
                                React.createElement("option", null, "First Log Alert"),
                                React.createElement("option", null, "Manual Review Only"))),
                        React.createElement(DescribedField, { title: "Daily Send Time", description: "Recommended daily send time for Apps Script processing of pending attendance reports." },
                            React.createElement("input", { type: "time", value: attendanceEmailSettings.sendTime, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, sendTime: e.target.value }) })),
                        React.createElement(DescribedField, { title: "Recipient Groups", description: "Choose who receives attendance summaries. Manager and TL use each employee profile fields." },
                            React.createElement("div", { className: "checkboxGrid" },
                                React.createElement("label", null,
                                    React.createElement("input", { type: "checkbox", checked: attendanceEmailSettings.includeManager, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeManager: e.target.checked }) }),
                                    " Manager"),
                                React.createElement("label", null,
                                    React.createElement("input", { type: "checkbox", checked: attendanceEmailSettings.includeSupervisor, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeSupervisor: e.target.checked }) }),
                                    " TL / Supervisor"),
                                React.createElement("label", null,
                                    React.createElement("input", { type: "checkbox", checked: attendanceEmailSettings.includeHrWfm, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, includeHrWfm: e.target.checked }) }),
                                    " HR / WFM"))),
                        React.createElement(DescribedField, { title: "HR / WFM Emails", description: "Optional extra recipients. Separate multiple emails with comma or semicolon." },
                            React.createElement("input", { placeholder: "wfm@company.com, hr@company.com", value: attendanceEmailSettings.hrWfmEmails, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, hrWfmEmails: e.target.value }) })),
                        React.createElement(DescribedField, { title: "LOB Filter", description: "Limit automation to one LOB or keep All enabled." },
                            React.createElement("select", { value: attendanceEmailSettings.lobFilter, onChange: (e) => setAttendanceEmailSettings({ ...attendanceEmailSettings, lobFilter: e.target.value }) },
                                React.createElement("option", null, "All"),
                                lobs.map((lob) => React.createElement("option", { key: lob }, lob))))),
                    React.createElement("div", { className: "emailAutomationSummary" },
                        React.createElement("strong", null, "Current setup:"),
                        " ",
                        attendanceEmailSettings.enabled ? "Enabled" : "Disabled",
                        " \u00B7 ",
                        attendanceEmailSettings.deliveryMode,
                        " \u00B7 Send time ",
                        attendanceEmailSettings.sendTime,
                        " \u00B7 Recipients: ",
                        attendanceEmailSettings.includeManager ? "Manager " : "",
                        attendanceEmailSettings.includeSupervisor ? "TL/Supervisor " : "",
                        attendanceEmailSettings.includeHrWfm ? "HR/WFM" : ""),
                    React.createElement("button", { className: "primary wide", onClick: queueAttendanceTestEmail }, "Queue Test Attendance Email")),
                React.createElement("section", { className: "grid split reverse" },
                    React.createElement(Card, { title: "Editable staffing rule engine" },
                        React.createElement("div", { className: "ruleGuide" },
                            React.createElement("h3", null, "Rule setup instructions"),
                            React.createElement("p", null, "Complete each field below to control how many employees can be approved out of a specific LOB, department, and shift. These rules help managers avoid approving too many PTO, VTO, or sick leave requests when coverage is needed.")),
                        React.createElement("div", { className: "describedForm" },
                            React.createElement(DescribedField, { title: "LOB", description: "Line of Business this rule applies to, such as GoDay or Lending Creative." },
                                React.createElement("select", { value: newRule.lob, onChange: (e) => setNewRule({ ...newRule, lob: e.target.value }) }, lobs.map((lob) => React.createElement("option", { key: lob }, lob)))),
                            React.createElement(DescribedField, { title: "Department", description: "Department or team covered by this staffing rule." },
                                React.createElement("select", { value: newRule.department, onChange: (e) => setNewRule({ ...newRule, department: e.target.value }) }, departments.map((department) => React.createElement("option", { key: department }, department)))),
                            React.createElement(DescribedField, { title: "Shift Start", description: "The beginning of the scheduled shift block this rule controls." },
                                React.createElement("input", { type: "time", value: newRule.shift_start, onChange: (e) => setNewRule({ ...newRule, shift_start: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Shift End", description: "The end of the scheduled shift block this rule controls." },
                                React.createElement("input", { type: "time", value: newRule.shift_end, onChange: (e) => setNewRule({ ...newRule, shift_end: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Rule Start Date", description: "When this staffing rule becomes active for planning." },
                                React.createElement("input", { type: "date", value: newRule.start_date, onChange: (e) => setNewRule({ ...newRule, start_date: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Rule End Date", description: "Optional expiration date. Leave blank for ongoing rules." },
                                React.createElement("input", { type: "date", value: newRule.end_date, onChange: (e) => setNewRule({ ...newRule, end_date: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Repeat Frequency", description: "Planning frequency for this rule." },
                                React.createElement("select", { value: newRule.recurrence, onChange: (e) => setNewRule({ ...newRule, recurrence: e.target.value }) }, ["None", "Daily", "Weekly", "Monthly", "Seasonal"].map((x) => React.createElement("option", { key: x }, x)))),
                            React.createElement(DescribedField, { title: "Max PTO Out", description: "Maximum employees who can be approved for PTO during this shift." },
                                React.createElement("input", { type: "number", value: newRule.max_pto_out, onChange: (e) => setNewRule({ ...newRule, max_pto_out: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Max VTO Out", description: "Maximum employees who can be released early or off as VTO during this shift." },
                                React.createElement("input", { type: "number", value: newRule.max_vto_out, onChange: (e) => setNewRule({ ...newRule, max_vto_out: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Max Sick Out", description: "Coverage threshold for sick leave. If exceeded, the rule flags a staffing risk." },
                                React.createElement("input", { type: "number", value: newRule.max_sick_out, onChange: (e) => setNewRule({ ...newRule, max_sick_out: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Minimum Staff Required", description: "Minimum employees that must remain available after all approvals." },
                                React.createElement("input", { type: "number", value: newRule.min_staff_required, onChange: (e) => setNewRule({ ...newRule, min_staff_required: e.target.value }) })),
                            React.createElement(DescribedField, { title: "Notes", description: "Optional business context, exception instructions, or manager notes." },
                                React.createElement("input", { value: newRule.notes, onChange: (e) => setNewRule({ ...newRule, notes: e.target.value }) }))),
                        React.createElement("button", { className: "primary wide", onClick: saveRule }, "Save Staffing Rule")),
                    React.createElement(Card, { title: "Current coverage rules and usage" },
                        React.createElement(Table, { headers: ["LOB", "Department", "Shift", "Effective Dates", "Repeat", "Scheduled", "Approved Out", "Available", "Limits", "Status", "Action"], rows: rules.map((rule) => {
                                const usage = getRuleUsage(rule);
                                const exceeds = usage.pto > rule.max_pto_out || usage.vto > rule.max_vto_out || usage.sick > rule.max_sick_out || usage.available < rule.min_staff_required;
                                return [rule.lob, rule.department, formatTimeRange(rule.shift_start, rule.shift_end), `${formatDateOnly(rule.start_date || today)}${rule.end_date ? ` to ${formatDateOnly(rule.end_date)}` : " onward"}`, rule.recurrence || "Daily", usage.scheduled, usage.out, usage.available, `PTO ${usage.pto}/${rule.max_pto_out} · VTO ${usage.vto}/${rule.max_vto_out} · Sick ${usage.sick}/${rule.max_sick_out} · Min ${rule.min_staff_required}`, React.createElement(Badge, { danger: exceeds }, exceeds ? "Risk" : "Within Rule"), React.createElement("button", { onClick: () => deleteRule(rule.id) }, "Delete")];
                            }) })))))),
        processingModal && React.createElement(ProcessingOverlay, { status: processingModal.status, title: processingModal.title, message: processingModal.message }),
        managerOverrideModal && (React.createElement(ManagerOverrideModal, { title: managerOverrideModal.title, message: managerOverrideModal.message, onCancel: () => resolveManagerOverride(false), onConfirm: () => resolveManagerOverride(true) })),
        toast && React.createElement(Toast, { toast: toast, onClose: () => setToast(null) })));
}
export default function App() {
    return (React.createElement(AppErrorBoundary, null,
        React.createElement(HRWorkforceApp, null)));
}
function LoginScreen({ logo, email, password, setEmail, setPassword, onLogin, onForgotPassword, error, resetNotice, passwordResetUser, newPersonalPassword, confirmPersonalPassword, setNewPersonalPassword, setConfirmPersonalPassword, onCompletePasswordReset, databaseStatus, demoAccounts = [] }) {
    return (React.createElement("div", { className: "loginPage" },
        React.createElement("style", null, styles),
        React.createElement("section", { className: "loginCard" },
            React.createElement("div", { className: "loginBrand" },
                React.createElement("img", { src: logo, alt: "Magnemite.app" }),
                React.createElement("div", null,
                    React.createElement("strong", null, "Magnemite"),
                    React.createElement("span", null, "Workforce Management Made Simple"))),
            React.createElement("h1", null, passwordResetUser ? "Create your password" : "Sign in"),
            React.createElement("p", null, "Access your HR portal, time tracking, PTO/VTO requests, approvals, payroll review, and reporting according to your assigned role."),
            !passwordResetUser ? (React.createElement("div", { className: "loginForm" },
                React.createElement("label", null,
                    "Email",
                    React.createElement("input", { value: email, onChange: (e) => setEmail(e.target.value), placeholder: "name@goday.ca" })),
                React.createElement("label", null,
                    "Password",
                    React.createElement("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter password", onKeyDown: (e) => e.key === "Enter" && onLogin() })),
                error && React.createElement("div", { className: "loginError" }, error),
                resetNotice && React.createElement("div", { className: "loginSuccess" }, resetNotice),
                React.createElement("button", { className: "primary wide", onClick: onLogin }, "Login"),
                React.createElement("button", { type: "button", className: "linkButton wide", onClick: onForgotPassword }, "Forgot my password? Send temporary password email"))) : (React.createElement("div", { className: "loginForm" },
                React.createElement("div", { className: "loginSuccess" },
                    "Temporary password accepted for ",
                    passwordResetUser.full_name,
                    ". Please create your personalized password."),
                React.createElement("label", null,
                    "New personalized password",
                    React.createElement("input", { type: "password", value: newPersonalPassword, onChange: (e) => setNewPersonalPassword(e.target.value), placeholder: "Create new password" })),
                React.createElement("label", null,
                    "Confirm personalized password",
                    React.createElement("input", { type: "password", value: confirmPersonalPassword, onChange: (e) => setConfirmPersonalPassword(e.target.value), placeholder: "Confirm new password", onKeyDown: (e) => e.key === "Enter" && onCompletePasswordReset() })),
                error && React.createElement("div", { className: "loginError" }, error),
                React.createElement("button", { className: "primary wide", onClick: onCompletePasswordReset }, "Save Password and Continue"))),
            React.createElement("div", { className: "loginNote" },
                React.createElement("strong", null, "Access is role-based."),
                React.createElement("span", null, "Employees see only their own portal. TL, Manager, HR, Payroll, Admin, and Executive users can access admin areas based on their profile. New users use Welcome2026! as a temporary password and must create a personalized password on first login.")),
            React.createElement("div", { className: "syncBox loginSync" },
                React.createElement(Database, { size: 16 }),
                React.createElement("span", null, databaseStatus)),
            React.createElement(DeveloperMark, null))));
}
function DeveloperMark({ sidebar = false }) {
    return (React.createElement("div", { className: sidebar ? "developerMark sidebarMark" : "developerMark" }, "Developed by M.P."));
}
function Toast({ toast, onClose }) {
    return (React.createElement("div", { className: `toast ${toast.type || "success"}` },
        React.createElement("div", { className: "toastIcon" }, toast.type === "danger" ? "!" : toast.type === "warning" ? "!" : "✓"),
        React.createElement("section", null,
            React.createElement("strong", null, toast.title),
            toast.message && React.createElement("span", null, toast.message)),
        React.createElement("button", { type: "button", onClick: onClose }, "\u00D7")));
}
function ProcessingOverlay({ status = "processing", title, message }) {
    const icon = status === "success" ? "✓" : status === "danger" ? "!" : status === "warning" ? "!" : "⏳";
    return (React.createElement("div", { className: "modalOverlay" },
        React.createElement("section", { className: `processingCard ${status}` },
            React.createElement("div", { className: "processingSpinner" }, icon),
            React.createElement("h2", null, title),
            React.createElement("p", null, message))));
}
function Field({ label, children }) { return React.createElement("label", { className: "field" },
    React.createElement("span", null, label),
    children); }
function Info({ label, value }) { return React.createElement("div", { className: "info" },
    React.createElement("span", null, label),
    React.createElement("strong", null, value)); }
function DescribedField({ title, description, children }) { return React.createElement("div", { className: "describedField" },
    React.createElement("div", null,
        React.createElement("strong", null, title),
        React.createElement("p", null, description)),
    children); }
function Metric({ icon: Icon, label, value, hint }) { return React.createElement("div", { className: "metric" },
    React.createElement("div", null,
        React.createElement(Icon, { size: 22 })),
    React.createElement("section", null,
        React.createElement("span", null, label),
        React.createElement("strong", null, value),
        React.createElement("p", null, hint))); }
function Card({ title, action, children }) { return React.createElement("section", { className: "card" },
    React.createElement("header", null,
        React.createElement("h2", null, title),
        action),
    children); }
function Table({ headers, rows }) { return React.createElement("div", { className: "table" },
    React.createElement("table", null,
        React.createElement("thead", null,
            React.createElement("tr", null, headers.map((h) => React.createElement("th", { key: h }, h)))),
        React.createElement("tbody", null, rows.map((row, i) => React.createElement("tr", { key: i }, row.map((cell, j) => React.createElement("td", { key: j }, cell))))))); }
function SearchBox({ value, onChange }) { return React.createElement("div", { className: "search" },
    React.createElement(Search, { size: 16 }),
    React.createElement("input", { value: value, onChange: (e) => onChange(e.target.value), placeholder: "Search..." })); }
function FormGrid({ children }) { return React.createElement("div", { className: "formGrid" }, children); }
function Badge({ children, muted, danger }) { return React.createElement("span", { className: `badge ${muted ? "muted" : ""} ${danger ? "danger" : ""}` }, children); }
function Progress({ label, value, percent }) { return React.createElement("div", { className: "progress" },
    React.createElement("div", null,
        React.createElement("span", null, label),
        React.createElement("strong", null, value)),
    React.createElement("i", null,
        React.createElement("b", { style: { width: `${Math.max(4, percent)}%` } }))); }
function Approval({ title, detail, approve, deny }) { return React.createElement("div", { className: "approval" },
    React.createElement("section", null,
        React.createElement("strong", null, title),
        React.createElement("span", null, detail)),
    React.createElement("div", null,
        React.createElement("button", { className: "approve", onClick: approve },
            React.createElement(CheckCircle, { size: 18 })),
        React.createElement("button", { className: "deny", onClick: deny },
            React.createElement(XCircle, { size: 18 })))); }
function getAgentLiveStatus(agent, statusLogs = [], approvals = []) {
    const todayKey = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);
    const agentKey = String(agent?.employee_id || agent?.id || agent?.email || "");
    const agentLogs = statusLogs
        .filter((log) => String(log.employee_id || log.employeeId || log.email || "") === agentKey &&
        String(log.date || todayKey).slice(0, 10) === todayKey)
        .sort((a, b) => {
        const aValue = String(a.category_start || a.time || "00:00");
        const bValue = String(b.category_start || b.time || "00:00");
        return bValue.localeCompare(aValue);
    });
    const approvedOverride = approvals.some((approval) => String(approval.employee_id || approval.employeeId || approval.email || "") === agentKey &&
        approval.status === "Approved" &&
        ["Schedule Override", "Schedule Change"].includes(approval.type) &&
        String(approval.date || approval.start_date || "").slice(0, 10) === todayKey);
    const latestStatus = agentLogs.find((log) => log.status || log.category || log.action) || agentLogs[0];
    const statusLabel = String(latestStatus?.status || latestStatus?.category || latestStatus?.action || "").trim();
    const statusUpper = statusLabel.toUpperCase();
    const duration = latestStatus ? minutesBetween(latestStatus.category_start || latestStatus.time || nowTime, latestStatus.category_end || nowTime) : 0;
    const getLogCategory = (log) => String(log.category || log.status || log.action || "").toUpperCase();
    const breakUsedToday = agentLogs
        .filter((log) => getLogCategory(log).includes("BREAK"))
        .reduce((sum, log) => sum + minutesBetween(log.category_start || log.time, log.category_end || nowTime), 0);
    const lunchUsedToday = agentLogs
        .filter((log) => getLogCategory(log).includes("LUNCH"))
        .reduce((sum, log) => sum + minutesBetween(log.category_start || log.time, log.category_end || nowTime), 0);
    const bathroomUsedToday = agentLogs
        .filter((log) => getLogCategory(log).includes("BATHROOM"))
        .reduce((sum, log) => sum + minutesBetween(log.category_start || log.time, log.category_end || nowTime), 0);
    const allowedBreak = safeNumber(agent.break_minutes, 30);
    const allowedLunch = safeNumber(agent.lunch_minutes, 60);
    const alertReasons = [];
    if (breakUsedToday > allowedBreak)
        alertReasons.push(`Break over by ${breakUsedToday - allowedBreak} min`);
    if (lunchUsedToday > allowedLunch)
        alertReasons.push(`Lunch over by ${lunchUsedToday - allowedLunch} min`);
    if (bathroomUsedToday > 30)
        alertReasons.push(`Bathroom ${bathroomUsedToday} min`);
    if (alertReasons.length) {
        return {
            label: statusLabel || "Review",
            type: "red alert",
            detail: alertReasons.join(" · "),
            isAlert: true,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    if (!latestStatus && !approvedOverride) {
        return {
            label: "NO ACTIVITY",
            type: "gray",
            detail: "Scheduled today · no activity logged",
            isAlert: false,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    if (["BREAK", "LUNCH", "MEETING", "BATHROOM", "TRAINING"].some((status) => statusUpper.includes(status))) {
        return {
            label: statusLabel,
            type: "yellow",
            detail: duration ? `${duration} min in current/last status` : "Away from production",
            isAlert: false,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    if (["WORKING", "AVAILABLE", "CALL", "PRODUCTION", "ACTIVE"].some((status) => statusUpper.includes(status))) {
        return {
            label: statusLabel,
            type: "green",
            detail: "In production",
            isAlert: false,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    if (["OFF-DAY UNSCHEDULED", "UNSCHEDULED", "EARLY UNSCHEDULED", "OVERTIME"].some((status) => statusUpper.includes(status)) && !approvedOverride) {
        return {
            label: statusLabel || "Requires review",
            type: "red",
            detail: "Requires manager review",
            isAlert: false,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    if (approvedOverride) {
        return {
            label: statusLabel || "WORKING",
            type: "green",
            detail: "Approved schedule override",
            isAlert: false,
            breakUsedToday,
            lunchUsedToday,
            bathroomUsedToday,
        };
    }
    return {
        label: statusLabel || "NO ACTIVITY",
        type: "gray",
        detail: latestStatus ? "No active production status" : "Scheduled today · no current status",
        isAlert: false,
        breakUsedToday,
        lunchUsedToday,
        bathroomUsedToday,
    };
}
function ActivityList({ activities }) {
    if (!activities.length)
        return React.createElement("p", { className: "muted" }, "No activity logged yet today.");
    return (React.createElement("div", { className: "activityList" }, activities.map((a) => (React.createElement("div", { className: "activityItem", key: a.id },
        React.createElement("div", null,
            React.createElement("span", null, "Action"),
            React.createElement("strong", null, a.action)),
        React.createElement("div", null,
            React.createElement("span", null, "Status"),
            React.createElement(Badge, { muted: true }, a.status)),
        React.createElement("div", null,
            React.createElement("span", null, "Time"),
            React.createElement("strong", null, formatMilitaryTime(a.time))),
        React.createElement("div", null,
            React.createElement("span", null, "Date"),
            React.createElement("strong", null, formatDateOnly(a.date))))))));
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
.loginSuccess { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 14px; padding: 10px 12px; font-size: 13px; line-height: 1.45; }
.linkButton { background: transparent; border: 1px solid var(--border); color: #0f766e; font-weight: 800; text-decoration: underline; box-shadow: none; }
.linkButton:hover { background: #f0fdf4; }
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
.topbar { background: linear-gradient(135deg, white, #edf8f2); border: 1px solid var(--border); border-radius: 26px; padding: 22px; display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; flex-wrap: wrap; box-shadow: 0 18px 40px rgba(4,120,87,.08); max-width: 100%; overflow: visible; }
.topbar > div:first-child { flex: 1 1 300px; min-width: 260px; }
.topbar .commandActions { flex: 0 1 auto; justify-content: flex-end; }
.topbar .filterPanel { flex: 1 0 100%; width: 100%; margin-top: 4px; order: 3; }
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
.syncNotice { margin-top: 18px; background: #ecfdf5; border: 1px solid #bbf7d0; color: #065f46; border-radius: 16px; padding: 12px 14px; font-size: 13px; line-height: 1.45; font-weight: 700; }
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
.trafficGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
.trafficCard { position: relative; border: 1px solid var(--border); border-radius: 12px; padding: 8px 9px 8px 24px; background: #f8fafc; display: grid; gap: 2px; min-height: 66px; align-content: center; }
.trafficCard strong { padding-left: 0; font-size: 12px; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trafficCard small, .trafficCard em { color: var(--muted); font-size: 10px; font-style: normal; line-height: 1.15; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trafficCard b { font-size: 10.5px; text-transform: uppercase; line-height: 1.15; }
.trafficDot { position: absolute; top: 11px; left: 9px; width: 9px; height: 9px; border-radius: 999px; background: #94a3b8; }
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
@media (max-width: 1120px) { .app { grid-template-columns: 1fr; } .sidebar { position: static; min-height: auto; height: auto; } .sidebar nav { grid-template-columns: repeat(3, 1fr); } .syncBox { margin-top: 0; } .topbar, .reportHeader { flex-direction: column; align-items: stretch; } .actions { justify-content: flex-start; } .filterPanel { grid-template-columns: repeat(2, 1fr); } .agentHero { flex-direction: column; align-items: stretch; } .agentGrid, .reportGrid { grid-template-columns: 1fr; } .balanceGrid, .reportMiniGrid { grid-template-columns: repeat(2, 1fr); } .profileGrid, .requestPreview { grid-template-columns: repeat(2, 1fr); } .metrics, .grid.two, .grid.split, .grid.split.reverse, .requestsLayout { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .topbar, .agentHero, .reportHeader { padding: 16px; } .metrics, .tabMetrics { grid-template-columns: 1fr; } .filterPanel { grid-template-columns: 1fr; } .approval { grid-template-columns: 1fr; } .approval div { display: flex; gap: 8px; } .activityItem { grid-template-columns: 1fr 1fr; } }
@media (max-width: 640px) { .demoAccounts > div { grid-template-columns: 1fr; } main, .sidebar { padding: 14px; } .filterPanel, .metrics, .profileGrid, .requestPreview, .reportMiniGrid, .inlineForm, .describedField, .activityItem { grid-template-columns: 1fr; } .currentStatus, .agentActions, .balanceGrid { grid-template-columns: 1fr; } .sidebar nav { grid-template-columns: 1fr; } .employeeFooter { flex-direction: column; align-items: flex-start; } .search { min-width: 0; width: 100%; } .card header { flex-direction: column; align-items: stretch; } }


.monthlyAttendanceBox { margin-top: 14px; padding: 14px; border: 1px solid #dceee7; border-radius: 16px; background: #f8fffc; }
.miniRequestList { display: grid; gap: 6px; margin-top: 10px; color: #546b61; font-size: 12px; }
.lobTrafficSplit { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 18px; align-items: start; }
.dashboardFloorSection { display: grid; gap: 18px; }
.largeFloorView { grid-template-columns: repeat(auto-fit, minmax(440px, 1fr)); }
.lobTrafficHeader { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 8px; }
.trafficGrid.production { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); max-height: none; overflow: visible; padding-right: 0; gap: 8px; }
.lobTrafficColumn { border: 1px solid #dceee7; border-radius: 18px; padding: 10px; background: #fbfffd; min-height: auto; }
.lobTrafficColumn h3 { margin: 0; color: #064a36; font-size: 14px; }
.trafficGrid.compact { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
.trafficGrid.production .badge { font-size: 10px; padding: 4px 8px; }
.trafficGrid.production + .muted { font-size: 11px; }

.requestCapacityGrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 12px 0; }
.capacityCalendar { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 12px; }
.capacityCalendar.monthly { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); max-height: 560px; overflow: auto; padding-right: 6px; }
.calendarDay { display: grid; gap: 4px; align-items: start; text-align: left; border-radius: 14px; padding: 12px; }
.calendarDay.open { border-color: #bbf7d0; background: #f0fdf4; }
.calendarDay.closed { border-color: #fecaca; background: #fef2f2; }
.calendarDay.selected { outline: 3px solid rgba(4,120,87,.25); }
.calendarDay span { font-weight: 900; color: var(--green); }
.calendarDay.closed span { color: #991b1b; }
.calendarDay small { color: var(--muted); line-height: 1.35; }
.trafficSummary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin: 6px 0 10px; }
.trafficSummary span { border: 1px solid #dceee7; border-radius: 999px; background: #f8fffc; color: #064a36; font-size: 10px; font-weight: 900; padding: 5px 7px; text-align: center; white-space: nowrap; }
.trafficSummary span.danger { background: #fee2e2; border-color: #fca5a5; color: #991b1b; animation: trafficAlert 2s infinite; }
.trafficCard.red.alert { background: #991b1b !important; color: white; border-color: #7f1d1d; box-shadow: 0 0 0 3px rgba(239,68,68,.22), 0 18px 40px rgba(153,27,27,.3); animation: trafficAlert 2s infinite; }
@keyframes trafficAlert { 0% { transform: scale(1); } 50% { transform: scale(1.025); } 100% { transform: scale(1); } }
.trafficCard.red.alert small, .trafficCard.red.alert em { color: #fee2e2; }
.filterPanel button { align-self: end; min-height: 42px; justify-content: center; }


.commandActions { width: 100%; justify-content: flex-end; flex-wrap: wrap; }
.actionUpload { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--border); border-radius: 999px; padding: 10px 14px; background: white; color: var(--dark); font-weight: 800; cursor: pointer; box-shadow: 0 10px 24px rgba(4,120,87,.06); }
.actionUpload input { display: none; }
.requestsLayout { margin-top: 18px; display: grid; grid-template-columns: minmax(320px, 420px) minmax(0, 2fr); gap: 18px; align-items: start; }
.requestsLayout .card:nth-child(3) { grid-column: 1 / -1; }
.requestsLayout .table table { min-width: 1160px; }
.requestsLayout .table th, .requestsLayout .table td { white-space: normal; vertical-align: top; }

.calendarReadOnlyNote { display: flex; align-items: center; justify-content: center; border: 1px dashed #b7d7ce; border-radius: 12px; color: #075f4f; background: #f2fbf7; font-weight: 800; min-height: 44px; }
`;
