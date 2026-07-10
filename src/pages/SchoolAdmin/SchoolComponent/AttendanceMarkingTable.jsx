import React from "react";
import { ATTENDANCE_STATUS_CONFIG } from "./academicUtils";

const AttendanceMarkingTable = ({ rows = [], onStatusChange, onNoteChange }) => (
  <section className="academic-card">
    <div className="academic-card-head">
      <div>
        <h3>Mark Attendance</h3>
        <p>Default is present. Update only the students whose status changed.</p>
      </div>
    </div>

    <div className="academic-table-wrap">
      <table className="academic-table">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Student Name</th>
            <th>Status</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>{row.rollNumber || "-"}</td>
              <td>{row.fullName || "Student"}</td>
              <td>
                <div className="attendance-status-group">
                  {ATTENDANCE_STATUS_CONFIG.map((status) => (
                    <button
                      key={status.key}
                      type="button"
                      className={`attendance-chip ${row.status === status.key ? `active tone-${status.tone}` : ""}`}
                      onClick={() => onStatusChange(row.studentId, status.key)}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </td>
              <td>
                <input
                  className="academic-notes-input"
                  value={row.note || ""}
                  onChange={(e) => onNoteChange(row.studentId, e.target.value)}
                  placeholder="Optional note"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default AttendanceMarkingTable;
