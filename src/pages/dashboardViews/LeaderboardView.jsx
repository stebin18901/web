import React from "react";

export default function LeaderboardView({
  leaderboard,
  getHolderTierByScore,
  profileCardImage,
  sessionId,
}) {
  return (
    <>
      <section className="dashboard-view-hero dashboard-glass-card">
        <span className="dashboard-view-kicker">Leaderboard</span>
        <h2>See your class standing clearly, with stronger visual hierarchy.</h2>
        <p>The ranking board is separated from home so students can focus on competition and movement.</p>
      </section>
      {leaderboard.length === 0 ? (
        <section className="leaderboard-card leaderboard-empty-card">
          <div className="empty-note">Leaderboard will appear after submissions.</div>
        </section>
      ) : (
        <>
          <div className="leaderboard-podium">
            {leaderboard.slice(0, 3).map((entry, idx) => {
              const holderTier = getHolderTierByScore(entry.avg);
              return (
                <article
                  key={entry.id}
                  className={`leader-podium-card podium-${idx + 1} holder-tone-${holderTier.key}`}
                >
                  <div className="leader-podium-copy">
                    <span className="leader-podium-rank">#{idx + 1}</span>
                    <strong>{entry.name}</strong>
                    <p>{entry.points} pts</p>
                    <small>{entry.avg}% avg accuracy</small>
                  </div>
                  <div className="leader-podium-art" aria-hidden="true">
                    <img className="leader-podium-avatar" src={profileCardImage} alt="" />
                  </div>
                </article>
              );
            })}
          </div>
          <section className="leaderboard-card leaderboard-full-card">
            <div className="row-head row-head-stack">
              <div>
                <div className="panel-title">Full Class Ranking</div>
                <p className="panel-support-copy">Sorted by total points, then average score.</p>
              </div>
            </div>
            <div className="leaderboard-table">
              {leaderboard.map((entry, idx) => (
                <div
                  key={entry.id}
                  className={`leaderboard-table-row ${entry.id === sessionId ? "current-student" : ""}`}
                >
                  <span className="leaderboard-table-rank">#{idx + 1}</span>
                  <strong>{entry.name}</strong>
                  <span>{entry.avg}% Avg</span>
                  <span>{entry.points} pts</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
