import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  loadStudentsForClass,
  normalizeClassName,
  normalizeSchoolId,
  normalizeSection,
  resolveSchoolClasses,
  splitClassAndDivision,
} from "./academicUtils";
import "./StudentReportPage.css";

const safeText = (value, fallback = "N/A") => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const formatDateLabel = (value) => {
  if (!value) return "N/A";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? safeText(value) : parsed.toLocaleString();
};

const getPerformanceLabel = (score) => {
  const numericScore = Number(score || 0);
  if (numericScore >= 70) return "strong";
  if (numericScore >= 40) return "average";
  return "weak";
};

const matchesStudentRecord = (record, student) => {
  const recordStudentId = String(record?.studentId || "").trim().toLowerCase();
  const studentId = String(student?.id || student?.studentId || "").trim().toLowerCase();
  const recordRoll = String(record?.rollNumber || "").trim().toLowerCase();
  const studentRoll = String(student?.rollNumber || "").trim().toLowerCase();
  const recordName = String(record?.fullName || record?.name || "").trim().toLowerCase();
  const studentName = String(student?.fullName || student?.name || "").trim().toLowerCase();

  if (recordStudentId && studentId && recordStudentId === studentId) return true;
  return Boolean(recordRoll && studentRoll && recordRoll === studentRoll && recordName && studentName && recordName === studentName);
};

const loadClassStudentMeta = async ({ schoolId, className, section, rollNumber }) => {
  const normalizedSchoolId = normalizeSchoolId(schoolId);
  const normalizedClassName = normalizeClassName(className);
  const normalizedSection = normalizeSection(section || splitClassAndDivision(className)?.division);
  const classCandidates = [
    `${normalizedSchoolId}_${normalizedClassName}`,
    `${normalizedSchoolId}_${splitClassAndDivision(normalizedClassName).grade || normalizedClassName}`,
  ].filter(Boolean);

  for (const classDocId of classCandidates) {
    const studentRef = doc(db, "classes", classDocId, "students", String(rollNumber || "").trim());
    const snap = await getDoc(studentRef);
    if (snap.exists()) {
      return { id: snap.id, section: normalizedSection, ...snap.data() };
    }
  }

  return {};
};

