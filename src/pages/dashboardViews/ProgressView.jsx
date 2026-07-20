import React from "react";

export default function ProgressView({ progressCards, recentReports, formatDateLabel }) {
  return (
    <>
      <section className="dashboard-view-hero dashboard-glass-card">
        <span className="dashboard-view-kicker">My Progress</span>
        <h2>Readable progress tracking with the numbers that actually matter.</h2>
        <p>Review completion, class rank, recent attempts, and score quality in one cleaner view.</p>
      </section>
      <div className="progress-metric-grid">
        {progressCards.map((card) => (
          <section key={card.label} className={`progress-metric-card tone-${card.tone}`}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
          </section>
        ))}
      </div>
      <section className="leader-card recent-score-panel">
        <div className="row-head row-head-stack">
          <div>
            <div className="panel-title">Recent Scores</div>
            <p className="panel-support-copy">Latest submitted quizzes, sorted from newest to oldest.</p>
          </div>
        </div>
        {recentReports.length === 0 ? (
          <div className="empty-note">No attempts yet.</div>
        ) : (
          <ol className="score-timeline">
            {recentReports.slice(0, 8).map((report, index) => (
              <li key={report.id} className="score-timeline-item">
                <span className="score-order">{String(index + 1).padStart(2, "0")}</span>
                <div className="score-body">
                  <strong>{report.quizTitle || report.quizId}</strong>
                  <small>{formatDateLabel(report.submittedAt)}</small>
                </div>
                <strong className="score-value">{report.percentage}%</strong>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
