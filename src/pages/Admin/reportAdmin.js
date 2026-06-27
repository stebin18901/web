// src/pages/Admin/reportAdmin.js
import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./ReportAdmin.css";

const ReportAdmin = () => {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState("");
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [classFilter, setClassFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchSchools = async () => {
      const snap = await getDocs(collection(db, "schools"));
      const list = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      setSchools(list);
    };
    fetchSchools();
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      if (!selectedSchool) return;
      setLoading(true);

      const usersSnap = await getDocs(collection(db, "users"));
      const reportsSnap = await getDocs(collection(db, "reports"));

      const studentList = usersSnap.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((student) => student.schoolId === selectedSchool);

      const reportList = reportsSnap.docs.map((entry) => ({
        id: entry.id,
        ...entry.data(),
      }));

      setStudents(studentList);
      setReports(reportList);
      setLoading(false);
    };
    fetchAll();
  }, [selectedSchool]);

  const analyzeStudent = (uid) => {
    const userReports = reports.filter((report) => report.userId === uid);
    const avg =
      userReports.length > 0
        ? Math.round(userReports.reduce((sum, report) => sum + (report.percentage || 0), 0) / userReports.length)
        : 0;

    const strengths = userReports
      .filter((report) => report.percentage >= 80)
      .map((report) => report.concept)
      .slice(0, 2);

    const weaknesses = userReports
      .filter((report) => report.percentage < 50)
      .map((report) => report.concept)
      .slice(0, 2);

    return { total: userReports.length, average: avg, strengths, weaknesses };
  };

  const filteredStudents = students.filter((student) => {
    const matchClass = !classFilter || (student.class && student.class === classFilter);
    const matchSearch =
      (student.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const schoolName = schools.find((school) => school.schoolId === selectedSchool)?.schoolName || "School";
    const today = new Date().toLocaleDateString();

    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text(`${schoolName} - Student Report Summary`, 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${today}`, 14, 27);

    const data = filteredStudents.map((student) => {
      const userReports = reports.filter((report) => report.userId === student.id);
      const avg =
        userReports.length > 0
          ? Math.round(userReports.reduce((sum, report) => sum + (report.percentage || 0), 0) / userReports.length)
          : 0;

      const weaknesses = userReports
        .filter((report) => report.percentage < 40)
        .map((report) => report.concept)
        .slice(0, 3);

      return [
        student.name,
        student.class,
        student.email,
        userReports.length,
        `${avg}%`,
        weaknesses.join(", ") || "-",
      ];
    });

    autoTable(doc, {
      startY: 32,
      head: [["Name", "Class", "Email", "Quizzes Taken", "Avg Score", "Weak Areas (<40%)"]],
      body: data,
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [220, 53, 69],
        textColor: 255,
        halign: "center",
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 30, bottom: 20 },
      didDrawPage(pageData) {
        const pageHeight = doc.internal.pageSize.height;
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(`${schoolName} | Page ${doc.internal.getNumberOfPages()}`, pageData.settings.margin.left, pageHeight - 10);
      },
    });

    doc.save(`${schoolName}_report_summary.pdf`);
  };

  return (
    <div className="report-admin-container">
      <div className="report-admin-header">
        <div>
          <p className="report-admin-kicker">Insights</p>
          <h2>School Report Admin</h2>
          <p className="report-admin-subtitle">Filter by school, class, and student to review performance summaries and export a clean PDF.</p>
        </div>
        <div className="report-admin-chip">{filteredStudents.length} students</div>
      </div>

      <div className="filter-bar">
        <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)}>
          <option value="">Select School</option>
          {schools.map((school) => (
            <option key={school.id} value={school.schoolId}>
              {school.schoolName}
            </option>
          ))}
        </select>

        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} disabled={!selectedSchool}>
          <option value="">All Classes</option>
          {[...new Set(students.map((student) => student.class))].map((cls, idx) => (
            <option key={idx} value={cls}>
              Class {cls}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Search name/email"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          disabled={!selectedSchool}
        />

        <button onClick={handleExportPDF} disabled={!filteredStudents.length}>
          Export PDF
        </button>
      </div>

      {loading ? (
        <p className="report-status">Loading data...</p>
      ) : !selectedSchool ? (
        <p className="report-status">Select a school to view reports.</p>
      ) : !filteredStudents.length ? (
        <p className="report-status">No student reports match the selected filters.</p>
      ) : (
        <div className="table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Class</th>
                <th>Email</th>
                <th>Quizzes</th>
                <th>Average</th>
                <th>Strengths</th>
                <th>Weaknesses</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const summary = analyzeStudent(student.id);
                return (
                  <tr key={student.id}>
                    <td>{student.name}</td>
                    <td>{student.class}</td>
                    <td>{student.email}</td>
                    <td>{summary.total}</td>
                    <td>
                      <div className="progress-container">
                        <div
                          className="progress-bar"
                          style={{
                            width: `${summary.average}%`,
                            backgroundColor:
                              summary.average >= 80 ? "green" : summary.average < 50 ? "red" : "orange",
                          }}
                        >
                          {summary.average}%
                        </div>
                      </div>
                    </td>
                    <td>{summary.strengths.join(", ") || "-"}</td>
                    <td>{summary.weaknesses.join(", ") || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReportAdmin;
