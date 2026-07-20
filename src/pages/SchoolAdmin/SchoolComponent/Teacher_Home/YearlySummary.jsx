import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import "./YearlySummary.css";
import { normalizeAcademicYear } from "../schoolYearUtils";

const normalize = (value) => String(value || "").trim();
const normalizeLower = (value) => normalize(value).toLowerCase();

const toYear = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/\b(20\d{2})\b/);
    return match?.[1] || "";
  }
  if (value?.toDate) {
    return String(value.toDate().getFullYear());
  }
  if (value?.seconds) {
    return String(new Date(value.seconds * 1000).getFullYear());
  }
  if (value instanceof Date) {
    return String(value.getFullYear());
  }
  return "";
};

const average = (values = []) => {
  if (!values.length) return 0;
  return Number((values.reduce((sum, item) => sum + Number(item || 0), 0) / values.length).toFixed(1));
};

export default function YearlySummary({ schoolId, school, academicYear = "" }) {
  const [attendanceDocs, setAttendanceDocs] = useState([]);
  const [examDocs, setExamDocs] = useState([]);
  const [studentDocs, setStudentDocs] = useState([]);
  const [teacherDocs, setTeacherDocs] = useState([]);
  const [classDocs, setClassDocs] = useState([]);
  const [announcementDocs, setAnnouncementDocs] = useState([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [loading, setLoading] = useState(true);
  const normalizedYear = useMemo(() => normalizeAcademicYear(academicYear), [academicYear]);

  useEffect(() => {
    const loadAll = async () => {
      const normalizedSchoolId = normalizeLower(schoolId);
      const rawSchoolId = normalize(schoolId);
      const candidates = Array.from(new Set([normalizedSchoolId, rawSchoolId, normalizeLower(school?.schoolId), normalize(school?.schoolId)].filter(Boolean)));
      if (!candidates.length) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [
          attendanceSnap,
          examSnap,
          studentSnaps,
          teacherSnaps,
          classSnaps,
          announcementSnaps,
        ] = await Promise.all([
          getDocs(collection(db, "schools", normalizedSchoolId, "attendance")),
          getDocs(collection(db, "schools", normalizedSchoolId, "examMarks")),
          Promise.all(candidates.map((candidate) => getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", candidate))))),
          Promise.all(candidates.map((candidate) => getDocs(query(collection(db, "users"), where("schoolId", "==", candidate))))),
          Promise.all(candidates.map((candidate) => getDocs(query(collection(db, "classes"), where("schoolId", "==", candidate))))),
          Promise.all(candidates.map((candidate) => getDocs(query(collection(db, "announcements"), where("schoolId", "==", candidate))))),
        ]);

        setAttendanceDocs(
          attendanceSnap.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              ...data,
              year: normalizeAcademicYear(data.academicYear) || toYear(data.date),
            };
          })
        );
        setExamDocs(
          examSnap.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              ...data,
              year: normalizeAcademicYear(data.academicYear) || toYear(data.updatedAt || data.createdAt),
            };
          })
        );

        const flattenUnique = (snapshots, filterFn = null) => {
          const map = new Map();
          snapshots.forEach((snapshot) => {
            snapshot.docs.forEach((entry) => {
              const data = { id: entry.id, ...entry.data() };
              if (filterFn && !filterFn(data)) return;
              map.set(entry.id, data);
            });
          });
          return Array.from(map.values());
        };

        setStudentDocs(flattenUnique(studentSnaps));
        setTeacherDocs(flattenUnique(teacherSnaps, (entry) => ["teacher", "class_teacher"].includes(normalizeLower(entry.role))));
        setClassDocs(flattenUnique(classSnaps));
        setAnnouncementDocs(flattenUnique(announcementSnaps));
      } catch (error) {
        console.error("Failed to load yearly summary", error);
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [schoolId, school]);

  const yearOptions = useMemo(() => {
    const years = new Set([
      ...attendanceDocs.map((entry) => entry.year),
      ...examDocs.map((entry) => entry.year),
      ...studentDocs.map((entry) => toYear(entry.createdAt)),
      ...teacherDocs.map((entry) => toYear(entry.createdAt)),
      ...announcementDocs.map((entry) => toYear(entry.createdAt || entry.updatedAt)),
    ].filter(Boolean));

    return Array.from(years).sort((left, right) => Number(right) - Number(left));
  }, [announcementDocs, attendanceDocs, examDocs, studentDocs, teacherDocs]);

  useEffect(() => {
    if (normalizedYear && normalizedYear !== selectedYear) {
      setSelectedYear(normalizedYear);
      return;
    }
    if (!selectedYear && yearOptions.length) {
      setSelectedYear(yearOptions[0]);
    }
  }, [normalizedYear, selectedYear, yearOptions]);

  const yearAttendanceDocs = useMemo(
    () => attendanceDocs.filter((entry) => !selectedYear || entry.year === selectedYear),
    [attendanceDocs, selectedYear]
  );

  const yearExamDocs = useMemo(
    () => examDocs.filter((entry) => !selectedYear || entry.year === selectedYear),
    [examDocs, selectedYear]
  );

  const yearStudents = useMemo(
    () => studentDocs.filter((entry) => !selectedYear || normalizeAcademicYear(entry.academicYear) === selectedYear || toYear(entry.createdAt) === selectedYear),
    [selectedYear, studentDocs]
  );

  const yearTeachers = useMemo(
    () => teacherDocs.filter((entry) => !selectedYear || normalizeAcademicYear(entry.academicYear) === selectedYear || toYear(entry.createdAt) === selectedYear),
    [selectedYear, teacherDocs]
  );

  const yearClasses = useMemo(
    () => classDocs.filter((entry) => !selectedYear || normalizeAcademicYear(entry.academicYear) === selectedYear || toYear(entry.createdAt) === selectedYear),
    [classDocs, selectedYear]
  );

  const yearAnnouncements = useMemo(
    () => announcementDocs.filter((entry) => !selectedYear || normalizeAcademicYear(entry.academicYear) === selectedYear || toYear(entry.createdAt || entry.updatedAt) === selectedYear),
    [announcementDocs, selectedYear]
  );

  const topAttendanceClasses = useMemo(() => {
    const map = {};
    yearAttendanceDocs.forEach((entry) => {
      const key = normalize(entry.className) || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(Number(entry.summary?.attendancePercentage || 0));
    });
    return Object.entries(map)
      .map(([className, values]) => ({ className, value: average(values) }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }, [yearAttendanceDocs]);

  const topExamClasses = useMemo(() => {
    const map = {};
    yearExamDocs.forEach((entry) => {
      const key = normalize(entry.className) || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(Number(entry.summary?.classAverage || 0));
    });
    return Object.entries(map)
      .map(([className, values]) => ({ className, value: average(values) }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 5);
  }, [yearExamDocs]);

  const cards = [
    { label: "Students Added", value: yearStudents.length },
    { label: "Teachers Added", value: yearTeachers.length },
    { label: "Classes Added", value: yearClasses.length },
    { label: "Announcements", value: yearAnnouncements.length },
    { label: "Avg Attendance", value: `${average(yearAttendanceDocs.map((entry) => entry.summary?.attendancePercentage || 0))}%` },
    { label: "Avg Exam Score", value: `${average(yearExamDocs.map((entry) => entry.summary?.classAverage || 0))}%` },
  ];

  return (
    <div className="yearly-summary-page">
      <section className="yearly-summary-hero">
        <div>
          <p className="yearly-summary-kicker">Dashboard Analytics</p>
          <h2>Yearly Summary</h2>
        </div>
        <label className="yearly-summary-select-card">
          <span>Select Year</span>
          <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
            {yearOptions.length ? yearOptions.map((year) => <option key={year} value={year}>{year}</option>) : <option value="">No years found</option>}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="yearly-summary-empty">Loading yearly summary...</div>
      ) : (
        <>
          <section className="yearly-summary-grid">
            {cards.map((card) => (
              <article key={card.label} className="yearly-summary-card">
                <span>{card.label}</span>
                <strong>{card.value}</strong>
              </article>
            ))}
          </section>

          <section className="yearly-summary-panels">
            <article className="yearly-summary-panel">
              <h3>Top Attendance Classes</h3>
              {topAttendanceClasses.length ? (
                <div className="yearly-summary-list">
                  {topAttendanceClasses.map((entry) => (
                    <div key={entry.className} className="yearly-summary-row">
                      <span>{entry.className}</span>
                      <strong>{entry.value}%</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="yearly-summary-empty compact">No attendance data for this year.</div>
              )}
            </article>

            <article className="yearly-summary-panel">
              <h3>Top Exam Classes</h3>
              {topExamClasses.length ? (
                <div className="yearly-summary-list">
                  {topExamClasses.map((entry) => (
                    <div key={entry.className} className="yearly-summary-row">
                      <span>{entry.className}</span>
                      <strong>{entry.value}%</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="yearly-summary-empty compact">No exam data for this year.</div>
              )}
            </article>

            <article className="yearly-summary-panel">
              <h3>Year Snapshot</h3>
              <div className="yearly-summary-list">
                <div className="yearly-summary-row">
                  <span>Attendance records</span>
                  <strong>{yearAttendanceDocs.length}</strong>
                </div>
                <div className="yearly-summary-row">
                  <span>Exam uploads</span>
                  <strong>{yearExamDocs.length}</strong>
                </div>
                <div className="yearly-summary-row">
                  <span>Teachers tracked</span>
                  <strong>{teacherDocs.length}</strong>
                </div>
                <div className="yearly-summary-row">
                  <span>School classes</span>
                  <strong>{yearClasses.length}</strong>
                </div>
              </div>
            </article>
          </section>
        </>
      )}
    </div>
  );
}
