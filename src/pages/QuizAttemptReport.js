import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./QuizAttemptReport.css";

const formatTime = (seconds = 0) => {
  const mins = Math.floor(Number(seconds || 0) / 60);
  const secs = Number(seconds || 0) % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
};

const statRows = (stats = {}) => Object.entries(stats).map(([name, value]) => ({ name, ...value }));

const getStrengths = (chapterStats = {}) => {
  const strong = statRows(chapterStats)
    .filter((row) => row.attempted > 0 && row.accuracy >= 80)
    .slice(0, 3)
    .map((row) => `Excellent in ${row.name}`);
  return strong.length ? strong : ["Keep building consistency across chapters"];
};

const getImprovements = (chapterStats = {}, difficultyStats = {}) => {
  const weakChapters = statRows(chapterStats)
    .filter((row) => row.attempted > 0 && row.accuracy < 60)
    .slice(0, 2)
    .map((row) => `Revise ${row.name}`);
  const weakDifficulty = statRows(difficultyStats)
    .filter((row) => row.attempted > 0 && row.accuracy < 60)
    .slice(0, 2)
    .map((row) => `Practice more ${row.name}`);
  const items = [...weakChapters, ...weakDifficulty];
  return items.length ? items : ["Attempt more quizzes to unlock deeper recommendations"];
};

const MiniTable = ({ title, rows }) => (
  <section className="qar-section">
    <h3>{title}</h3>
    {rows.length ? (
      <div className="qar-table-wrap">
        <table className="qar-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Score</th>
              <th>Accuracy</th>
              <th>Correct</th>
              <th>Wrong</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.score}</td>
                <td>{row.accuracy || 0}%</td>
                <td>{row.correct || 0}</td>
                <td>{row.wrong || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="qar-muted">No analytics available yet.</p>
    )}
  </section>
);

const QuizAttemptReport = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const report = location.state?.report || null;

  const normalized = useMemo(() => {
    if (!report) return null;
    const attempted = report.attemptedCount ?? report.attendedCount ?? 0;
    const correct = report.correctCount ?? 0;
    const wrong = report.wrongCount ?? 0;
    const total = report.totalQuestions ?? attempted + wrong + (report.unansweredCount || 0);
    const unanswered = report.unansweredCount ?? report.unattendedCount ?? Math.max(0, total - attempted);
    return {
      ...report,
      attempted,
      correct,
      wrong,
      total,
      unanswered,
      accuracy: report.accuracy ?? (attempted ? Math.round((correct / attempted) * 100) : 0),
      percentage: report.percentage ?? (total ? Math.round((correct / total) * 100) : 0),
    };
  }, [report]);

  if (!normalized) {
    return (
      <div className="quiz-attempt-report">
        <div className="qar-card">
          <h2>Report not found</h2>
          <button onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  const strengths = getStrengths(normalized.chapterStats);
  const improvements = getImprovements(normalized.chapterStats, normalized.difficultyStats);

  return (
    <div className="quiz-attempt-report">
      <div className="qar-card">
        <div className="qar-head">
          <div>
            <h2>Quiz Performance Report</h2>
            <p className="qar-subtitle">{normalized.quizTitle || normalized.chapterName || "Quiz"}</p>
          </div>
          <div className="qar-score-pill">
            <span>Final Score</span>
            <strong>{normalized.score}</strong>
          </div>
        </div>

        <p className="qar-feedback">{normalized.feedback || "Keep practicing and review every explanation carefully."}</p>

        <section className="qar-section">
          <h3>Performance Summary</h3>
          <div className="qar-grid">
            <div><span>Total Questions</span><strong>{normalized.total}</strong></div>
            <div><span>Attempted</span><strong>{normalized.attempted}</strong></div>
            <div><span>Correct</span><strong>{normalized.correct}</strong></div>
            <div><span>Wrong</span><strong>{normalized.wrong}</strong></div>
            <div><span>Unanswered</span><strong>{normalized.unanswered}</strong></div>
            <div><span>Percentage</span><strong>{normalized.percentage}%</strong></div>
            <div><span>Accuracy</span><strong>{normalized.accuracy}%</strong></div>
            <div><span>Total Time</span><strong>{formatTime(normalized.totalTimeSeconds)}</strong></div>
            <div><span>Avg / Question</span><strong>{formatTime(normalized.averageTimePerQuestion)}</strong></div>
          </div>
        </section>

        <MiniTable title="Subject Performance" rows={statRows(normalized.subjectStats)} />
        <MiniTable title="Chapter Performance" rows={statRows(normalized.chapterStats)} />
        <MiniTable title="Difficulty Analysis" rows={statRows(normalized.difficultyStats)} />

        <section className="qar-split">
          <div className="qar-section">
            <h3>Strengths</h3>
            <ul>{strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="qar-section">
            <h3>Areas for Improvement</h3>
            <ul>{improvements.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </section>

        <section className="qar-section">
          <h3>Rank Information</h3>
          <div className="qar-grid compact">
            <div><span>School Rank</span><strong>{normalized.ranks?.schoolRank ? `#${normalized.ranks.schoolRank}` : "Pending"}</strong></div>
            <div><span>Class Rank</span><strong>{normalized.ranks?.classRank ? `#${normalized.ranks.classRank}` : "Pending"}</strong></div>
            <div><span>Platform Rank</span><strong>{normalized.ranks?.overallRank ? `#${normalized.ranks.overallRank}` : "Pending"}</strong></div>
          </div>
        </section>

        <section className="qar-section">
          <h3>Achievement Badges</h3>
          <div className="qar-badges">
            {(normalized.badges?.length ? normalized.badges : ["Quiz Finisher"]).map((badge) => (
              <span key={badge}>{badge}</span>
            ))}
          </div>
        </section>

        <div className="qar-actions">
          <button onClick={() => navigate("/leaderboard")}>View Leaderboard</button>
          <button onClick={() => navigate("/dashboard")}>Back to Dashboard</button>
        </div>
      </div>
    </div>
  );
};

export default QuizAttemptReport;
