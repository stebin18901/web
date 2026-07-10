import React from "react";
import { getAttendanceStatusMeta } from "./academicUtils";

const AttendanceHistory = ({ students = [], history = [], selectedStudentId = "", onStudentChange }) => {
  const selectedHistory = history.filter((entry) => !selectedStudentId || entry.studentId === selectedStudentId);

  return (
    <section className="academic-card">
      <div className="academic-card-head">
        <div>
          <h3>Student-wise Attendance History</h3>
          <p>Review daily attendance records for a student across saved dates.</p>
        </div>
      </div>

      <div className="academic-filter-grid compact">
        <div className="academic-field">
          <label>Student</label>
          <select className="academic-select" value={selectedStudentId} onChange={(e) => onStudentChange(e.target.value)}>
            <option value="">All students</option>
            {students.map((student) => (
              <option key={student.studentId} value={student.studentId}>
                {student.rollNumber} - {student.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="academic-table-wrap">
        <table className="academic-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Roll No</th>
              <th>Name</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {selectedHistory.length ? (
              selectedHistory.map((entry) => {
                const statusMeta = getAttendanceStatusMeta(entry.status);
                return (
                  <tr key={`${entry.date}_${entry.studentId}`}>
                    <td>{entry.date}</td>
                    <td>{entry.rollNumber}</td>
                    <td>{entry.fullName}</td>
                    <td><span className={`academic-badge tone-${statusMeta.tone}`}>{statusMeta.label}</span></td>
                    <td>{entry.note || "-"}</td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="5">No attendance history available for this selection.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default AttendanceHistory;
