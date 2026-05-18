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

// GOOGLE SHEETS LIVE DATABASE API
// Option 1: paste your working Apps Script URL here.
// Option 2: create .env and use VITE_GOOGLE_API_URL=your_url
const GOOGLE_API_URL =
  "https://script.google.com/a/macros/goday.ca/s/AKfycbyPzt5bsGY9z_4stWszBX1MQTSmuNSIJit5KP_NtzWu5RmWUSfSPMmM7a9rKqojsKNy/exec";
// TEMP LOGIN SIMULATION FOR MVP.
// Change CURRENT_USER_ACCESS_LEVEL to "Admin" to preview admin access.
// Later this will come from Supabase Auth + employee profile.
const CURRENT_USER_EMAIL = "agent1@goday.ca";
const CURRENT_USER_ACCESS_LEVEL = "Employee"; // Employee, TL, Manager, HR, Payroll, Admin, Executive

const lobSeed = ["GoDay", "Lending Creative"];
const departmentSeed = ["Operations", "Customer Service", "Collections", "QA", "Training", "Compliance", "HR", "Payroll"];

const employeesSeed = [
  {
    id: "EMP-001",
    full_name: "Sample Agent One",
    email: "agent1@goday.ca",
    country: "Costa Rica",
    department: "Operations",
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "Sample TL",
    manager: "Operations Manager",
    hire_date: "2024-03-15",
    birthday: "1995-06-12",
    employment_status: "Active",
    employment_type: "Full-Time",
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
  },
  {
    id: "EMP-002",
    full_name: "Sample Team Lead",
    email: "tl@goday.ca",
    country: "Canada",
    department: "Operations",
    lob: "Lending Creative",
    role: "Team Lead",
    access_level: "TL",
    supervisor: "Operations Manager",
    manager: "Director of Operations",
    hire_date: "2022-09-01",
    birthday: "1990-11-02",
    employment_status: "Active",
    employment_type: "Full-Time",
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
  },
  {
    id: "EMP-003",
    full_name: "Sample Agent Two",
    email: "agent2@goday.ca",
    country: "Costa Rica",
    department: "Customer Service",
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "Sample TL",
    manager: "Operations Manager",
    hire_date: "2023-01-10",
    birthday: "1994-08-20",
    employment_status: "Active",
    employment_type: "Full-Time",
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
  },
];

const rulesSeed = [
  {
    id: "RULE-001",
    department: "Operations",
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
  "Overtime",
];

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

function minutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

function formatHours(minutes) {
  const hours = Number(minutes || 0) / 60;
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

function getBalance(employee, type) {
  if (type === "PTO") return Number(employee.pto_balance || 0);
  if (type === "Sick Leave") return Number(employee.sick_balance || 0);
  if (type === "VTO") return Number(employee.vto_balance || 0);
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

async function googleGetDatabase() {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) return null;
  try {
    const response = await fetch(GOOGLE_API_URL);
    const result = await response.json();
    return result?.success ? result.data : null;
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
    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "addRow",
        tab,
        data,
      }),
    });

    const result = await response.json();
    console.log("Google Sheets addRow result:", result);

    if (!result.success) {
      alert(`Google Sheets write failed: ${result.message || "Unknown error"}`);
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
    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "updateRow",
        tab,
        idColumn,
        idValue,
        data,
      }),
    });

    const result = await response.json();
    console.log("Google Sheets updateRow result:", result);

    if (!result.success) {
      alert(`Google Sheets update failed: ${result.message || "Unknown error"}`);
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
    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      body: JSON.stringify({
        action: "deleteRow",
        tab,
        idColumn,
        idValue,
      }),
    });

    const result = await response.json();
    console.log("Google Sheets deleteRow result:", result);

    if (!result.success) {
      alert(`Google Sheets delete failed: ${result.message || "Unknown error"}`);
    }

    return result;
  } catch (error) {
    console.error("Google Sheets deleteRow error:", error);
    alert(`Google Sheets connection error: ${error.message}`);
    return null;
  }
}

async function googleRunArchive(activeDays = 90) {
  if (!GOOGLE_API_URL || GOOGLE_API_URL.includes("PASTE_YOUR_WORKING")) {
    console.warn("Google API URL is missing. Archive cannot run in local demo mode.");
    return { success: false, message: "Google API URL is missing. Archive cannot run in local demo mode." };
  }

  try {
    const result = await googleJsonp({
      action: "runArchive",
      activeDays,
    });

    console.log("Google Sheets archive result:", result);
    return result;
  } catch (error) {
    console.error("Google Sheets archive error:", error);
    return { success: false, message: error.message };
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
    role: row.Role || "Agent",
    access_level: row.Access_Level || "Employee",
    supervisor: row.Supervisor || "",
    manager: row.Manager || "",
    hire_date: row.Hire_Date || "",
    birthday: row.Birthday || "",
    employment_status: row.Employment_Status || "Active",
    employment_type: row.Employment_Type || "Full-Time",
    shift_start: row.Shift_Start || "08:00",
    shift_end: row.Shift_End || "17:00",
    break_start: row.Break_1_Start || "10:00",
    break_end: row.Break_1_End || "10:15",
    lunch_start: row.Lunch_Start || "12:00",
    lunch_end: row.Lunch_End || "13:00",
    second_break_start: row.Break_2_Start || "15:00",
    second_break_end: row.Break_2_End || "15:15",
    break_minutes: Number(row.Break_Minutes || 30),
    lunch_minutes: Number(row.Lunch_Minutes || 60),
    pto_balance: Number(row.PTO_Balance || 0),
    sick_balance: Number(row.Sick_Balance || 0),
    vto_balance: Number(row.VTO_Balance || 0),
    notes: row.Notes || "",
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
    Role: employee.role,
    Access_Level: employee.access_level,
    Supervisor: employee.supervisor,
    Manager: employee.manager,
    Hire_Date: employee.hire_date,
    Birthday: employee.birthday,
    Employment_Status: employee.employment_status,
    Employment_Type: employee.employment_type,
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
    Notes: employee.notes || "",
  };
}

