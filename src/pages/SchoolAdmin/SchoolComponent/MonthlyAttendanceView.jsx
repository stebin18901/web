import React from "react";

const MonthlyAttendanceView = ({ monthValue, docs = [] }) => (
  <section className="academic-card">
    <div className="academic-card-head">
      <div>
        <h3>Monthly Attendance View</h3>
        <p>Snapshot of saved attendance documents for {monthValue || "the selected month"}.</p>
      </div>
    </div>

    <div className="academic-table-wrap">
      <table className="academic-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Class</th>
            <th>Section</th>
            <th>Total</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Attendance %</th>
          </tr>
        </thead>
        <tbody>
          {docs.length ? (
            docs.map((docEntry) => (
              <tr key={docEntry.id}>
                <td>{docEntry.date}</td>
                <td>{docEntry.className}</td>
                <td>{docEntry.section || "-"}</td>
                <td>{docEntry.summary?.totalStudents || 0}</td>
                <td>{docEntry.summary?.present || 0}</td>
                <td>{docEntry.summary?.absent || 0}</td>
                <td>{docEntry.summary?.attendancePercentage || 0}%</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7">No attendance records available for this month.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

export default MonthlyAttendanceView;
