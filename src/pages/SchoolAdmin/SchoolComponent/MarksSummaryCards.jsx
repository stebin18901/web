import React from "react";

const MarksSummaryCards = ({ summary }) => {
  const cards = [
    { label: "Class Average", value: `${summary.classAverage || 0}%` },
    { label: "Highest Mark", value: summary.highestMark || 0 },
    { label: "Lowest Mark", value: summary.lowestMark || 0 },
    { label: "Pass %", value: `${summary.passPercentage || 0}%` },
    { label: "Attention Needed", value: summary.studentsNeedingAttention || 0 },
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

export default MarksSummaryCards;
