import React from "react";

const MarksEntryTable = ({ subjects = [], rows = [], maxMarks = {}, onCellChange }) => (
  <section className="academic-card">
    <div className="academic-card-head">
      <div>
        <h3>Marks Entry Table</h3>
        <p>Enter marks per subject. Leave any mark blank if it is optional, pending, or not available yet.</p>
      </div>
    </div>
    <div className="academic-table-wrap">
      <table className="academic-table">
        <thead>
          <tr>
            <th>Roll No</th>
            <th>Student Name</th>
            {subjects.map((subject) => (
              <th key={subject}>
                {subject}
                <br />
                <small>Max {maxMarks[subject] || 0}</small>
              </th>
            ))}
            <th>Total</th>
            <th>%</th>
            <th>Grade</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.studentId}>
              <td>{row.rollNumber}</td>
              <td>{row.fullName}</td>
              {subjects.map((subject) => (
                <td key={`${row.studentId}_${subject}`}>
                  <input
                    className="academic-input"
                    style={{ minWidth: 80 }}
                    type="number"
                    min="0"
                    placeholder="Optional"
                    value={row.marksBySubject?.[subject] ?? ""}
                    onChange={(e) => onCellChange(row.studentId, subject, e.target.value)}
                  />
                  {row.hasError && Number(row.marksBySubject?.[subject]) > Number(maxMarks[subject] || 0) ? (
                    <div className="academic-inline-error">Exceeds max</div>
                  ) : null}
                </td>
              ))}
              <td>{row.total || 0}</td>
              <td>{row.percentage || 0}</td>
              <td>{row.grade || "-"}</td>
              <td>
                <input
                  className="academic-input"
                  value={row.remarks || ""}
                  onChange={(e) => onCellChange(row.studentId, "remarks", e.target.value, true)}
                  placeholder="Remarks"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

export default MarksEntryTable;
