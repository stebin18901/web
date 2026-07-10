import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
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
  loadStudentsForClass,
  normalizeClassName,
  normalizeSchoolId,
  normalizeSection,
  splitClassAndDivision,
  resolveSchoolClasses,
  resolveTeacherAcademicScope,
} from "./academicUtils";

const AttendancePage = ({ schoolId, mode = "school_admin", teacher = null, actorName = "School Admin" }) => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [rows, setRows] = useState([]);
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedDate, setSelectedDate] = useState(formatDateInput());
  const [selectedMonth, setSelectedMonth] = useState(formatMonthInput());
  const [searchTerm, setSearchTerm] = useState("");
  const [historyStudentId, setHistoryStudentId] = useState("");
  const [activeTab, setActiveTab] = useState("marking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadScope = async () => {
      setLoading(true);
      try {
        if (mode === "teacher" && teacher) {
          const scope = await resolveTeacherAcademicScope(teacher);
          if (!scope.canTakeAttendance) {
            setClasses([]);
            setToast({ type: "error", message: "Only class teachers can manage attendance." });
          } else {
            setClasses(scope.classes);
            setSelectedClass(scope.classes[0]?.className || "");
            setSelectedSection(scope.classes[0]?.section || "");
          }
        } else {
          const schoolClasses = await resolveSchoolClasses(schoolId);
          setClasses(schoolClasses);
          setSelectedClass(schoolClasses[0]?.className || "");
          setSelectedSection(schoolClasses[0]?.section || "");
        }
      } catch (error) {
        setToast({ type: "error", message: error.message || "Failed to load attendance scope." });
      } finally {
        setLoading(false);
      }
    };
    loadScope();
  }, [mode, schoolId, teacher]);

  useEffect(() => {
    if (!selectedClass) {
      setSelectedSection("");
      return;
    }
    const matchingSections = classes
      .filter((entry) => entry.className === selectedClass)
      .map((entry) => entry.section)
      .filter(Boolean);

    if (!matchingSections.length) {
      setSelectedSection("");
      return;
    }

    if (!selectedSection || !matchingSections.includes(selectedSection)) {
      setSelectedSection(matchingSections[0] || "");
    }
  }, [classes, selectedClass, selectedSection]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!selectedClass) {
        setStudents([]);
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const nextStudents = await loadStudentsForClass({
          schoolId,
          className: selectedClass,
          section: selectedSection,
        });
        setStudents(nextStudents);

        const docId = buildAttendanceDocId({
          date: selectedDate,
          className: selectedClass,
          section: selectedSection,
        });
        const attendanceRef = doc(db, "schools", normalizeSchoolId(schoolId), "attendance", docId);
        const snap = await getDoc(attendanceRef);
        const existingRecords = snap.exists() ? snap.data().records || [] : [];

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
  }, [schoolId, selectedClass, selectedDate, selectedSection]);

  useEffect(() => {
    const loadDocs = async () => {
      if (!schoolId) return;
      try {
        const snap = await getDocs(collection(db, "schools", normalizeSchoolId(schoolId), "attendance"));
        const docs = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        setAttendanceDocs(docs);
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load attendance records." });
      }
    };
    loadDocs();
  }, [schoolId, saving]);

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
    setRows((prev) => prev.map((row) => (row.studentId === studentId ? { ...row, ...patch } : row)));
    setDirty(true);
  };

  const applyBulkStatus = (status) => {
    setRows((prev) => prev.map((row) => ({ ...row, status, note: status === "present" ? "" : row.note })));
    setDirty(true);
  };

  const handleReset = () => {
    setRows((prev) => prev.map((row) => ({ ...row, status: "present", note: "" })));
    setDirty(true);
  };

  const handleSave = async () => {
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
      const docId = buildAttendanceDocId({ date: selectedDate, className: selectedClass, section: selectedSection });
      const attendanceRef = doc(db, "schools", normalizedId, "attendance", docId);
      const existingSnap = await getDoc(attendanceRef);
      const payload = {
        schoolId: normalizedId,
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
        createdBy: actorName,
        createdByRole: getRoleLabel(mode === "teacher" ? teacher?.role : "school_admin"),
        updatedAt: serverTimestamp(),
      };
      if (!existingSnap.exists()) {
        payload.createdAt = serverTimestamp();
      }
      await setDoc(attendanceRef, payload, { merge: true });
      await syncAttendanceNotifications({
        schoolId: normalizedId,
        className: selectedClass,
        section: selectedSection,
        date: selectedDate,
        rows,
      });
      setDirty(false);
      setToast({ type: "success", message: "Attendance saved successfully." });
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
      <section className="academic-hero">
        <div>
          <p className="academic-kicker">Academic Layer</p>
          <h1>Attendance Management</h1>
          <p>Fast daily attendance, simple monthly review, and student-wise history built for real school staff.</p>
        </div>
        <div className="academic-hero-badge">
          <span>Access</span>
          <strong>{mode === "teacher" ? getRoleLabel(teacher?.role) : "School Admin"}</strong>
        </div>
      </section>

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
        selectedSection={selectedSection}
        selectedDate={selectedDate}
        searchTerm={searchTerm}
        onClassChange={setSelectedClass}
        onSectionChange={setSelectedSection}
        onDateChange={setSelectedDate}
        onSearchChange={setSearchTerm}
        onMarkAllPresent={() => applyBulkStatus("present")}
        onMarkAllAbsent={() => applyBulkStatus("absent")}
        onReset={handleReset}
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
              <strong>{dirty ? "Unsaved changes" : "All changes saved"}</strong>
              <p>{summary.totalStudents} students loaded for {selectedClass || "the selected class roster"}.</p>
            </div>
            <button type="button" className="academic-btn" onClick={handleSave} disabled={saving || !rows.length}>
              {saving ? "Saving..." : "Save Attendance"}
            </button>
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

      {toast ? <div className={`academic-toast tone-${toast.type === "error" ? "danger" : toast.type === "success" ? "success" : "info"}`}>{toast.message}</div> : null}
    </div>
  );
};

export default AttendancePage;
