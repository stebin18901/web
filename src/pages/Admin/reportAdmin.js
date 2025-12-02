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
      const list = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => s.schoolId === selectedSchool);

      const reportList = reportsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setStudents(studentList);
      setReports(reportList);
      setLoading(false);
    };
    fetchAll();
  }, [selectedSchool]);

  const analyzeStudent = (uid) => {
    const userReports = reports.filter((r) => r.userId === uid);
    const avg =
      userReports.length > 0
        ? Math.round(
            userReports.reduce((a, b) => a + (b.percentage || 0), 0) /
              userReports.length
          )
        : 0;

    const strengths = userReports
      .filter((r) => r.percentage >= 80)
      .map((r) => r.concept)
      .slice(0, 2);

    const weaknesses = userReports
      .filter((r) => r.percentage < 50)
      .map((r) => r.concept)
      .slice(0, 2);

    return { total: userReports.length, average: avg, strengths, weaknesses };
  };

  const filteredStudents = students.filter((s) => {
    const matchClass = !classFilter || (s.class && s.class === classFilter);
    const matchSearch =
      (s.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchClass && matchSearch;
  });

  const handleExportPDF = () => {
  const doc = new jsPDF();

  const schoolName =
    schools.find((s) => s.schoolId === selectedSchool)?.schoolName || "School";
  const today = new Date().toLocaleDateString();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text(`${schoolName} - Student Report Summary`, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Generated on: ${today}`, 14, 27);

  // Table Data (Exclude Strengths, Show only Weaknesses < 40%)
  const data = filteredStudents.map((s) => {
    const userReports = reports.filter((r) => r.userId === s.id);
    const avg =
      userReports.length > 0
        ? Math.round(
            userReports.reduce((a, b) => a + (b.percentage || 0), 0) /
              userReports.length
          )
        : 0;

    const weaknesses = userReports
      .filter((r) => r.percentage < 40)
      .map((r) => r.concept)
      .slice(0, 3); // Show up to 3

    return [
      s.name,
      s.class,
      s.email,
      userReports.length,
      `${avg}%`,
      weaknesses.join(", ") || "-",
    ];
  });

  autoTable(doc, {
    startY: 32,
    head: [
      [
        "Name",
        "Class",
        "Email",
        "Quizzes Taken",
        "Avg Score",
        "Weak Areas (<40%)",
      ],
    ],
    body: data,
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [220, 53, 69], // Bootstrap red
      textColor: 255,
      halign: "center",
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
    margin: { top: 30, bottom: 20 },
    didDrawPage: function (data) {
      const pageSize = doc.internal.pageSize;
      const pageHeight = pageSize.height;
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(
        `${schoolName} | Page ${doc.internal.getNumberOfPages()}`,
        data.settings.margin.left,
        pageHeight - 10
      );
    },
  });

  doc.save(`${schoolName}_report_summary.pdf`);
};


  return (
    <div className="report-admin-container">
      <h2>📊 School Report Admin</h2>

      <div className="filter-bar">
        <select
          value={selectedSchool}
          onChange={(e) => setSelectedSchool(e.target.value)}
        >
          <option value="">Select School</option>
          {schools.map((school) => (
            <option key={school.id} value={school.schoolId}>
              {school.schoolName}
            </option>
          ))}
        </select>

        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          disabled={!selectedSchool}
        >
          <option value="">All Classes</option>
          {[...new Set(students.map((s) => s.class))].map((cls, idx) => (
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
        <p>Loading data...</p>
      ) : (
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
            {filteredStudents.map((s) => {
              const r = analyzeStudent(s.id);
              return (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.class}</td>
                  <td>{s.email}</td>
                  <td>{r.total}</td>
                  <td>
                    <div className="progress-container">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${r.average}%`,
                          backgroundColor:
                            r.average >= 80
                              ? "green"
                              : r.average < 50
                              ? "red"
                              : "orange",
                        }}
                      >
                        {r.average}%
                      </div>
                    </div>
                  </td>
                  <td>{r.strengths.join(", ") || "-"}</td>
                  <td>{r.weaknesses.join(", ") || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReportAdmin;
