import React from "react";

const StudentAttentionList = ({ items = [], title = "Students Needing Attention" }) => (
  <section className="academic-card">
    <div className="academic-card-head">
      <div>
        <h3>{title}</h3>
        <p>These students need follow-up based on low attendance or low marks.</p>
      </div>
    </div>
    <div className="academic-attention-list">
      {items.length ? (
        items.map((item) => (
          <article key={`${item.studentId}_${item.reason}`} className="academic-attention-item">
            <strong>{item.fullName}</strong>
            <span>{item.className} {item.section ? `- ${item.section}` : ""}</span>
            <span>{item.reason}</span>
          </article>
        ))
      ) : (
        <div className="academic-state">No students currently flagged for attention.</div>
      )}
    </div>
  </section>
);

export default StudentAttentionList;
