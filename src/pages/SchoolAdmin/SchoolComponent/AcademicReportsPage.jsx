import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./AcademicManagement.css";
import AttendanceReports from "./AttendanceReports";
import MarksReports from "./MarksReports";
import StudentAttentionList from "./StudentAttentionList";
import { normalizeSchoolId, resolveTeacherAcademicScope } from "./academicUtils";

const AcademicReportsPage = ({ schoolId, mode = "school_admin", teacher = null }) => {
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [examDocs, setExamDocs] = useState([]);
  const [allowedClasses, setAllowedClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadScope = async () => {
      if (mode === "teacher" && teacher) {
        const scope = await resolveTeacherAcademicScope(teacher);
        setAllowedClasses(scope.classes.map((entry) => entry.className));
      } else {
        setAllowedClasses([]);
      }
    };
    loadScope();
  }, [mode, teacher]);

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      try {
        const normalizedId = normalizeSchoolId(schoolId);
        const [attendanceSnap, examSnap] = await Promise.all([
          getDocs(collection(db, "schools", normalizedId, "attendance")),
          getDocs(collection(db, "schools", normalizedId, "examMarks")),
        ]);

        const attendanceRows = attendanceSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        const examRows = examSnap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));

        const classFilter = (entry) =>
          !allowedClasses.length || allowedClasses.includes(String(entry.className || "").toUpperCase());

        setAttendanceDocs(attendanceRows.filter(classFilter));
        setExamDocs(examRows.filter(classFilter));
      } finally {
        setLoading(false);
      }
    };
    loadReports();
  }, [allowedClasses, schoolId]);

  const todayLabel = new Date().toISOString().slice(0, 10);
  const monthPrefix = todayLabel.slice(0, 7);

  const todayAttendance = useMemo(() => {
    const docs = attendanceDocs.filter((entry) => entry.date === todayLabel);
    if (!docs.length) return 0;
    return Number(
      (
        docs.reduce((sum, entry) => sum + Number(entry.summary?.attendancePercentage || 0), 0) /
        docs.length
      ).toFixed(1)
    );
  }, [attendanceDocs, todayLabel]);

  const monthAttendance = useMemo(() => {
    const docs = attendanceDocs.filter((entry) => String(entry.date || "").startsWith(monthPrefix));
    if (!docs.length) return 0;
    return Number(
      (
        docs.reduce((sum, entry) => sum + Number(entry.summary?.attendancePercentage || 0), 0) /
        docs.length
      ).toFixed(1)
    );
  }, [attendanceDocs, monthPrefix]);

  const topPerformingClass = useMemo(() => {
    const classMap = {};
    examDocs.forEach((entry) => {
      const key = entry.className || "Unknown";
      if (!classMap[key]) classMap[key] = [];
      classMap[key].push(Number(entry.summary?.classAverage || 0));
    });
    const rows = Object.entries(classMap).map(([label, values]) => ({
      label,
      value: Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(1)),
    }));
    return rows.sort((a, b) => b.value - a.value)[0] || { label: "N/A", value: 0 };
  }, [examDocs]);

  const recentMarks = useMemo(
    () =>
      examDocs
        .slice()
        .sort((a, b) => String(b.updatedAt?.seconds || b.updatedAt || "").localeCompare(String(a.updatedAt?.seconds || a.updatedAt || "")))
        .slice(0, 5),
    [examDocs]
  );

  const attendanceTrend = useMemo(
    () =>
      attendanceDocs
        .slice()
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(-7)
        .map((entry) => ({
          label: entry.date,
          value: Number(entry.summary?.attendancePercentage || 0),
        })),
    [attendanceDocs]
  );

  const classWiseAttendance = useMemo(() => {
    const classMap = {};
    attendanceDocs.forEach((entry) => {
      const key = entry.className || "Unknown";
      if (!classMap[key]) classMap[key] = [];
      classMap[key].push(Number(entry.summary?.attendancePercentage || 0));
    });
    return Object.entries(classMap).map(([label, values]) => ({
      label,
      value: Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(1)),
    }));
  }, [attendanceDocs]);

  const subjectAverages = useMemo(() => {
    const subjectMap = {};
    examDocs.forEach((exam) => {
      (exam.summary?.subjectAverages || []).forEach((subjectRow) => {
        if (!subjectMap[subjectRow.subject]) subjectMap[subjectRow.subject] = [];
        subjectMap[subjectRow.subject].push(Number(subjectRow.average || 0));
      });
    });
    return Object.entries(subjectMap).map(([label, values]) => ({
      label,
      value: Number((values.reduce((sum, item) => sum + item, 0) / values.length).toFixed(1)),
    }));
  }, [examDocs]);

  const attentionItems = useMemo(() => {
    const items = [];
    attendanceDocs.forEach((docEntry) => {
      (docEntry.records || []).forEach((record) => {
        if (record.status === "absent") {
          items.push({
            studentId: record.studentId,
            fullName: record.fullName,
            className: docEntry.className,
            section: docEntry.section,
            reason: `Absent on ${docEntry.date}`,
          });
        }
      });
    });
    examDocs.forEach((exam) => {
      (exam.records || []).forEach((record) => {
        if (Number(record.percentage || 0) < 40) {
          items.push({
            studentId: record.studentId,
            fullName: record.fullName,
            className: exam.className,
            section: exam.section,
            reason: `${exam.examName || exam.examType}: ${record.percentage}%`,
          });
        }
      });
    });
    return items.slice(0, 12);
  }, [attendanceDocs, examDocs]);

  const overviewCards = [
    { label: "Today's Attendance", value: `${todayAttendance}%` },
    { label: "This Month Attendance", value: `${monthAttendance}%` },
    { label: "Recent Marks Uploads", value: recentMarks.length },
    { label: "Top Performing Class", value: topPerformingClass.label },
    { label: "Students Needing Attention", value: attentionItems.length },
  ];

  return (
    <div className="academic-page">
      <section className="academic-hero">
        <div>
          <p className="academic-kicker">Academic Layer</p>
          <h1>Academic Reports</h1>
          <p>Attendance and marks insights for quick academic follow-up without leaving the dashboard.</p>
        </div>
        <div className="academic-hero-badge">
          <span>Scope</span>
          <strong>{mode === "teacher" ? "Teacher View" : "School Overview"}</strong>
        </div>
      </section>

      {loading ? (
        <div className="academic-state">Loading academic reports...</div>
      ) : (
        <>
          <section className="academic-summary-grid">
            {overviewCards.map((card) => (
              <article key={card.label} className="academic-summary-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="academic-chart-grid">
            <AttendanceReports items={attendanceTrend} title="Attendance Trend" />
            <AttendanceReports items={classWiseAttendance} title="Class-wise Attendance" />
            <MarksReports items={subjectAverages} title="Subject-wise Average" />
            <MarksReports
              items={recentMarks.map((entry) => ({
                label: `${entry.examName || entry.examType} - ${entry.className}`,
                value: Number(entry.summary?.classAverage || 0),
              }))}
              title="Recent Exam Performance"
            />
          </section>

          <StudentAttentionList items={attentionItems} />
        </>
      )}
    </div>
  );
};

export default AcademicReportsPage;
