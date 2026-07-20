import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./AcademicManagement.css";
import AttendanceFilters from "./AttendanceFilters";
import AttendanceSummaryCards from "./AttendanceSummaryCards";
import AttendanceMarkingTable from "./AttendanceMarkingTable";
import AttendanceHistory from "./AttendanceHistory";
import MonthlyAttendanceView from "./MonthlyAttendanceView";
import { syncAttendanceNotifications } from "./parentNotificationUtils";
import {
  buildAttendanceDocId,
  formatDateInput,
  formatMonthInput,
  getAttendanceSummary,
  getRoleLabel,
  getWorkflowStatusMeta,
  isWorkflowLocked,
  loadStudentsForClass,
  normalizeClassName,
  normalizeSchoolId,
  normalizeSection,
  splitClassAndDivision,
  resolveSchoolClasses,
  resolveTeacherAcademicScope,
} from "./academicUtils";
import { normalizeAcademicYear } from "./schoolYearUtils";

const normalize = (value) => String(value || "").trim();

const AttendancePage = ({ schoolId, academicYear = "", mode = "school_admin", teacher = null, actorName = "School Admin" }) => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [selectedMonth, setSelectedMonth] = useState(formatMonthInput());
  const [searchTerm, setSearchTerm] = useState("");
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [activeTab, setActiveTab] = useState("marking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmBulkAction, setConfirmBulkAction] = useState(null);
  const [workflowStatus, setWorkflowStatus] = useState("draft");
  const normalizedAcademicYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  useEffect(() => {
    const loadScope = async () => {
      setLoading(true);
      try {
        if (mode === "teacher" && teacher) {
          const scope = await resolveTeacherAcademicScope({ ...teacher, academicYear: normalizedAcademicYear });
          if (!scope.canTakeAttendance) {
            setClasses([]);
            setToast({ type: "error", message: "Only class teachers can manage attendance." });
          } else {
            const uniqueClasses = scope.classes.filter(
              (entry, index, list) =>
                index === list.findIndex((item) => normalizeClassName(item.className) === normalizeClassName(entry.className))
            );
            setClasses(uniqueClasses);
            setSelectedClass(uniqueClasses[0]?.className || "");
          }
        } else {
          const schoolClasses = await resolveSchoolClasses(schoolId, normalizedAcademicYear);
          const uniqueClasses = schoolClasses.filter(
            (entry, index, list) =>
              index === list.findIndex((item) => normalizeClassName(item.className) === normalizeClassName(entry.className))
          );
          setClasses(uniqueClasses);
          setSelectedClass(uniqueClasses[0]?.className || "");
        }
      } catch (error) {
        setToast({ type: "error", message: error.message || "Failed to load attendance scope." });
      } finally {
        setLoading(false);
      }
    };
    loadScope();
  }, [mode, normalizedAcademicYear, schoolId, teacher]);

  const selectedSection = useMemo(() => {
    if (!selectedClass) return "";
    const matchedClass = classes.find((entry) => entry.className === selectedClass);
    if (matchedClass?.section) return matchedClass.section;
    return splitClassAndDivision(selectedClass)?.division || "";
  }, [classes, selectedClass]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) {
        setStudents([]);
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        let nextStudents = await loadStudentsForClass({
          schoolId,
          className: selectedClass,
          section: selectedSection,
          academicYear: normalizedAcademicYear,
        });

        if (!nextStudents.length && selectedSection) {
          nextStudents = await loadStudentsForClass({
            schoolId,
            className: selectedClass,
            section: "",
            academicYear: normalizedAcademicYear,
          });
        }

        if (!nextStudents.length) {
          const classParts = splitClassAndDivision(selectedClass);
          const alternateClassName = classParts?.grade || selectedClass;
          if (alternateClassName && normalizeClassName(alternateClassName) !== normalizeClassName(selectedClass)) {
            nextStudents = await loadStudentsForClass({
              schoolId,
              className: alternateClassName,
              section: selectedSection,
              academicYear: normalizedAcademicYear,
            });
          }
        }

        if (!nextStudents.length) {
          const candidateSchoolIds = Array.from(
            new Set([normalizeSchoolId(schoolId), normalize(schoolId)].filter(Boolean).map((value) => normalizeSchoolId(value)))
          );
          const requestedClass = normalizeClassName(selectedClass);
          const requestedSection = normalizeSection(selectedSection);
          const requestedParts = splitClassAndDivision(requestedClass);
          const snapshots = await Promise.all(
            candidateSchoolIds.map((candidate) =>
              getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", candidate)))
            )
          );
          const fallbackMap = new Map();

          snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((entry) => {
              const data = entry.data() || {};
              const entryYear = normalizeAcademicYear(data.academicYear);
              if (normalizedAcademicYear && entryYear && entryYear !== normalizedAcademicYear) return;

              const entryClass = normalizeClassName(data.className || data.class || data.grade);
              const entrySection = normalizeSection(data.section || data.classSection || data.division);
              const entryParts = splitClassAndDivision(entryClass);

              const classMatches =
                entryClass === requestedClass ||
                (requestedParts.grade && entryParts.grade === requestedParts.grade) ||
                entryParts.combined === requestedClass;
              const sectionMatches =
                !requestedSection ||
                entrySection === requestedSection ||
                entryParts.division === requestedSection ||
                entryClass === requestedClass;

              if (!classMatches || !sectionMatches) return;

              fallbackMap.set(entry.id, {
                studentId: entry.id,
                fullName: normalize(data.fullName || data.name),
                rollNumber: normalize(data.rollNumber || data.studentId),
                className: normalizeClassName(data.className || selectedClass),
                section: normalizeSection(data.section || data.classSection || data.division || selectedSection),
                phone: normalize(data.phone || data.parentPhone),
                email: normalize(data.email).toLowerCase(),
              });
            });
          });

          nextStudents = Array.from(fallbackMap.values()).sort((left, right) =>
            String(left.rollNumber || "").localeCompare(String(right.rollNumber || ""), undefined, { numeric: true })
          );
        }

        setStudents(nextStudents);

        const docId = `${normalizeAcademicYear(normalizedAcademicYear || "general")}_${buildAttendanceDocId({
          date: selectedDate,
          className: selectedClass,
          section: selectedSection,
        })}`;
        const attendanceRef = doc(db, "schools", normalizeSchoolId(schoolId), "attendance", docId);
        const snap = await getDoc(attendanceRef);
        const existingRecords = snap.exists() ? snap.data().records || [] : [];
        setWorkflowStatus(String(snap.data()?.workflowStatus || "draft").toLowerCase());

        const mappedRows = nextStudents.map((student) => {
          const existing = existingRecords.find(
            (record) =>
              record.studentId === student.studentId ||
              (String(record.rollNumber || "").trim() === String(student.rollNumber || "").trim() &&
                String(record.fullName || "").trim().toLowerCase() === String(student.fullName || "").trim().toLowerCase())
          );
          return {
            ...student,
            status: existing?.status || "present",
            note: existing?.note || "",
          };
        });
        setRows(mappedRows);
        setDirty(false);
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load students." });
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, [normalizedAcademicYear, schoolId, selectedClass, selectedDate, selectedSection]);

  useEffect(() => {
    const loadDocs = async () => {
      if (!schoolId) return;
      try {
        const snap = await getDocs(collection(db, "schools", normalizeSchoolId(schoolId), "attendance"));
        const docs = snap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter((entry) => !normalizedAcademicYear || normalizeAcademicYear(entry.academicYear) === normalizedAcademicYear);
        setAttendanceDocs(docs);
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load attendance records." });
      }
    };
    loadDocs();
  }, [normalizedAcademicYear, schoolId, saving]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!dirty) return undefined;
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const summary = useMemo(() => getAttendanceSummary(rows), [rows]);
  const workflowMeta = useMemo(() => getWorkflowStatusMeta(workflowStatus), [workflowStatus]);
  const lockedForEditing = useMemo(() => isWorkflowLocked(workflowStatus), [workflowStatus]);

  const filteredRows = useMemo(() => {
    const lower = searchTerm.trim().toLowerCase();
    if (!lower) return rows;
    return rows.filter(
      (row) =>
        String(row.fullName || "").toLowerCase().includes(lower) ||
        String(row.rollNumber || "").toLowerCase().includes(lower)
    );
  }, [rows, searchTerm]);

  const monthlyDocs = useMemo(
    () =>
      attendanceDocs.filter((entry) => String(entry.date || "").startsWith(selectedMonth)).filter((entry) => {
        if (selectedClass && normalizeClassName(entry.className) !== normalizeClassName(selectedClass)) return false;
        if (selectedSection && normalizeSection(entry.section) !== normalizeSection(selectedSection)) return false;
        return true;
      }),
    [attendanceDocs, selectedClass, selectedMonth, selectedSection]
  );

  const historyRows = useMemo(
    () =>
      attendanceDocs
        .filter((entry) => {
          if (selectedClass && normalizeClassName(entry.className) !== normalizeClassName(selectedClass)) return false;
          if (selectedSection && normalizeSection(entry.section) !== normalizeSection(selectedSection)) return false;
          return true;
        })
        .flatMap((entry) =>
          (entry.records || []).map((record) => ({
            ...record,
            date: entry.date,
          }))
        )
        .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
    [attendanceDocs, selectedClass, selectedSection]
  );

  const updateRow = (studentId, patch) => {
    if (lockedForEditing) return;
    setRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const applyBulkStatus = (status) => {
    if (lockedForEditing) return;
    setRows((prev) => prev.map((row) => ({ ...row, status, note: status === "present" ? "" : row.note })));
    setDirty(true);
  };

  const handleReset = () => {
    if (lockedForEditing) return;
    setRows((prev) => prev.map((row) => ({ ...row, status: "present", note: "" })));
    setDirty(true);
  };

  const requestBulkAttendanceAction = (type) => {
    if (!rows.length) return;

    const config =
      type === "present"
        ? {
            title: "Mark all students present?",
            message: `This will update all ${rows.length} loaded students to present for ${selectedDate}.`,
            confirmLabel: "Mark All Present",
            action: () => applyBulkStatus("present"),
          }
        : type === "absent"
          ? {
              title: "Mark all students absent?",
              message: `This will update all ${rows.length} loaded students to absent for ${selectedDate}.`,
              confirmLabel: "Mark All Absent",
              action: () => applyBulkStatus("absent"),
            }
          : {
              title: "Reset attendance changes?",
              message: `This will reset all ${rows.length} loaded students back to present in the current editor.`,
              confirmLabel: "Reset Attendance",
              action: handleReset,
            };

    setConfirmBulkAction(config);
  };

  const handleSave = async (nextWorkflowStatus = workflowStatus) => {
    if (!selectedClass || !selectedDate) {
      setToast({ type: "error", message: "Select class and date before saving attendance." });
      return;
    }
    setSaving(true);
    try {
      const normalizedId = normalizeSchoolId(schoolId);
      const classParts = splitClassAndDivision(selectedClass);
      const resolvedClassKey =
        normalizeSection(selectedSection) && classParts.grade && classParts.division !== normalizeSection(selectedSection)
          ? `${classParts.grade}${normalizeSection(selectedSection)}`
          : normalizeClassName(selectedClass);
      const docId = `${normalizeAcademicYear(normalizedAcademicYear || "general")}_${buildAttendanceDocId({ date: selectedDate, className: selectedClass, section: selectedSection })}`;
      const attendanceRef = doc(db, "schools", normalizedId, "attendance", docId);
      const existingSnap = await getDoc(attendanceRef);
      const payload = {
        schoolId: normalizedId,
        academicYear: normalizedAcademicYear,
        className: normalizeClassName(selectedClass),
        section: normalizeSection(selectedSection),
        date: selectedDate,
        records: rows.map((row) => ({
          studentId: `${normalizedId}_${resolvedClassKey}_${String(row.rollNumber || "").trim()}`.toLowerCase(),
          fullName: row.fullName,
          rollNumber: row.rollNumber,
          className: row.className || normalizeClassName(selectedClass),
          section: row.section || normalizeSection(selectedSection),
          phone: row.phone || "",
          email: row.email || "",
          status: row.status,
          note: row.note || "",
        })),
        summary,
        workflowStatus: String(nextWorkflowStatus || "draft").toLowerCase(),
        createdBy: actorName,
        createdByRole: getRoleLabel(mode === "teacher" ? teacher?.role : "school_admin"),
        updatedAt: serverTimestamp(),
      };
      if (String(nextWorkflowStatus || "").toLowerCase() === "finalized") {
        payload.finalizedAt = serverTimestamp();
        payload.finalizedBy = actorName;
      }
      if (String(nextWorkflowStatus || "").toLowerCase() === "locked") {
        payload.lockedAt = serverTimestamp();
        payload.lockedBy = actorName;
      }
      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }
      await setDoc(attendanceRef, payload, { merge: true });
      await syncAttendanceNotifications({
        schoolId: normalizedId,
        academicYear: normalizedAcademicYear,
        className: selectedClass,
        section: selectedSection,
        date: selectedDate,
        rows,
      });
      setWorkflowStatus(String(nextWorkflowStatus || "draft").toLowerCase());
      setDirty(false);
      setToast({
        type: "success",
        message:
          String(nextWorkflowStatus || "").toLowerCase() === "finalized"
            ? "Attendance finalized and locked."
            : "Attendance saved successfully.",
      });
    } catch (error) {
      setToast({ type: "error", message: error.message || "Unable to save attendance." });
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const headers = ["Date", "Class", "Section", "Roll Number", "Student Name", "Status", "Note"];
    const lines = rows.map((row) =>
      [selectedDate, selectedClass, selectedSection || "-", row.rollNumber, row.fullName, row.status, row.note || ""]
        .map((item) => `"${String(item).replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${selectedClass}_${selectedDate}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="academic-page">
      <div className="academic-tabs">
        <button type="button" className={activeTab === "marking" ? "active" : ""} onClick={() => setActiveTab("marking")}>
          Mark Attendance
        </button>
        <button type="button" className={activeTab === "monthly" ? "active" : ""} onClick={() => setActiveTab("monthly")}>
          Monthly View
        </button>
        <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
          Student History
        </button>
      </div>

      <AttendanceFilters
        classes={classes}
        selectedClass={selectedClass}
        selectedDate={selectedDate}
        searchTerm={searchTerm}
        onClassChange={setSelectedClass}
        onDateChange={setSelectedDate}
        onSearchChange={setSearchTerm}
        onMarkAllPresent={() => requestBulkAttendanceAction("present")}
        onMarkAllAbsent={() => requestBulkAttendanceAction("absent")}
        onReset={() => requestBulkAttendanceAction("reset")}
        onExport={exportCsv}
      />

      {loading ? (
        <div className="academic-state">Loading attendance data...</div>
      ) : activeTab === "marking" ? (
        <>
          <AttendanceSummaryCards summary={summary} />
          {filteredRows.length ? (
            <AttendanceMarkingTable
              rows={filteredRows}
              onStatusChange={(studentId, status) => updateRow(studentId, { status })}
              onNoteChange={(studentId, note) => updateRow(studentId, { note })}
            />
          ) : (
            <div className="academic-state">No students found for this class.</div>
          )}
          <div className="academic-sticky-bar">
            <div>
              <div className="academic-workflow-line">
                <strong>{dirty ? "Unsaved changes" : "All changes saved"}</strong>
                <span className={`academic-workflow-pill tone-${workflowMeta.tone}`}>{workflowMeta.label}</span>
              </div>
              <p>
                {summary.totalStudents} students loaded for {selectedClass || "the selected class roster"}.
                {lockedForEditing ? " This sheet is locked for editing." : ""}
              </p>
            </div>
            <div className="academic-actions">
              {lockedForEditing ? (
                <button type="button" className="academic-btn-secondary" onClick={() => handleSave("draft")} disabled={saving || !rows.length}>
                  {saving ? "Reopening..." : "Reopen Sheet"}
                </button>
              ) : (
                <>
                  <button type="button" className="academic-btn-secondary" onClick={() => handleSave("draft")} disabled={saving || !rows.length}>
                    {saving ? "Saving..." : "Save Draft"}
                  </button>
                  <button type="button" className="academic-btn" onClick={() => handleSave("finalized")} disabled={saving || !rows.length}>
                    {saving ? "Finalizing..." : "Finalize Attendance"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      ) : activeTab === "monthly" ? (
        <>
          <section className="academic-card">
            <div className="academic-filter-grid compact">
              <div className="academic-field">
                <label>Month</label>
                <input className="academic-input" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
              </div>
            </div>
          </section>
          <MonthlyAttendanceView monthValue={selectedMonth} docs={monthlyDocs} />
        </>
      ) : (
        <AttendanceHistory
          students={students}
          history={historyRows}
          selectedStudentId={historyStudentId}
          onStudentChange={setHistoryStudentId}
        />
      )}

      {confirmBulkAction ? (
        <div className="academic-modal-overlay" onClick={() => setConfirmBulkAction(null)}>
          <div className="academic-modal" onClick={(event) => event.stopPropagation()}>
            <h4>{confirmBulkAction.title}</h4>
            <p>{confirmBulkAction.message}</p>
            <div className="academic-modal-actions">
              <button type="button" className="academic-btn-secondary" onClick={() => setConfirmBulkAction(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="academic-btn-danger"
                onClick={() => {
                  const action = confirmBulkAction.action;
                  setConfirmBulkAction(null);
                  action?.();
                }}
              >
                {confirmBulkAction.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`academic-toast tone-${toast.type === "error" ? "danger" : toast.type === "success" ? "success" : "info"}`}>{toast.message}</div> : null}
    </div>
  );
};

export default AttendancePage;
