import React from "react";

export default function DashboardAuxPanel({
  activeNav,
  studentStats,
  progressHolderTier,
  session,
  profileCardImage,
  overallProgress,
  activePlan,
  formatDateLabel,
  leaderboard,
}) {
  if (activeNav === "practice" || activeNav === "league" || activeNav === "updates" || activeNav === "subjects") {
    return null;
  }

  return (
    <aside className="right-panel">
      {activeNav === "home" && (
        <section className="stats-card">
          <div className="panel-title">Snapshot</div>
          <div className="stats-grid">
            <div>
              <p className="stat-num">{studentStats.totalPoints}</p>
              <p className="stat-label">Total Points</p>
            </div>
            <div>
              <p className="stat-num">{studentStats.avgAccuracy}%</p>
              <p className="stat-label">Accuracy</p>
            </div>
            <div>
              <p className="stat-num">{studentStats.totalQuizzes}</p>
              <p className="stat-label">Quizzes Attempted</p>
            </div>
          </div>
        </section>
      )}

      {activeNav === "progress" && (
        <section className={`stats-card progress-summary-panel holder-card holder-card-${progressHolderTier.key}`}>
          <div className="holder-card-shell">
            <div className="holder-card-score-block">
              <span className="holder-card-overall">{studentStats.avgAccuracy}</span>
              <span className="holder-card-overall-label">OVR</span>
              <span className="holder-card-tier">{progressHolderTier.label}</span>
            </div>

            <div className="holder-card-art">
              <div className="holder-card-glow"></div>
              <img
                className="holder-card-avatar"
                src={profileCardImage}
                alt={session?.name ? `${session.name} profile` : "Student profile"}
              />
            </div>

            <div className="holder-card-nameplate">
              <span className="holder-card-kicker">Profile Summary</span>
              <strong>{session?.name || "Student"}</strong>
              <p>{progressHolderTier.accent}</p>
            </div>

            <div className="holder-card-stats-grid">
              <div>
                <span>COM</span>
                <strong>{overallProgress}</strong>
              </div>
              <div>
                <span>PTS</span>
                <strong>{studentStats.totalPoints}</strong>
              </div>
              <div>
                <span>RNK</span>
                <strong>{studentStats.rank}</strong>
              </div>
              <div>
                <span>ATM</span>
                <strong>{studentStats.totalQuizzes}</strong>
              </div>
              <div>
                <span>PLN</span>
                <strong>{session.planName || activePlan.name || "Base"}</strong>
              </div>
              <div>
                <span>EXP</span>
                <strong>{session.expiryDate ? formatDateLabel(session.expiryDate).split(",")[0] : "NA"}</strong>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeNav === "leaderboard" && (
        <section className="stats-card">
          <div className="panel-title">Your Standing</div>
          <div className="progress-summary-list">
            <div className="progress-summary-item">
              <span>Current Rank</span>
              <strong>#{studentStats.rank}</strong>
            </div>
            <div className="progress-summary-item">
              <span>Total Points</span>
              <strong>{studentStats.totalPoints}</strong>
            </div>
            <div className="progress-summary-item">
              <span>Average Accuracy</span>
              <strong>{studentStats.avgAccuracy}%</strong>
            </div>
            <div className="progress-summary-item">
              <span>Class Entries</span>
              <strong>{leaderboard.length}</strong>
            </div>
          </div>
        </section>
      )}

      {activeNav === "profile" && (
        <section className="stats-card profile-summary-panel">
          <div className="panel-title">Profile Summary</div>
          <div className="progress-summary-list">
            <div className="progress-summary-item">
              <span>Plan</span>
              <strong>{session.planName || activePlan.name || "Default"}</strong>
            </div>
            <div className="progress-summary-item">
              <span>Expiry</span>
              <strong>{formatDateLabel(session.expiryDate)}</strong>
            </div>
            <div className="progress-summary-item">
              <span>Payment</span>
              <strong>{session.paymentStatus || "Not available"}</strong>
            </div>
            <div className="progress-summary-item">
              <span>Registration</span>
              <strong>{session.registrationStatus || "Not available"}</strong>
            </div>
          </div>
        </section>
      )}

      {!["home", "practice", "progress", "leaderboard", "profile"].includes(activeNav) && (
        <section className="stats-card">
          <div className="panel-title">Status</div>
          <div className="empty-note">This section is being prepared.</div>
        </section>
      )}
    </aside>
  );
}
