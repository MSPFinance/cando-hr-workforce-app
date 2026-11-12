import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateExcusedAttendance, hasApprovedFullDayAttendanceRequest,
  isApprovedExcusedAttendanceLog,
} from "./attendancePolicy.js";

const score = (actual, excused, fullDayExcused = false) =>
  calculateExcusedAttendance({
    scheduleRange: {start: 0, end: 600},
    attendanceIntervals: actual,
    excusedIntervals: excused,
    fullDayExcused,
  });

test("approved prize leave after work removes missed leave minutes", () => {
  const a = score([{start:0,end:480}], [{start:480,end:600}]);
  assert.equal(a.attendancePercent,100);
  assert.equal(a.excusedUncoveredMinutes,120);
  assert.equal(a.eligibleMinutes,480);
});
test("overlapping worked and leave time is not credited twice", () => {
  const a = score([{start:0,end:540}], [{start:0,end:60}]);
  assert.equal(a.excusedUncoveredMinutes,0);
  assert.equal(a.attendancePercent,90);
});
test("partial overlap credits only uncovered portion", () => {
  const a = score([{start:0,end:480}], [{start:390,end:600}]);
  assert.equal(a.excusedUncoveredMinutes,120);
  assert.equal(a.attendancePercent,100);
});
test("unplanned and denied leave remain penalized", () => {
  const a = score([{start:0,end:480}], []);
  assert.equal(a.attendancePercent,80);
  assert.equal(isApprovedExcusedAttendanceLog("pto - unplanned","approved"),false);
  assert.equal(isApprovedExcusedAttendanceLog("prize - early leave","denied"),false);
  assert.equal(isApprovedExcusedAttendanceLog("sick leave","pending"),false);
});
test("approved sick and prize leave are independent of payroll payable status", () => {
  assert.equal(isApprovedExcusedAttendanceLog("prize - early leave","approved"),true);
  assert.equal(isApprovedExcusedAttendanceLog("sick leave - early leave","approved"),true);
  assert.equal(isApprovedExcusedAttendanceLog("pto - planned","approved"),true);
  assert.equal(isApprovedExcusedAttendanceLog("pto","approved"),false);
});
test("full-day approved sick is excused without worked-hour inflation", () => {
  const a = score([],[],true);
  assert.equal(a.eligibleMinutes,0);
  assert.equal(a.attendedMinutes,0);
  assert.equal(a.attendancePercent,100);
  assert.equal(a.fullyExcused,true);
});
test("overlapping approved leave entries are merged", () => {
  const a = score([{start:0,end:420}], [{start:420,end:540},{start:480,end:600}]);
  assert.equal(a.excusedUncoveredMinutes,180);
  assert.equal(a.attendancePercent,100);
});
test("request classification distinguishes approved planned from unplanned and partial", () => {
  const mk = (request_type, status="Approved", requested_hours=10) => ({
    employee_id:"123",request_type,status,requested_hours,requested_days:1
  });
  const match = (requests) => hasApprovedFullDayAttendanceRequest(requests,["123"],"2026-11-10",600,()=>true);
  assert.equal(match([mk("PTO - Planned")]),true);
  assert.equal(match([mk("VTO - Unplanned")]),false);
  assert.equal(match([mk("Sick Leave","Pending")]),false);
  assert.equal(match([mk("Sick Leave","Approved",2)]),false);
});

test("user schedule regression: 570 scheduled minutes, 60 approved sick, 510 worked", () => {
  const a = calculateExcusedAttendance({
    scheduleRange:{start:0,end:570},
    attendanceIntervals:[{start:0,end:510}],
    excusedIntervals:[{start:510,end:570}],
  });
  assert.equal(a.attendancePercent,100);
  assert.equal(a.attendedMinutes,510);
  assert.equal(a.eligibleMinutes,510);
});
test("user schedule regression: denied leave never excuses missed time", () => {
  const a = calculateExcusedAttendance({
    scheduleRange:{start:0,end:570},
    attendanceIntervals:[{start:0,end:510}],
    excusedIntervals:[],
  });
  assert.equal(Math.round(a.attendancePercent*100)/100,89.47);
});
