import React, { useState } from "react";
import "./Reports.css";
import { students } from "../data/dummyData";

export default function Reports() {
  const [sortField, setSortField] = useState("performance");

  const sortedStudents = [...students].sort((a, b) => b[sortField] - a[sortField]);

  const top = [...students]
    .sort((a, b) => b.performance - a.performance)
    .slice(0, 5);

  const avgPerformance = (
    students.reduce((a, b) => a + b.performance, 0) / students.length
  ).toFixed(2);

  const avgAttendance = (
    students.reduce((a, b) => a + b.attendance, 0) / students.length
  ).toFixed(2);

  const feesDue = students.filter((s) => s.feesDue).length;

  function downloadCSV() {
    const csv =
      "Name,Class,Performance%\n" +
      students.map((s) => `${s.name},${s.class},${s.performance}`).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "performance_report.csv";
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div className="reports-wrapper">

      <h1 className="reports-title">Analytics & Reports</h1>

      {/* DASHBOARD CARDS */}
      <div className="report-cards">

        <div className="rep-card">
          <h3>Average Performance</h3>
          <p className="rep-value">{avgPerformance}%</p>
        </div>

        <div className="rep-card">
          <h3>Average Attendance</h3>
          <p className="rep-value">{avgAttendance}%</p>
        </div>

        <div className="rep-card">
          <h3>Top Performer</h3>
          <p className="rep-value">{top[0].name}</p>
        </div>

        <div className="rep-card">
          <h3>Fees Due</h3>
          <p className="rep-value">{feesDue} students</p>
        </div>

      </div>

      {/* TOP PERFORMERS */}
      <div className="top-section">
        <h2>Top 5 Performers</h2>

        <div className="top-list">
          {top.map((t, index) => (
            <div className="top-item" key={t.id}>
              <div className="rank">{index + 1}</div>
              <div className="top-info">
                <span className="top-name">{t.name}</span>
                <span className="top-class">{t.class}</span>
              </div>
              <div className="top-bar">
                <div className="top-bar-fill" style={{ width: `${t.performance}%` }}></div>
              </div>
              <span className="top-score">{t.performance}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* FULL REPORT TABLE */}
      <div className="full-report">
        <h2>Full Student Report</h2>

        <table className="rep-table">
          <thead>
            <tr>
              <th onClick={() => setSortField("name")}>Name</th>
              <th onClick={() => setSortField("class")}>Class</th>
              <th onClick={() => setSortField("performance")}>Performance %</th>
              <th onClick={() => setSortField("attendance")}>Attendance %</th>
            </tr>
          </thead>

          <tbody>
            {sortedStudents.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.class}</td>
                <td>{s.performance}</td>
                <td>{s.attendance}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <button className="csv-btn" onClick={downloadCSV}>
          Download CSV
        </button>
      </div>

    </div>
  );
}
