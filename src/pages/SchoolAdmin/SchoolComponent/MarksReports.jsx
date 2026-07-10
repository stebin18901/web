import React from "react";

const MarksReports = ({ items = [], title = "Subject-wise Average" }) => (
  <section className="academic-chart-card">
    <div className="academic-card-head">
      <div>
        <h4>{title}</h4>
        <p>Performance distribution from saved exam uploads.</p>
      </div>
    </div>
    <div className="academic-chart-list">
      {items.length ? (
        items.map((item) => (
          <div key={item.label} className="academic-bar-row">
            <div className="academic-bar-meta">
              <span>{item.label}</span>
              <strong>{item.value}%</strong>
            </div>
            <div className="academic-bar-track">
              <div className="academic-bar-fill" style={{ width: `${Math.max(0, Math.min(100, item.value || 0))}%` }} />
            </div>
          </div>
        ))
      ) : (
        <div className="academic-state">No marks data to display yet.</div>
      )}
    </div>
  </section>
);

export default MarksReports;
