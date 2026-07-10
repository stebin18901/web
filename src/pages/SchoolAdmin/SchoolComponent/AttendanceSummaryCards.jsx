import React from "react";

const AttendanceSummaryCards = ({ summary }) => {
  const cards = [
    { label: "Total Students", value: summary.totalStudents || 0 },
    { label: "Present", value: summary.present || 0 },
    { label: "Absent", value: summary.absent || 0 },
    { label: "Late", value: summary.late || 0 },
    { label: "Half Day", value: summary.halfDay || 0 },
    { label: "Excused", value: summary.excused || 0 },
    { label: "Attendance %", value: `${summary.attendancePercentage || 0}%` },
  ];

  return (
    <section className="academic-summary-grid">
      {cards.map((card) => (
        <article key={card.label} className="academic-summary-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
};

export default AttendanceSummaryCards;