function mapTimeFromSheet(row) {
  return {
    id: row.Log_ID || cleanId("TIME"),
    employee_id: row.Employee_ID || "",
    employee_name: row.Employee_Name || "",
    lob: row.LOB || "",
    department: row.Department || "",
    date: row.Date || today,
    category: row.Disposition || "Working",
    category_start: row.Category_Start || "08:00",
    category_end: row.Category_End || "08:00",
    approved: row.Approved || "Pending",
    notes: row.Notes || "",
    scheduled_start: row.Scheduled_Start || row.Shift_Start || "08:00",
    scheduled_end: row.Scheduled_End || row.Shift_End || "17:00",
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
    Date: item.date,
    Disposition: item.category,
    Category_Start: item.category_start,
    Category_End: item.category_end,
    Duration_Minutes: minutesBetween(item.category_start, item.category_end),
    Approved: item.approved,
    Approved_By: item.approved_by || "",
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
    hours: Number(row.Hours_Requested || 0),
    status: row.Status || "Pending",
    manager: row.Manager_Approval || "",
    current_balance: row.Current_Balance || "",
    projected_balance: row.Projected_Balance || "",
    reason: row.Reason || "",
    requested_days: Number(row.Hours_Requested || 0) / 8,
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
    shift_start: row.Shift_Start || "08:00",
    shift_end: row.Shift_End || "17:00",
    max_pto_out: Number(row.Max_PTO_Out || 0),
    max_vto_out: Number(row.Max_VTO_Out || 0),
    max_sick_out: Number(row.Max_Sick_Out || 0),
    min_staff_required: Number(row.Minimum_Staff_Required || 0),
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

export default function App() {
  const [employees, setEmployees] = useState(employeesSeed);
  const [timeEntries, setTimeEntries] = useState(timeSeed);
  const [requests, setRequests] = useState(requestsSeed);
  const [activityLog, setActivityLog] = useState(activitySeed);
  const [rules, setRules] = useState(rulesSeed);
  const [lobs, setLobs] = useState(lobSeed);
  const [departments, setDepartments] = useState(departmentSeed);
  const [newLob, setNewLob] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [tab, setTab] = useState("agent");
  const [adminMode, setAdminMode] = useState(false);
  const [search, setSearch] = useState("");
  const [reportView, setReportView] = useState("LOB");
  const [filters, setFilters] = useState({ lob: "All", department: "All", employee: "All", category: "All", startDate: "", endDate: "" });
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
    lob: "GoDay",
    role: "Agent",
    access_level: "Employee",
    supervisor: "",
    manager: "",
    hire_date: "",
    birthday: "",
    employment_status: "Active",
    employment_type: "Full-Time",
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
  const [databaseStatus, setDatabaseStatus] = useState("Loading Google Sheets database...");
  const [processModal, setProcessModal] = useState({
    show: false,
    status: "idle",
    title: "",
    message: "",
    details: "",
  });
  const [toast, setToast] = useState(null);
  const [archiveActiveDays, setArchiveActiveDays] = useState(90);
  const [lastArchiveResult, setLastArchiveResult] = useState(null);
  const actionLockRef = useRef(new Set());
  const modalTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    async function loadGoogleDatabase() {
      const database = await googleGetDatabase();

      if (!database) {
        setDatabaseStatus("Local demo mode. Add your working Google Apps Script URL to enable live sync.");
        return;
      }

      const sheetEmployees = (database.employees || []).map(mapEmployeeFromSheet);
      const sheetTime = (database.timeLogs || []).map(mapTimeFromSheet);
      const sheetRequests = (database.requests || []).map(mapRequestFromSheet);
      const sheetRules = (database.staffingRules || []).map(mapRuleFromSheet);
      const sheetLobs = (database.lobs || []).map((row) => row.LOB_Name).filter(Boolean);
      const sheetDepartments = (database.departments || []).map((row) => row.Department_Name).filter(Boolean);

      if (sheetEmployees.length) setEmployees(sheetEmployees);
      if (sheetTime.length) setTimeEntries(sheetTime);
      if (sheetRequests.length) setRequests(sheetRequests);
      if (sheetRules.length) setRules(sheetRules);
      if (sheetLobs.length) setLobs([...new Set(sheetLobs)]);
      if (sheetDepartments.length) setDepartments([...new Set(sheetDepartments)]);

      setDatabaseStatus("Google Sheets database connected live");
    }

    loadGoogleDatabase();
  }, []);

  function showToast(title, message = "", type = "success") {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ title, message, type });
    toastTimerRef.current = setTimeout(() => setToast(null), 4200);
  }

  function showProcessModal(status, title, message = "", details = "") {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    setProcessModal({ show: true, status, title, message, details });

    if (["success", "error", "warning"].includes(status)) {
      modalTimerRef.current = setTimeout(() => {
        setProcessModal({ show: false, status: "idle", title: "", message: "", details: "" });
      }, 2800);
    }
  }

  function closeProcessModal() {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current);
    setProcessModal({ show: false, status: "idle", title: "", message: "", details: "" });
  }

  async function runProtectedAction(key, title, handler) {
    if (actionLockRef.current.has(key)) {
      const message = `${title} is already processing. Please wait a moment.`;
      showToast("Duplicate click prevented", message, "warning");
      showProcessModal("warning", "Duplicate click prevented", message, "No duplicate data was submitted.");
      return null;
    }

    actionLockRef.current.add(key);
    showToast("Processing", `${title} is being saved. Please do not click again.`, "info");
    showProcessModal(
      "processing",
      "Processing request",
      `${title} is being checked and saved. Please do not click again.`,
      "The system is checking for duplicate data and updating Google Sheets."
    );

    try {
      const result = await handler();

      if (result === "silent") {
        showProcessModal("warning", "Duplicate prevented", `${title} was not saved because a matching record already exists.`, "No duplicate data was added.");
        return result;
      }

      if (result && result.success === false) {
        const message = result.message || `${title} was not saved.`;
        showToast("Not saved", message, "danger");
        showProcessModal("error", "Not saved", message, "Please review the database connection or try again.");
        return result;
      }

      showToast("Saved successfully", `${title} was completed.`, "success");
      showProcessModal("success", "Saved successfully", `${title} was completed and saved correctly.`, "The database update finished successfully.");
      return result;
    } catch (error) {
      console.error(error);
      const message = error?.message || "Please review the console or try again.";
      showToast("Action failed", message, "danger");
      showProcessModal("error", "Action failed", message, "The record was not saved.");
      return null;
    } finally {
      actionLockRef.current.delete(key);
    }
  }

  const currentUser = employees.find((e) => e.email === CURRENT_USER_EMAIL) || employees[0];
  const isAgentOnly = !adminMode && (CURRENT_USER_ACCESS_LEVEL === "Employee" || currentUser.access_level === "Employee");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(currentUser.id);
  const selectedEmployee = isAgentOnly ? currentUser : employees.find((e) => e.id === selectedEmployeeId) || currentUser;

  const visibleEmployees = isAgentOnly ? [currentUser] : employees;
  const visibleTime = isAgentOnly ? timeEntries.filter((t) => t.employee_id === currentUser.id) : timeEntries;
  const visibleRequests = isAgentOnly ? requests.filter((r) => r.employee_id === currentUser.id) : requests;
  const visibleActivity = isAgentOnly ? activityLog.filter((a) => a.employee_id === currentUser.id) : activityLog;

  const lobOptions = ["All", ...new Set([...lobs, ...visibleEmployees.map((e) => e.lob).filter(Boolean)])];
  const departmentOptions = ["All", ...new Set([...departments, ...visibleEmployees.map((e) => e.department).filter(Boolean)])];
  const employeeOptions = ["All", ...visibleEmployees.map((e) => e.full_name)];
  const categoryOptions = ["All", ...timeCategories, "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change"];

  const filteredTime = visibleTime.filter((t) => {
    const dateOk = (!filters.startDate || t.date >= filters.startDate) && (!filters.endDate || t.date <= filters.endDate);
    return (
      dateOk &&
      (filters.lob === "All" || t.lob === filters.lob) &&
      (filters.department === "All" || t.department === filters.department) &&
      (filters.employee === "All" || t.employee_name === filters.employee) &&
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
      (filters.employee === "All" || r.employee_name === filters.employee) &&
      (filters.category === "All" || r.type === filters.category)
    );
  });

  const filteredEmployees = visibleEmployees.filter((e) =>
    [e.full_name, e.email, e.lob, e.department, e.role, e.country, e.supervisor, e.manager]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const requestPreview = useMemo(() => {
    const requestedHours = Number(newRequest.hours || 0);
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
      const scheduledBreakLunch = groupEmployees.reduce((sum, e) => sum + Number(e.break_minutes || 0) + Number(e.lunch_minutes || 0), 0);
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
    return employees.map((e) => {
      const empTime = filteredTime.filter((t) => t.employee_id === e.id);
      const totalMinutes = empTime.reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const workingMinutes = empTime.filter((t) => t.category === "Working").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const breakMinutes = empTime.filter((t) => ["Break", "Lunch", "Bathroom"].includes(t.category)).reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const otMinutes = empTime.filter((t) => t.category === "Overtime").reduce((sum, t) => sum + minutesBetween(t.category_start, t.category_end), 0);
      const scheduledBreakLunch = Number(e.break_minutes || 0) + Number(e.lunch_minutes || 0);
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

  async function runArchiveBackup() {
    if (isAgentOnly) return;

    const activeDays = safeNumber(archiveActiveDays, 90);
    const confirmed = window.confirm(
      `Archive and backup records older than ${activeDays} days?\n\nThis will move eligible historical records to archive tabs and create CSV backup files in Google Drive. Active/current records will remain in the live database.`
    );

    if (!confirmed) return;

    return runProtectedAction("archive-backup-run", "Archive backup", async () => {
      const result = await googleRunArchive(activeDays);
      setLastArchiveResult(result);

      if (!result?.success) {
        return {
          success: false,
          message: result?.message || "Archive backup did not complete.",
        };
      }

      const database = await googleGetDatabase();
      if (database) {
        const sheetTime = (database.timeLogs || []).map(mapTimeFromSheet);
        const sheetRequests = (database.requests || []).map(mapRequestFromSheet);
        const sheetRules = (database.staffingRules || []).map(mapRuleFromSheet);
        if (Array.isArray(database.timeLogs)) setTimeEntries(sheetTime);
        if (Array.isArray(database.requests)) setRequests(sheetRequests);
        if (sheetRules.length) setRules(sheetRules);
      }

      return result;
    });
  }

  async function saveEmployee() {
    if (isAgentOnly) return;

    if (!newEmployee.full_name || !newEmployee.email) {
      return alert("Name and email are required.");
    }

    const generatedPassword = Math.random().toString(36).slice(-8) + "A1!";
    let authUserId = null;

    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: newEmployee.email,
        password: generatedPassword,
      });

      if (error) {
        console.error(error);
        return alert(error.message);
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

    alert(
      `User created successfully.

Email: ${newEmployee.email}
Temporary Password: ${generatedPassword}

User can now log into the Agent Portal.`
    );

    setNewEmployee({ ...newEmployee, full_name: "", email: "" });
  }

  function saveRule() {
    const item = {
      ...newRule,
      id: `RULE-${Date.now().toString().slice(-6)}`,
      max_pto_out: Number(newRule.max_pto_out || 0),
      max_vto_out: Number(newRule.max_vto_out || 0),
      max_sick_out: Number(newRule.max_sick_out || 0),
      min_staff_required: Number(newRule.min_staff_required || 0),
    };
    setRules([item, ...rules]);
    googleAddRow("staffingRules", mapRuleToSheet(item));
  }

  function deleteRule(id) {
    setRules(rules.filter((r) => r.id !== id));
  }

  function updateEmployeeSchedule(employeeId, field, value) {
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

  async function agentAction(action, status = agentStatus) {
    const key = `agent-action-${selectedEmployee.id}-${action}-${status}`;
    return runProtectedAction(key, action, async () => {
      const now = new Date();
      const time = now.toTimeString().slice(0, 5);

      const duplicate = timeEntries.some(
        (entry) =>
          entry.employee_id === selectedEmployee.id &&
          entry.date === today &&
          entry.category === status &&
          entry.category_start === time &&
          entry.notes === action
      );

      if (duplicate) return "silent";

      const activity = {
        id: `ACT-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        action,
        time,
        status,
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
      };

      const timeEntry = {
        id: `TIME-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        scheduled_start: selectedEmployee.shift_start,
        scheduled_end: selectedEmployee.shift_end,
        clock_in: action === "Shift Started" ? time : selectedEmployee.shift_start,
        clock_out: action === "Shift Ended" ? time : selectedEmployee.shift_end,
        category: status,
        category_start: time,
        category_end: time,
        approved: status === "Overtime" || action.includes("Shift") ? "Pending" : "Auto Logged",
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
        notes: action,
      };

      if (supabase) await supabase.from("time_entries").insert(timeEntry);
      const result = await googleAddRow("timeLogs", mapTimeToSheet(timeEntry));
      if (result && result.success === false) return result;

      setActivityLog((current) => [activity, ...current]);
      setTimeEntries((current) => [timeEntry, ...current]);
      return result || { success: true };
    });
  }

  async function saveTime() {
    if (isAgentOnly) return;

    const key = `manual-time-${selectedEmployee.id}-${newTime.category}-${newTime.category_start}-${newTime.category_end}`;
    return runProtectedAction(key, "Manual time entry", async () => {
      const duplicate = timeEntries.some(
        (entry) =>
          entry.employee_id === selectedEmployee.id &&
          entry.date === today &&
          entry.category === newTime.category &&
          entry.category_start === newTime.category_start &&
          entry.category_end === newTime.category_end &&
          String(entry.notes || "").trim() === String(newTime.notes || "").trim()
      );

      if (duplicate) return "silent";

      const item = {
        id: `TIME-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        date: today,
        scheduled_start: selectedEmployee.shift_start,
        scheduled_end: selectedEmployee.shift_end,
        clock_in: selectedEmployee.shift_start,
        clock_out: selectedEmployee.shift_end,
        approved: "Pending",
        lob: selectedEmployee.lob,
        department: selectedEmployee.department,
        ...newTime,
      };

      if (supabase) await supabase.from("time_entries").insert(item);
      const result = await googleAddRow("timeLogs", mapTimeToSheet(item));
      if (result && result.success === false) return result;

      setTimeEntries((current) => [item, ...current]);
      return result || { success: true };
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

      if (duplicate) return "silent";

      const item = {
        id: `REQ-${Date.now().toString().slice(-6)}`,
        employee_id: selectedEmployee.id,
        employee_name: selectedEmployee.full_name,
        manager: selectedEmployee.supervisor || selectedEmployee.manager,
        status: "Pending",
        ...newRequest,
        hours: calculateRequestHours(newRequest),
        requested_days: requestPreview.requestedDays,
        current_balance: requestPreview.currentBalance,
        projected_balance: requestPreview.projectedBalance,
      };

      if (supabase) await supabase.from("time_off_requests").insert(item);
      const result = await googleAddRow("requests", mapRequestToSheet(item));
      if (result && result.success === false) return result;

      setRequests((current) => [item, ...current]);
      return result || { success: true };
    });
  }

  async function setRequestStatus(id, status) {
    if (isAgentOnly) return;

    const request = requests.find((r) => r.id === id);
    if (!request) return;

    const key = `request-approval-${id}-${status}`;
    return runProtectedAction(key, `Request ${status}`, async () => {
      if (request.status === status) return "silent";

      let updatedEmployees = employees;
      let updatedEmployee = employees.find((e) => e.id === request.employee_id);

      if (status === "Approved") {
        const field = balanceField(request.type);
        if (field) {
          updatedEmployees = employees.map((e) => {
            if (e.id !== request.employee_id) return e;
            const newBalance = Math.max(0, Number(e[field] || 0) - Number(request.hours || 0));
            return { ...e, [field]: newBalance };
          });

          updatedEmployee = updatedEmployees.find((e) => e.id === request.employee_id);

          if (supabase && updatedEmployee) {
            await supabase.from("employees").update({ [field]: updatedEmployee[field] }).eq("id", request.employee_id);
          }

          if (updatedEmployee) {
            await googleUpdateRow("employees", "Employee_ID", request.employee_id, mapEmployeeToSheet(updatedEmployee));
          }
        }
      }

      const updatedRequest = {
        ...request,
        status,
        manager: currentUser.email,
        projected_balance:
          status === "Approved" && updatedEmployee && balanceField(request.type)
            ? updatedEmployee[balanceField(request.type)]
            : request.projected_balance,
      };

      if (supabase) await supabase.from("time_off_requests").update({ status }).eq("id", id);
      const result = await googleUpdateRow("requests", "Request_ID", id, mapRequestToSheet(updatedRequest));
      if (result && result.success === false) return result;

      await googleAddRow(
        "approvals",
        mapApprovalToSheet({
          id: cleanId("APPROVAL"),
          employee_id: request.employee_id,
          employee_name: request.employee_name,
          approval_type: "Time Off / Request",
          related_record_id: request.id,
          request_type: request.type,
          decision: status,
          previous_status: request.status,
          new_status: status,
          approved_by: currentUser.email,
          approved_date: new Date(),
          hours: request.hours,
          current_balance: request.current_balance,
          projected_balance: updatedRequest.projected_balance,
          notes: `Manager decision recorded for ${request.type}`,
        })
      );

      setEmployees(updatedEmployees);
      setRequests((current) => current.map((r) => (r.id === id ? updatedRequest : r)));
      return result || { success: true };
    });
  }

  async function setTimeStatus(id, approved) {
    if (isAgentOnly) return;

    const timeEntry = timeEntries.find((t) => t.id === id);
    if (!timeEntry) return;

    const key = `time-approval-${id}-${approved}`;
    return runProtectedAction(key, `Time entry ${approved}`, async () => {
      if (timeEntry.approved === approved) return "silent";

      const updatedTimeEntry = {
        ...timeEntry,
        approved,
        approved_by: currentUser.email,
      };

      if (supabase) await supabase.from("time_entries").update({ approved }).eq("id", id);
      const result = await googleUpdateRow("timeLogs", "Log_ID", id, mapTimeToSheet(updatedTimeEntry));
      if (result && result.success === false) return result;

      await googleAddRow(
        "approvals",
        mapApprovalToSheet({
          id: cleanId("APPROVAL"),
          employee_id: timeEntry.employee_id,
          employee_name: timeEntry.employee_name,
          approval_type: "Time Log / Overtime / Disposition",
          related_record_id: timeEntry.id,
          request_type: timeEntry.category,
          decision: approved,
          previous_status: timeEntry.approved,
          new_status: approved,
          approved_by: currentUser.email,
          approved_date: new Date(),
          hours: (minutesBetween(timeEntry.category_start, timeEntry.category_end) / 60).toFixed(2),
          notes: `Manager decision recorded for ${timeEntry.category}`,
        })
      );

      setTimeEntries((current) => current.map((t) => (t.id === id ? updatedTimeEntry : t)));
      return result || { success: true };
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
          lunch_minutes: Number(r.Lunch_Minutes || 60),
          break_minutes: Number(r.Break_Minutes || 30),
          pto_balance: Number(r.PTO_Balance || 0),
          sick_balance: Number(r.Sick_Balance || 0),
          vto_balance: Number(r.VTO_Balance || 0),
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
        ["archive", Database],
        ["rules", Settings],
      ];

  return (
    <div className="app">
      <style>{styles}</style>
      {processModal.show && <ProcessingModal modal={processModal} onClose={closeProcessModal} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      <aside className="sidebar">
        <div className="logoWrap">
          <img src={LOGO} alt="CandoContact" />
          <div><strong>CandoContact</strong><span>HR Workforce</span></div>
        </div>
        <nav>
          {navItems.map(([key, Icon]) => (
            <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              <Icon size={18} /> {key === "agent" ? "My Portal" : key}
            </button>
          ))}
        </nav>
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
            <div className="actions"><button className="primary" onClick={() => setAdminMode(true)}>Admin / Manager Access</button></div>
          )}
          {!isAgentOnly && (
            <div className="actions">
              <button onClick={() => { setAdminMode(false); setTab("agent"); }}>Return to Agent View</button>
              <label className="btn"><Upload size={16} /> Import CSV<input type="file" accept=".csv" onChange={importEmployees} /></label>
              <button onClick={exportTimeCsv}><Download size={16} /> Time CSV</button>
              <button onClick={exportRequestsCsv}><Download size={16} /> Requests CSV</button>
              <button className="primary" onClick={exportPdf}><Download size={16} /> PDF</button>
            </div>
          )}
        </header>

        {!isAgentOnly && (
          <section className="filterPanel">
            <Field label="LOB"><select value={filters.lob} onChange={(e) => setFilters({ ...filters, lob: e.target.value })}>{lobOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Department"><select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>{departmentOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Employee"><select value={filters.employee} onChange={(e) => setFilters({ ...filters, employee: e.target.value })}>{employeeOptions.map((x) => <option key={x}>{x}</option>)}</select></Field>
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
                <p>{selectedEmployee.role} · {selectedEmployee.lob} · {selectedEmployee.department}</p>
                <div className="profileGrid">
                  <Info label="LOB" value={selectedEmployee.lob} />
                  <Info label="Department" value={selectedEmployee.department} />
                  <Info label="Role" value={selectedEmployee.role} />
                  <Info label="Supervisor" value={selectedEmployee.supervisor || "Not assigned"} />
                  <Info label="Country" value={selectedEmployee.country} />
                  <Info label="Employment Status" value={selectedEmployee.employment_status} />
                </div>
              </div>
              <div className="agentShiftCard">
                <span>Today’s Shift</span>
                <strong>{selectedEmployee.shift_start} - {selectedEmployee.shift_end}</strong>
                <small>Break: {selectedEmployee.break_start}-{selectedEmployee.break_end} · Lunch: {selectedEmployee.lunch_start}-{selectedEmployee.lunch_end}</small>
              </div>
            </div>

            <div className="agentGrid">
              <Card title="My shift actions / overtime">
                <div className="agentActions">
                  <button className="primary" onClick={() => agentAction("Shift Started", "Working")}>Start Shift</button>
                  <button onClick={() => agentAction("Shift Ended", "Working")}>End Shift</button>
                </div>
                <div className="currentStatus">
                  <label><span>Current Status / Disposition</span><select value={agentStatus} onChange={(e) => setAgentStatus(e.target.value)}>{timeCategories.map((x) => <option key={x}>{x}</option>)}</select></label>
                  <button className="primary" onClick={() => agentAction("Status Changed", agentStatus)}>Log Status</button>
                  <button onClick={() => { setAgentStatus("Overtime"); agentAction("Overtime Logged", "Overtime"); }}>Log Overtime</button>
                </div>
              </Card>

              <Card title="My balances">
                <div className="balanceGrid">
                  <div><span>PTO</span><strong>{selectedEmployee.pto_balance}h</strong></div>
                  <div><span>Sick</span><strong>{selectedEmployee.sick_balance}h</strong></div>
                  <div><span>VTO</span><strong>{selectedEmployee.vto_balance}h</strong></div>
                  <div><span>Tenure</span><strong>{tenure(selectedEmployee.hire_date)}</strong></div>
                </div>
              </Card>

              <Card title="Submit my PTO / VTO / OT request">
                <div className="requestPreview">
                  <Info label="Request Type" value={newRequest.type} />
                  <Info label="Requested" value={`${requestPreview.requestedHours}h / ${requestPreview.requestedDays.toFixed(1)} days`} />
                  <Info label="Current Balance" value={requestPreview.impactsBalance ? `${requestPreview.currentBalance}h` : "N/A"} />
                  <Info label="After Approval" value={requestPreview.impactsBalance ? `${requestPreview.projectedBalance}h` : "No deduction"} />
                </div>
                <FormGrid>
                  <select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change", "Overtime"].map((x) => <option key={x}>{x}</option>)}</select>
                  <input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })} />
                  <input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} />
                  <input type="number" value={newRequest.hours} onChange={(e) => setNewRequest({ ...newRequest, hours: e.target.value })} />
                  <input placeholder="Reason or notes" value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} />
                  <button className="primary wide" onClick={saveRequest}>Submit to Manager</button>
                </FormGrid>
              </Card>

              <Card title="My activity today">
                <Table headers={["Action", "Status", "Time", "Date"]} rows={visibleActivity.map((a) => [a.action, <Badge muted>{a.status}</Badge>, a.time, a.date])} />
              </Card>
            </div>
          </section>
        )}

        {!isAgentOnly && tab !== "agent" && (
          <section className="metrics">
            <Metric icon={Users} label="Active Employees" value={stats.active} hint="Current headcount" />
            <Metric icon={FileCheck} label="Pending Requests" value={stats.pendingRequests} hint="Awaiting approval" />
            <Metric icon={Clock} label="Payroll Exceptions" value={stats.payrollExceptions} hint="Pending review" />
            <Metric icon={Clock} label="Overtime" value={formatHours(stats.overtimeMinutes)} hint="Tracked OT" />
            <Metric icon={BarChart3} label="Productivity" value={`${stats.productivity}%`} hint="Working vs tracked" />
          </section>
        )}

        {!isAgentOnly && tab === "dashboard" && (
          <section className="grid two">
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
            <Card title="Employee master database" action={<SearchBox value={search} onChange={setSearch} />}>
              <Table headers={["Employee", "LOB", "Department", "Role", "Country", "Shift", "Status"]} rows={filteredEmployees.map((e) => [<button className="textBtn" onClick={() => setSelectedEmployeeId(e.id)}>{e.full_name}<small>{e.email}</small></button>, e.lob, e.department, e.role, e.country, `${e.shift_start} - ${e.shift_end}`, <Badge>{e.employment_status}</Badge>])} />
            </Card>
            <Card title="Add employee">
              <FormGrid>
                <input placeholder="Full name" value={newEmployee.full_name} onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })} />
                <input placeholder="Email" value={newEmployee.email} onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })} />
                <input placeholder="Country" value={newEmployee.country} onChange={(e) => setNewEmployee({ ...newEmployee, country: e.target.value })} />
                <select value={newEmployee.lob} onChange={(e) => setNewEmployee({ ...newEmployee, lob: e.target.value })}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select>
                <select value={newEmployee.department} onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}>{departments.map((department) => <option key={department}>{department}</option>)}</select>
                <input placeholder="Role" value={newEmployee.role} onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })} />
                <input type="time" value={newEmployee.shift_start} onChange={(e) => setNewEmployee({ ...newEmployee, shift_start: e.target.value })} />
                <input type="time" value={newEmployee.shift_end} onChange={(e) => setNewEmployee({ ...newEmployee, shift_end: e.target.value })} />
                <button className="primary wide" onClick={saveEmployee}>Save employee</button>
              </FormGrid>
            </Card>
          </section>
        )}

        {!isAgentOnly && tab === "schedule" && (
          <section className="schedulePage">
            <Card title="Employee schedule management">
              <p className="helperText">Edit each employee’s assigned shift, break, lunch, second break, LOB, and department. Updates are reflected live in the Agent Portal, reporting, payroll review, and staffing rules.</p>
              <Table
                headers={["Employee", "LOB", "Department", "Shift Start", "Shift End", "Break 1", "Lunch", "Break 2", "Break Min", "Lunch Min"]}
                rows={employees.map((e) => [
                  <strong>{e.full_name}</strong>,
                  <select value={e.lob} onChange={(event) => updateEmployeeSchedule(e.id, "lob", event.target.value)}>{lobs.map((lob) => <option key={lob}>{lob}</option>)}</select>,
                  <select value={e.department} onChange={(event) => updateEmployeeSchedule(e.id, "department", event.target.value)}>{departments.map((department) => <option key={department}>{department}</option>)}</select>,
                  <input type="time" value={e.shift_start} onChange={(event) => updateEmployeeSchedule(e.id, "shift_start", event.target.value)} />,
                  <input type="time" value={e.shift_end} onChange={(event) => updateEmployeeSchedule(e.id, "shift_end", event.target.value)} />,
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
            <Card title="Log time category"><FormGrid><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select><select value={newTime.category} onChange={(e) => setNewTime({ ...newTime, category: e.target.value })}>{timeCategories.map((x) => <option key={x}>{x}</option>)}</select><input type="time" value={newTime.category_start} onChange={(e) => setNewTime({ ...newTime, category_start: e.target.value })} /><input type="time" value={newTime.category_end} onChange={(e) => setNewTime({ ...newTime, category_end: e.target.value })} /><input placeholder="Notes" value={newTime.notes} onChange={(e) => setNewTime({ ...newTime, notes: e.target.value })} /><button className="primary wide" onClick={saveTime}>Add time entry</button></FormGrid></Card>
            <Card title="Daily time utilization"><Table headers={["Employee", "Date", "LOB", "Category", "Time", "Duration", "Approval"]} rows={filteredTime.map((t) => [t.employee_name, t.date, t.lob, <Badge muted>{t.category}</Badge>, `${t.category_start} - ${t.category_end}`, formatHours(minutesBetween(t.category_start, t.category_end)), t.approved])} /></Card>
          </section>
        )}

        {!isAgentOnly && tab === "requests" && (
          <section className="grid split reverse">
            <Card title="Submit PTO / VTO / leave"><FormGrid><select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select><select value={newRequest.type} onChange={(e) => setNewRequest({ ...newRequest, type: e.target.value })}>{["PTO", "VTO", "Sick Leave", "Paid Leave", "Unpaid Leave", "Schedule Change", "Overtime"].map((x) => <option key={x}>{x}</option>)}</select><input type="date" value={newRequest.start_date} onChange={(e) => setNewRequest({ ...newRequest, start_date: e.target.value })} /><input type="date" value={newRequest.end_date} onChange={(e) => setNewRequest({ ...newRequest, end_date: e.target.value })} /><input type="number" value={newRequest.hours} onChange={(e) => setNewRequest({ ...newRequest, hours: e.target.value })} /><input placeholder="Reason" value={newRequest.reason} onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })} /><button className="primary wide" onClick={saveRequest}>Submit request</button></FormGrid></Card>
            <Card title="Request history"><Table headers={["Employee", "Type", "Dates", "Hours", "Days", "Current", "After", "Status"]} rows={filteredRequests.map((r) => [r.employee_name, r.type, `${r.start_date} to ${r.end_date}`, r.hours, Number(r.requested_days || r.hours / 8).toFixed(1), r.current_balance ?? "N/A", r.projected_balance ?? "N/A", <Badge>{r.status}</Badge>])} /></Card>
          </section>
        )}

        {!isAgentOnly && tab === "manager" && (
          <section className="grid two">
            <Card title="Pending leave and OT requests">{requests.filter((r) => r.status === "Pending").map((r) => <Approval key={r.id} title={r.employee_name} detail={`${r.type} · ${r.hours}h / ${Number(r.requested_days || r.hours / 8).toFixed(1)} days · Current: ${r.current_balance ?? "N/A"}h · After: ${r.projected_balance ?? "N/A"}h`} approve={() => setRequestStatus(r.id, "Approved")} deny={() => setRequestStatus(r.id, "Denied")} />)}</Card>
            <Card title="Pending time and OT exceptions">{timeEntries.filter((t) => t.approved === "Pending").map((t) => <Approval key={t.id} title={t.employee_name} detail={`${t.category} · ${t.category_start}-${t.category_end}`} approve={() => setTimeStatus(t.id, "Approved")} deny={() => setTimeStatus(t.id, "Denied")} />)}</Card>
          </section>
        )}

        {!isAgentOnly && tab === "payroll" && (
          <Card title="Payroll review"><Table headers={["Employee", "Scheduled", "Clock In/Out", "Late", "Worked", "OT", "Status"]} rows={filteredTime.map((t) => { const late = Math.max(0, minutesBetween(t.scheduled_start, t.clock_in)); const worked = minutesBetween(t.clock_in, t.clock_out); const ot = t.category === "Overtime" ? minutesBetween(t.category_start, t.category_end) : Math.max(0, minutesBetween(t.scheduled_end, t.clock_out)); return [t.employee_name, `${t.scheduled_start} - ${t.scheduled_end}`, `${t.clock_in} - ${t.clock_out}`, `${late} min`, formatHours(worked), formatHours(ot), <Badge danger={late > 0}>{late > 0 ? "Late" : "On Time"}</Badge>]; })} /></Card>
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
                    <Info label="Break/Lunch Used" value={`${group.breakMinutes} min`} />
                    <Info label="Scheduled Break/Lunch" value={`${group.scheduledBreakLunch} min`} />
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
                  headers={["Employee", "LOB", "Department", "Productivity", "Late", "Break Used", "Scheduled Break", "Variance", "OT"]}
                  rows={agentReporting.map((e) => [e.full_name, e.lob, e.department, `${e.productivity}%`, `${e.lateMinutes} min`, `${e.breakMinutes} min`, `${e.scheduledBreakLunch} min`, <Badge danger={e.variance > 0} muted={e.variance <= 0}>{e.variance > 0 ? "+" : ""}{e.variance} min</Badge>, formatHours(e.otMinutes)])}
                />
              </Card>
              <Card title="Category utilization summary">
                {categoryStats.map((item) => <Progress key={item.label} label={item.label} value={formatHours(item.minutes)} percent={stats.total ? (item.minutes / stats.total) * 100 : 0} />)}
                <div className="reportNote">Use this view to compare scheduled expectations against actual logged time by LOB, department, and agent. This helps review breaks, lunch, bathroom time, meetings, training, system issues, OT, and productivity.</div>
              </Card>
            </section>
          </section>
        )}

        {!isAgentOnly && tab === "archive" && (
          <section className="archivePage">
            <div className="reportHeader">
              <div>
                <h2>Archive & Backup Center</h2>
                <p>Move older operational records out of the live database and create CSV backups in Google Drive. This keeps Google Sheets faster while preserving historical audit records.</p>
              </div>
              <div className="reportControls">
                <label className="field archiveDays">
                  <span>Keep active data for</span>
                  <input
                    type="number"
                    min="30"
                    step="15"
                    value={archiveActiveDays}
                    onChange={(e) => setArchiveActiveDays(e.target.value)}
                  />
                </label>
                <button className="primary" onClick={runArchiveBackup}>
                  <Database size={16} /> Create Archive Backup
                </button>
              </div>
            </div>

            <section className="grid two">
              <Card title="What this archive does">
                <div className="archiveInfoGrid">
                  <Info label="Live data kept" value={`${safeNumber(archiveActiveDays, 90)} days`} />
                  <Info label="Backup location" value="Google Drive" />
                  <Info label="Archive method" value="Move + CSV backup" />
                  <Info label="Deletion" value="No permanent deletion" />
                </div>
                <div className="productivityHelp">
                  <strong>How the archive protects the app</strong>
                  <p>
                    Records older than the selected retention window are moved from live operational tabs into archive tabs.
                    A CSV backup is also created in Google Drive under CandoContact HR Archives. This helps prevent Google Sheets
                    from becoming too heavy while keeping HR, payroll, and audit history available.
                  </p>
                </div>
              </Card>

              <Card title="Archive status">
                {lastArchiveResult ? (
                  <div className="archiveResult">
                    <Info label="Status" value={lastArchiveResult.success ? "Completed" : "Failed"} />
                    <Info label="Cutoff Date" value={lastArchiveResult.cutoffDate || "N/A"} />
                    <Info label="Message" value={lastArchiveResult.message || "Archive finished."} />
                    <Info label="Files Created" value={Array.isArray(lastArchiveResult.files) ? lastArchiveResult.files.length : 0} />
                  </div>
                ) : (
                  <p className="muted">No archive backup has been run from this browser session yet.</p>
                )}
              </Card>
            </section>

            {lastArchiveResult?.files?.length ? (
              <Card title="Last archive file summary">
                <Table
                  headers={["Source Tab", "Archive Tab", "Rows", "Status", "File"]}
                  rows={lastArchiveResult.files.map((file) => [
                    file.tab || "N/A",
                    file.archiveTab || "N/A",
                    file.rowsArchived ?? 0,
                    <Badge danger={!String(file.status || "").toLowerCase().includes("archive") && safeNumber(file.rowsArchived, 0) === 0}>{file.status || "Completed"}</Badge>,
                    file.fileUrl ? <a href={file.fileUrl} target="_blank" rel="noreferrer">Open backup</a> : "No file",
                  ])}
                />
              </Card>
            ) : null}
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
                  <input placeholder="Example: Collections, QA, Training, HR" value={newDepartment} onChange={(e) => setNewDepartment(e.target.value)} />
                  <button className="primary" onClick={addDepartment}>Add Department</button>
                </div>
                <div className="chipList">{departments.map((department) => <span className="chip" key={department}>{department}<button onClick={() => deleteDepartment(department)}>×</button></span>)}</div>
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
                    return [rule.lob, rule.department, `${rule.shift_start}-${rule.shift_end}`, usage.scheduled, usage.out, usage.available, `PTO ${usage.pto}/${rule.max_pto_out} · VTO ${usage.vto}/${rule.max_vto_out} · Sick ${usage.sick}/${rule.max_sick_out} · Min ${rule.min_staff_required}`, <Badge danger={exceeds}>{exceeds ? "Risk" : "Within Rule"}</Badge>, <button onClick={() => deleteRule(rule.id)}>Delete</button>];
                  })}
                />
              </Card>
            </section>
          </section>
        )}

        
      </main>
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
      <div className="toastIcon">{toast.type === "danger" ? "!" : toast.type === "warning" ? "!" : toast.type === "info" ? "…" : "✓"}</div>
      <section>
        <strong>{toast.title}</strong>
        {toast.message && <span>{toast.message}</span>}
      </section>
      <button type="button" onClick={onClose}>×</button>
    </div>
  );
}

function ProcessingModal({ modal, onClose }) {
  const isProcessing = modal.status === "processing";
  const isSuccess = modal.status === "success";
  const isError = modal.status === "error";
  const isWarning = modal.status === "warning";

  return (
    <div className="processOverlay" role="alert" aria-live="assertive">
      <div className={`processModal ${modal.status}`}>
        <div className="processIcon">
          {isProcessing ? <span className="spinner" /> : isSuccess ? "✓" : isError ? "!" : isWarning ? "!" : "•"}
        </div>
        <h2>{modal.title || "Processing"}</h2>
        <p>{modal.message || "Please wait while the system updates the database."}</p>
        {modal.details && <small>{modal.details}</small>}
        {!isProcessing && (
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        )}
      </div>
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

const styles = `
* { box-sizing: border-box; }
:root { --green: #047857; --dark: #10251c; --soft: #f4faf7; --border: #dfeee7; --muted: #64756d; }
body { margin: 0; background: #f7faf8; color: var(--dark); font-family: Inter, Segoe UI, Roboto, Arial, sans-serif; }
button, input, select { font: inherit; }
.app { min-height: 100vh; display: grid; grid-template-columns: 280px 1fr; }
.sidebar { background: #0d2018; color: white; padding: 22px; position: sticky; top: 0; height: 100vh; display: flex; flex-direction: column; gap: 22px; }
.logoWrap { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,.12); }
.logoWrap img { width: 46px; height: 46px; object-fit: contain; border-radius: 12px; background: white; padding: 5px; flex: 0 0 auto; }
.logoWrap strong { display: block; font-size: 16px; }
.logoWrap span { display: block; color: #a8c7b9; font-size: 12px; margin-top: 2px; }
.sidebar nav { display: grid; gap: 8px; }
.sidebar nav button { width: 100%; border: 0; background: transparent; color: #cce0d6; border-radius: 14px; padding: 12px; display: flex; align-items: center; gap: 10px; text-transform: capitalize; cursor: pointer; }
.sidebar nav button:hover, .sidebar nav button.active { background: #123d2c; color: white; }
.syncBox { margin-top: auto; background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12); border-radius: 16px; padding: 12px; display: flex; align-items: center; gap: 8px; color: #bfe0d2; font-size: 13px; }
main { padding: 24px; min-width: 0; }
.topbar { background: linear-gradient(135deg, white, #edf8f2); border: 1px solid var(--border); border-radius: 26px; padding: 22px; display: flex; justify-content: space-between; gap: 18px; align-items: center; box-shadow: 0 18px 40px rgba(4,120,87,.08); }
h1 { margin: 0; font-size: clamp(28px, 3vw, 42px); letter-spacing: -1px; }
.topbar p { margin: 8px 0 0; color: var(--muted); }
.actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
button, .btn { border: 1px solid var(--border); background: white; color: var(--dark); border-radius: 13px; padding: 10px 12px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; text-decoration: none; }
button:hover, .btn:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(0,0,0,.08); }
.primary { background: var(--green); color: white; border-color: var(--green); }
.btn input { display: none; }
.filterPanel { margin-top: 18px; background: white; border: 1px solid var(--border); border-radius: 22px; padding: 16px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; }
.field { display: grid; gap: 6px; }
.field span { color: var(--muted); font-size: 12px; font-weight: 800; }
input, select { width: 100%; border: 1px solid #d6e6de; background: white; color: var(--dark); border-radius: 12px; padding: 10px 11px; outline: none; min-height: 42px; }
input:focus, select:focus { border-color: var(--green); box-shadow: 0 0 0 4px rgba(4,120,87,.10); }
.metrics { margin-top: 18px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.metric { background: white; border: 1px solid var(--border); border-radius: 22px; padding: 18px; display: flex; gap: 14px; align-items: center; box-shadow: 0 8px 22px rgba(0,0,0,.035); }
.metric > div { width: 46px; height: 46px; border-radius: 15px; background: #ecfdf5; color: var(--green); display: grid; place-items: center; }
.metric span { color: var(--muted); font-size: 13px; }
.metric strong { display: block; font-size: 30px; line-height: 1.05; margin: 4px 0; }
.metric p { margin: 0; color: #87958e; font-size: 12px; }
.grid { margin-top: 18px; display: grid; gap: 18px; }
.grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid.split { grid-template-columns: minmax(0, 2fr) 380px; }
.grid.split.reverse { grid-template-columns: 380px minmax(0, 2fr); }
.card { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 18px; min-width: 0; box-shadow: 0 8px 22px rgba(0,0,0,.035); }
.card header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
.card h2 { margin: 0; font-size: 20px; letter-spacing: -.2px; }
.search { display: flex; align-items: center; gap: 8px; border: 1px solid #d6e6de; border-radius: 13px; padding-left: 10px; min-width: 250px; color: var(--muted); }
.search input { border: 0; box-shadow: none; }
.table { border: 1px solid #e6f0eb; border-radius: 16px; overflow: auto; }
table { width: 100%; min-width: 760px; border-collapse: collapse; background: white; }
th { background: #f3faf6; color: #64756d; font-size: 12px; letter-spacing: .04em; text-transform: uppercase; text-align: left; padding: 12px; }
td { padding: 12px; border-top: 1px solid #edf4f0; vertical-align: middle; }
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
.approval { border: 1px solid #e6f0eb; border-radius: 18px; padding: 14px; display: flex; justify-content: space-between; gap: 10px; align-items: center; margin-bottom: 10px; }
.approval strong { display: block; }
.approval span { color: var(--muted); font-size: 13px; display: block; margin-top: 3px; }
.approval button { width: 38px; height: 38px; padding: 0; justify-content: center; }
.approve { color: #047857; }
.deny { color: #b91c1c; }
.employeeFooter { margin-top: 18px; background: white; border: 1px solid var(--border); border-radius: 22px; padding: 16px; display: flex; justify-content: space-between; align-items: center; gap: 14px; }
.employeeFooter span:first-child { color: var(--muted); font-size: 12px; font-weight: 800; }
.employeeFooter strong { display: block; font-size: 18px; margin: 4px 0; }
.employeeFooter p { margin: 0; color: var(--muted); }
.agentPortal { margin-top: 18px; }
.agentHero { background: linear-gradient(135deg, #ffffff, #eafaf2); border: 1px solid var(--border); border-radius: 26px; padding: 22px; display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; box-shadow: 0 18px 40px rgba(4,120,87,.08); }
.agentHero span { color: var(--green); font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
.agentHero h2 { margin: 4px 0; font-size: clamp(26px, 3vw, 38px); }
.agentHero p { margin: 0; color: var(--muted); }
.profileGrid, .requestPreview { margin-top: 16px; display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); gap: 10px; }
.info { background: white; border: 1px solid var(--border); border-radius: 16px; padding: 11px 12px; }
.info span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
.info strong { display: block; color: var(--dark); font-size: 14px; margin-top: 4px; }
.agentShiftCard { background: white; border: 1px solid var(--border); border-radius: 20px; padding: 16px; min-width: 260px; }
.agentShiftCard strong { display: block; font-size: 24px; margin: 4px 0; }
.agentShiftCard small { color: var(--muted); display: block; line-height: 1.5; }
.agentGrid { margin-top: 18px; display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.agentActions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.currentStatus { margin-top: 14px; display: grid; grid-template-columns: 1fr auto auto; gap: 10px; align-items: end; }
.currentStatus label { display: grid; gap: 6px; }
.currentStatus span { color: var(--muted); font-size: 12px; font-weight: 800; }
.balanceGrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.balanceGrid div { background: #f5fbf8; border: 1px solid var(--border); border-radius: 18px; padding: 14px; }
.balanceGrid span { display: block; color: var(--muted); font-size: 12px; font-weight: 800; }
.balanceGrid strong { display: block; margin-top: 4px; font-size: 22px; }
.schedulePage { margin-top: 18px; }
.miniTimes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; min-width: 190px; }
.rulesPage { margin-top: 18px; }
.helperText { margin: 0 0 12px; color: var(--muted); line-height: 1.45; }
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
.reportGrid { margin-top: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; }
.reportCard { background: white; border: 1px solid var(--border); border-radius: 24px; padding: 18px; box-shadow: 0 8px 22px rgba(0,0,0,.035); }
.reportCardHead { display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px; }
.reportCardHead span { display: block; color: var(--muted); font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
.reportCardHead strong { display: block; font-size: 22px; margin-top: 3px; }
.reportMiniGrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 8px; }
.reportNote, .productivityHelp { margin-top: 16px; background: #f5fbf8; border: 1px solid var(--border); border-radius: 16px; padding: 14px; color: var(--muted); line-height: 1.5; }
.productivityHelp { margin: 0 0 16px; }
.productivityHelp strong { display: block; color: var(--dark); margin-bottom: 6px; }
.productivityHelp p { margin: 0; }
@media (max-width: 1120px) { .app { grid-template-columns: 1fr; } .sidebar { position: static; height: auto; } .sidebar nav { grid-template-columns: repeat(3, 1fr); } .syncBox { margin-top: 0; } .topbar, .reportHeader { flex-direction: column; align-items: stretch; } .actions { justify-content: flex-start; } .filterPanel { grid-template-columns: repeat(2, 1fr); } .agentHero { flex-direction: column; align-items: stretch; } .agentGrid, .reportGrid { grid-template-columns: 1fr; } .balanceGrid, .reportMiniGrid { grid-template-columns: repeat(2, 1fr); } .profileGrid, .requestPreview { grid-template-columns: repeat(2, 1fr); } .metrics, .grid.two, .grid.split, .grid.split.reverse { grid-template-columns: 1fr; } }
@media (max-width: 640px) { main, .sidebar { padding: 14px; } .filterPanel, .metrics, .profileGrid, .requestPreview, .reportMiniGrid, .inlineForm, .describedField { grid-template-columns: 1fr; } .currentStatus, .agentActions, .balanceGrid { grid-template-columns: 1fr; } .sidebar nav { grid-template-columns: 1fr; } .employeeFooter { flex-direction: column; align-items: flex-start; } .search { min-width: 0; width: 100%; } .card header { flex-direction: column; align-items: stretch; } }
`;