const StudentReportPage = ({ schoolId }) => {
  const navigate = useNavigate();
  const { studentId } = useParams();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [students, setStudents] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentDetail, setStudentDetail] = useState(null);
  const [studentMeta, setStudentMeta] = useState({});
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [marksHistory, setMarksHistory] = useState([]);
  const [quizReports, setQuizReports] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    const loadClasses = async () => {
      setLoadingList(true);
      try {
        const schoolClasses = await resolveSchoolClasses(schoolId);
        const uniqueClasses = schoolClasses.filter(
          (entry, index, list) => index === list.findIndex((item) => item.className === entry.className)
        );
        setClasses(uniqueClasses);
        setSelectedClass((current) => current || uniqueClasses[0]?.className || "");
      } finally {
        setLoadingList(false);
      }
    };

    if (schoolId) {
      loadClasses();
    }
  }, [schoolId]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!schoolId || !selectedClass) {
        setStudents([]);
        setLoadingList(false);
        return;
      }

      setLoadingList(true);
      try {
        const classEntry = classes.find((entry) => entry.className === selectedClass);
        const nextStudents = await loadStudentsForClass({
          schoolId,
          className: selectedClass,
          section: classEntry?.section || "",
        });
        setStudents(nextStudents);
      } finally {
        setLoadingList(false);
      }
    };

    loadStudents();
  }, [classes, schoolId, selectedClass]);

  useEffect(() => {
    const loadStudentReport = async () => {
      if (!studentId || !schoolId) {
        setStudentDetail(null);
        setStudentMeta({});
        setAttendanceHistory([]);
        setMarksHistory([]);
        setQuizReports([]);
        setSubmissions([]);
        return;
      }

      setDetailLoading(true);
      try {
        let studentSnap = await getDoc(doc(db, "studentAccounts", studentId));

        if (!studentSnap.exists()) {
          const normalizedSchool = normalizeSchoolId(schoolId);
          const fallbackSnap = await getDocs(query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchool)));
          const matchedDoc = fallbackSnap.docs.find((entry) => {
            const data = entry.data() || {};
            const candidateId = String(entry.id || "").trim().toLowerCase();
            const candidateRoll = String(data.rollNumber || "").trim().toLowerCase();
            return candidateId === String(studentId).trim().toLowerCase() || candidateRoll === String(studentId).trim().toLowerCase();
          });
          if (matchedDoc) {
            studentSnap = matchedDoc;
          }
        }

        if (!studentSnap.exists()) {
          setStudentDetail(null);
          return;
        }

        const studentData = { id: studentSnap.id, ...studentSnap.data() };
        setStudentDetail(studentData);

        const normalizedSchool = normalizeSchoolId(studentData.schoolId || schoolId);
        const [meta, attendanceSnap, marksSnap, reportsSnap, submissionsSnap] = await Promise.all([
          loadClassStudentMeta({
            schoolId: normalizedSchool,
            className: studentData.className,
            section: studentData.section || studentData.classSection,
            rollNumber: studentData.rollNumber,
          }),
          getDocs(collection(db, "schools", normalizedSchool, "attendance")),
          getDocs(collection(db, "schools", normalizedSchool, "examMarks")),
          getDocs(query(collection(db, "reports"), where("userId", "==", studentSnap.id))),
          getDocs(query(collection(db, "submissions"), where("studentId", "==", studentSnap.id))),
        ]);

        setStudentMeta(meta || {});

        const attendanceRows = attendanceSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .flatMap((entry) =>
            (entry.records || [])
              .filter((record) => matchesStudentRecord(record, studentData))
              .map((record) => ({
                ...record,
                date: entry.date,
                className: entry.className,
                section: entry.section,
              }))
          )
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

        const marksRows = marksSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .flatMap((entry) =>
            (entry.records || [])
              .filter((record) => matchesStudentRecord(record, studentData))
              .map((record) => ({
                ...record,
                examName: entry.examName || entry.examType,
                examType: entry.examType,
                academicYear: entry.academicYear,
                subjects: entry.subjects || [],
                maxMarks: entry.maxMarks || {},
                updatedAt: entry.updatedAt,
                className: entry.className,
                section: entry.section,
              }))
          )
          .sort(
            (a, b) =>
              new Date(b.updatedAt?.seconds ? b.updatedAt.seconds * 1000 : b.updatedAt || 0).getTime() -
              new Date(a.updatedAt?.seconds ? a.updatedAt.seconds * 1000 : a.updatedAt || 0).getTime()
          );

        const reportRows = reportsSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort(
            (a, b) =>
              new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt || 0).getTime() -
              new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt || 0).getTime()
          );

        const submissionRows = submissionsSnap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .sort(
            (a, b) =>
              new Date(b.submittedAt?.seconds ? b.submittedAt.seconds * 1000 : b.submittedAt || 0).getTime() -
              new Date(a.submittedAt?.seconds ? a.submittedAt.seconds * 1000 : a.submittedAt || 0).getTime()
          );

        setAttendanceHistory(attendanceRows);
        setMarksHistory(marksRows);
        setQuizReports(reportRows);
        setSubmissions(submissionRows);
      } finally {
        setDetailLoading(false);
      }
    };

    loadStudentReport();
  }, [schoolId, studentId]);

  const filteredStudents = useMemo(() => {
    const searchValue = searchTerm.trim().toLowerCase();
    if (!searchValue) return students;
    return students.filter((student) => {
      const haystack = [student.fullName, student.rollNumber, student.phone, student.email].join(" ").toLowerCase();
      return haystack.includes(searchValue);
    });
  }, [searchTerm, students]);

  const attendanceSummary = useMemo(() => {
    const summary = { total: attendanceHistory.length, present: 0, absent: 0, late: 0, other: 0 };
    attendanceHistory.forEach((entry) => {
      const status = String(entry.status || "").toLowerCase();
      if (status === "present") summary.present += 1;
      else if (status === "absent") summary.absent += 1;
      else if (status === "late") summary.late += 1;
      else summary.other += 1;
    });
    summary.rate = summary.total ? Number((((summary.present + summary.late + summary.other) / summary.total) * 100).toFixed(1)) : 0;
    return summary;
  }, [attendanceHistory]);

  const averageMarks = useMemo(() => {
    if (!marksHistory.length) return 0;
    return Number(
      (marksHistory.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / marksHistory.length).toFixed(1)
    );
  }, [marksHistory]);

  const averageQuiz = useMemo(() => {
    if (!quizReports.length) return 0;
    return Number(
      (quizReports.reduce((sum, entry) => sum + Number(entry.percentage || 0), 0) / quizReports.length).toFixed(1)
    );
  }, [quizReports]);

  const selectedClassLabel = selectedClass || "Class";

  if (!studentId) {
    return (
      <div className="student-report-page">
        <section className="student-report-hero">
          <div>
            <p className="student-report-kicker">Academic Layer</p>
            <h1>Student Report</h1>
            <p>Choose a class, review the full student roster, and open a complete academic profile for any student.</p>
          </div>
          <div className="student-report-chip">{filteredStudents.length} students</div>
        </section>

        <section className="student-report-toolbar">
          <label>
            <span>Class</span>
            <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              {classes.map((entry) => (
                <option key={entry.className} value={entry.className}>
                  {entry.className}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Search</span>
            <input
              type="text"
              placeholder={`Search in ${selectedClassLabel}`}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </section>

        {loadingList ? (
          <div className="student-report-state">Loading students...</div>
        ) : !selectedClass ? (
          <div className="student-report-state">No classes found for this school yet.</div>
        ) : !filteredStudents.length ? (
          <div className="student-report-state">No students match this class filter.</div>
        ) : (
          <div className="student-report-table-wrap">
            <table className="student-report-table">
              <thead>
                <tr>
                  <th>Roll</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.studentId}>
                    <td>{safeText(student.rollNumber, "-")}</td>
                    <td>{safeText(student.fullName)}</td>
                    <td>{safeText(student.className)}</td>
                    <td>{safeText(student.section, "-")}</td>
                    <td>{safeText(student.phone, "-")}</td>
                    <td>{safeText(student.email, "-")}</td>
                    <td>
                      <button
                        type="button"
                        className="student-report-link"
                        onClick={() => navigate(`/school-admin/students/student-report/${student.studentId}`)}
                      >
                        View Report
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="student-report-page">
      <div className="student-report-breadcrumb">
        <Link to="/school-admin/students/student-report">Student Report</Link>
        <span>/</span>
        <strong>{safeText(studentDetail?.fullName || studentDetail?.name, "Student")}</strong>
      </div>

      {detailLoading ? (
        <div className="student-report-state">Loading full student report...</div>
      ) : !studentDetail ? (
        <div className="student-report-state">Student record not found.</div>
      ) : (
        <>
          <section className="student-profile-hero">
            <div>
              <p className="student-report-kicker">Student Detail</p>
              <h1>{safeText(studentDetail.fullName || studentDetail.name)}</h1>
              <p>
                {safeText(studentDetail.className)} {safeText(studentDetail.section || studentDetail.classSection, "")}
                {" | "}Roll {safeText(studentDetail.rollNumber, "-")}
              </p>
            </div>
            <button type="button" className="student-report-link ghost" onClick={() => navigate(-1)}>
              Back
            </button>
          </section>

          <section className="student-overview-grid">
            <article className="student-overview-card">
              <span>Attendance Rate</span>
              <strong>{attendanceSummary.rate}%</strong>
            </article>
            <article className="student-overview-card">
              <span>Average Marks</span>
              <strong>{averageMarks}%</strong>
            </article>
            <article className="student-overview-card">
              <span>Average Quiz Score</span>
              <strong>{averageQuiz}%</strong>
            </article>
            <article className="student-overview-card">
              <span>Assignments Submitted</span>
              <strong>{submissions.length}</strong>
            </article>
          </section>

          <section className="student-report-grid">
            <article className="student-report-panel">
              <h3>Profile</h3>
              <div className="student-info-list">
                <div><span>Full Name</span><strong>{safeText(studentDetail.fullName || studentDetail.name)}</strong></div>
                <div><span>Email</span><strong>{safeText(studentDetail.email, "-")}</strong></div>
                <div><span>Phone</span><strong>{safeText(studentDetail.phone || studentDetail.parentPhone, "-")}</strong></div>
                <div><span>School ID</span><strong>{safeText(studentDetail.schoolId, "-")}</strong></div>
                <div><span>Behavior</span><strong>{safeText(studentMeta.behavior, "-")}</strong></div>
                <div><span>Saved Class Average</span><strong>{safeText(studentMeta.averageScore, "-")}</strong></div>
              </div>
            </article>

            <article className="student-report-panel">
              <h3>Attendance Summary</h3>
              <div className="student-info-list compact">
                <div><span>Total Records</span><strong>{attendanceSummary.total}</strong></div>
                <div><span>Present</span><strong>{attendanceSummary.present}</strong></div>
                <div><span>Absent</span><strong>{attendanceSummary.absent}</strong></div>
                <div><span>Late</span><strong>{attendanceSummary.late}</strong></div>
                <div><span>Other</span><strong>{attendanceSummary.other}</strong></div>
              </div>
            </article>
          </section>

          <section className="student-report-panel">
            <div className="student-panel-head">
              <h3>Marks History</h3>
              <span>{marksHistory.length} exams</span>
            </div>
            {!marksHistory.length ? (
              <div className="student-report-empty">No marks uploaded for this student yet.</div>
            ) : (
              <div className="student-report-list">
                {marksHistory.map((entry, index) => (
                  <article key={`${entry.examName}_${index}`} className="student-report-list-card">
                    <div className="student-report-list-head">
                      <div>
                        <strong>{safeText(entry.examName)}</strong>
                        <p>{safeText(entry.academicYear, "-")} | {formatDateLabel(entry.updatedAt)}</p>
                      </div>
                      <span className={`student-score-badge ${getPerformanceLabel(entry.percentage)}`}>
                        {Number(entry.percentage || 0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="student-subject-grid">
                      {(entry.subjects || []).map((subject) => (
                        <div key={subject}>
                          <span>{subject}</span>
                          <strong>
                            {safeText(entry.marksBySubject?.[subject], "-")} / {safeText(entry.maxMarks?.[subject], "-")}
                          </strong>
                        </div>
                      ))}
                    </div>
                    {entry.remarks ? <p className="student-inline-note">Remark: {entry.remarks}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="student-report-grid">
            <article className="student-report-panel">
              <div className="student-panel-head">
                <h3>Attendance History</h3>
                <span>{attendanceHistory.length} entries</span>
              </div>
              {!attendanceHistory.length ? (
                <div className="student-report-empty">No attendance history available.</div>
              ) : (
                <div className="student-mini-table-wrap">
                  <table className="student-mini-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceHistory.map((entry, index) => (
                        <tr key={`${entry.date}_${index}`}>
                          <td>{safeText(entry.date, "-")}</td>
                          <td>{safeText(String(entry.status || "").replace("_", " "), "-")}</td>
                          <td>{safeText(entry.note, "-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>

            <article className="student-report-panel">
              <div className="student-panel-head">
                <h3>Quiz Reports</h3>
                <span>{quizReports.length} attempts</span>
              </div>
              {!quizReports.length ? (
                <div className="student-report-empty">No quiz reports found.</div>
              ) : (
                <div className="student-mini-table-wrap">
                  <table className="student-mini-table">
                    <thead>
                      <tr>
                        <th>Concept</th>
                        <th>Score</th>
                        <th>Percent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quizReports.map((entry) => (
                        <tr key={entry.id}>
                          <td>{safeText(entry.concept, "-")}</td>
                          <td>{safeText(entry.score, "-")} / {safeText(entry.total, "-")}</td>
                          <td>{safeText(entry.percentage, 0)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </section>

          <section className="student-report-panel">
            <div className="student-panel-head">
              <h3>Assignment Submissions</h3>
              <span>{submissions.length} submissions</span>
            </div>
            {!submissions.length ? (
              <div className="student-report-empty">No assignment submissions found.</div>
            ) : (
              <div className="student-mini-table-wrap">
                <table className="student-mini-table">
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Submitted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((entry) => (
                      <tr key={entry.id}>
                        <td>{safeText(entry.assignmentTitle || entry.title, "-")}</td>
                        <td>{formatDateLabel(entry.submittedAt)}</td>
                        <td>{safeText(entry.status || "Submitted")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default StudentReportPage;
