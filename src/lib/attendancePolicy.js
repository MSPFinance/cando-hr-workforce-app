// Attendance-policy calculations are separate from payroll payable-hour rules.
// Treat only approved Planned PTO/VTO, Sick Leave and Prize Leave as excused.
const EXCUSED_LOG_CATEGORIES = new Set([
  "pto - planned",
  "vto - planned",
  "sick leave",
  "sick leave - early leave",
  "prize - early leave",
]);

const FULL_DAY_EXCUSED_REQUESTS = new Set([
  "pto - planned",
  "vto - planned",
  "sick leave",
]);

const normalize = (value) => String(value || "").trim().toLowerCase();

export function isApprovedExcusedAttendanceLog(category, approvalStatus) {
  return EXCUSED_LOG_CATEGORIES.has(normalize(category)) &&
    ["approved", "approve"].includes(normalize(approvalStatus));
}

export function hasApprovedFullDayAttendanceRequest(
  requests,
  employeeIds,
  activityDate,
  scheduledMinutes,
  coversDate
) {
  if (scheduledMinutes <= 0) return false;
  const ids = new Set(employeeIds.map((id) => String(id || "").trim()).filter(Boolean));
  return requests.some((request) => {
    const employeeId = String(request.employee_id || request.Employee_ID || "").trim();
    const type = normalize(request.type || request.request_type || request.Request_Type);
    const status = normalize(request.status || request.approval_status || request.Status);
    if (!ids.has(employeeId) || status !== "approved" ||
        !FULL_DAY_EXCUSED_REQUESTS.has(type) ||
        !coversDate(request, activityDate)) return false;

    // Do not assume that a request explicitly made for fewer hours
    // than the shift should excuse the entire day. Partial requests
    // require their approved time-log intervals for exact coverage.
    const totalHours = Number(request.requested_hours);
    const requestedDays = Number(request.requested_days);
    if (Number.isFinite(totalHours) && totalHours > 0) {
      const hoursPerDay = requestedDays > 0 ? totalHours / requestedDays : totalHours;
      return hoursPerDay * 60 >= scheduledMinutes - 0.5;
    }
    return true;
  });
}

function mergeIntervals(intervals) {
  const sorted = intervals
    .filter((i) => i && Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

const minutes = (intervals) =>
  intervals.reduce((sum, range) => sum + range.end - range.start, 0);

export function calculateExcusedAttendance({
  scheduleRange,
  attendanceIntervals = [],
  excusedIntervals = [],
  fullDayExcused = false,
}) {
  if (!scheduleRange ||
      !Number.isFinite(scheduleRange.start) ||
      !Number.isFinite(scheduleRange.end) ||
      scheduleRange.end <= scheduleRange.start) {
    return {
      scheduledMinutes: 0, attendedMinutes: 0,
      excusedUncoveredMinutes: 0, eligibleMinutes: 0,
      attendancePercent: 0, fullyExcused: false,
    };
  }
  const scheduledMinutes = scheduleRange.end - scheduleRange.start;
  const clip = (intervals) => mergeIntervals(intervals.map((interval) => ({
    start: Math.max(scheduleRange.start, interval.start),
    end: Math.min(scheduleRange.end, interval.end),
  })));
  const attended = clip(attendanceIntervals);
  const excused = fullDayExcused ? [scheduleRange] : clip(excusedIntervals);
  const attendedMinutes = minutes(attended);
  // Only excused minutes that were not already covered by presence
  // reduce the denominator. This prevents overlapping/double credit.
  const coveredOrExcusedMinutes = minutes(mergeIntervals([...attended, ...excused]));
  const excusedUncoveredMinutes = Math.max(0, coveredOrExcusedMinutes - attendedMinutes);
  const eligibleMinutes = Math.max(0, scheduledMinutes - excusedUncoveredMinutes);
  const attendancePercent = eligibleMinutes > 0
    ? Math.min(100, Math.max(0, attendedMinutes / eligibleMinutes * 100))
    : 100;
  return {
    scheduledMinutes, attendedMinutes, excusedUncoveredMinutes,
    eligibleMinutes, attendancePercent, fullyExcused: eligibleMinutes === 0,
  };
}
