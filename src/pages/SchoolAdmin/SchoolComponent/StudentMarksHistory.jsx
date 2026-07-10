import React from "react";

const StudentMarksHistory = ({ exams = [], selectedStudentId = "", onStudentChange, students = [] }) => {
  const rows = exams.flatMap((exam) =>
    (exam.records || [])
      .filter((record) => !selectedStudentId || record.studentId === selectedStudentId)
      .map((record) => ({
        examName: exam.examName,
        examType: exam.examType,
        academicYear: exam.academicYear,
        ...record,
      }))
  );

  return (
    <section className="academic-card">
      <div className="academic-card-head">
        <div>
          <h3>Student Marks History</h3>
          <p>View saved marks by student across uploaded exams.</p>
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
              <th>Exam</th>
              <th>Year</th>
              <th>Roll</th>
              <th>Name</th>
              <th>Total</th>
              <th>%</th>
              <th>Grade</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={`${row.examName}_${row.studentId}`}>
                  <td>{row.examName || row.examType}</td>
                  <td>{row.academicYear}</td>
                  <td>{row.rollNumber}</td>
                  <td>{row.fullName}</td>
                  <td>{row.total}</td>
                  <td>{row.percentage}</td>
                  <td>{row.grade}</td>
                  <td>{row.remarks || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8">No marks history available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default StudentMarksHistory;
