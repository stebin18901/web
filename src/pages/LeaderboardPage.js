import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./LeaderboardPage.css";

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getWeekKey = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - firstDay) / 86400000);
  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const getMonthKey = () => new Date().toISOString().slice(0, 7);

const LeaderboardPage = () => {
  const [rows, setRows] = useState([]);
  const [activeBoard, setActiveBoard] = useState("global");
  const [activeSubject, setActiveSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const session = useMemo(() => safeJsonParse(localStorage.getItem("schoolStudentSession")), []);

  useEffect(() => {
    if (!session) {
      navigate("/login");
      return;
    }
    const run = async () => {
      setLoading(true);
      try {
        const snap = await getDocs(collection(db, "leaderboardScores"));
        setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((row) => row.studentId));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [navigate, session]);

  const subjects = useMemo(() => {
    const set = new Set();
    rows.forEach((row) => Object.keys(row.subjectScores || {}).forEach((subject) => set.add(subject)));
    return [...set].sort();
  }, [rows]);

  useEffect(() => {
    if (!activeSubject && subjects.length) setActiveSubject(subjects[0]);
  }, [activeSubject, subjects]);

  const leaderboard = useMemo(() => {
    const currentWeek = getWeekKey();
    const currentMonth = getMonthKey();
    let scoped = rows;
    let scoreKey = "overallScore";

    if (activeBoard === "school") {
      scoped = rows.filter((row) => row.schoolId === session?.schoolId);
    } else if (activeBoard === "class") {
      scoped = rows.filter(
        (row) => row.schoolId === session?.schoolId && String(row.className || "") === String(session?.className || "")
      );
    } else if (activeBoard === "weekly") {
      scoped = rows.filter((row) => row.weekKey === currentWeek);
      scoreKey = "weeklyScore";
    } else if (activeBoard === "monthly") {
      scoped = rows.filter((row) => row.monthKey === currentMonth);
      scoreKey = "monthlyScore";
    } else if (activeBoard === "subject") {
      scoped = rows.filter((row) => row.subjectScores?.[activeSubject]);
    }

    return scoped
      .map((row) => {
        const subjectScore = row.subjectScores?.[activeSubject]?.score || 0;
        const points = activeBoard === "subject" ? subjectScore : Number(row[scoreKey] || 0);
        return {
          id: row.studentId || row.id,
          name: row.studentName || "Student",
          schoolName: row.schoolName || row.schoolId || "School",
          className: row.className || "N/A",
          points,
          accuracy: activeBoard === "subject" ? row.subjectScores?.[activeSubject]?.accuracy || 0 : row.overallAccuracy || 0,
        };
      })
      .filter((row) => row.points !== 0)
      .sort((a, b) => b.points - a.points || b.accuracy - a.accuracy);
  }, [activeBoard, activeSubject, rows, session?.className, session?.schoolId]);

  if (!session) return null;

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-top">
        <div>
          <h1>Leaderboards</h1>
          <p>Ranking is based on cumulative quiz score.</p>
        </div>
        <button onClick={() => navigate("/dashboard")}>Back</button>
      </div>

      <div className="leaderboard-tabs">
        {[
          ["global", "Global"],
          ["school", "School"],
          ["class", "Class"],
          ["weekly", "Weekly"],
          ["monthly", "Monthly"],
          ["subject", "Subject"],
        ].map(([key, label]) => (
          <button key={key} className={activeBoard === key ? "active" : ""} onClick={() => setActiveBoard(key)}>
            {label}
          </button>
        ))}
      </div>

      {activeBoard === "subject" && (
        <select className="leaderboard-subject-select" value={activeSubject} onChange={(event) => setActiveSubject(event.target.value)}>
          {subjects.length ? subjects.map((subject) => <option key={subject}>{subject}</option>) : <option>No subjects yet</option>}
        </select>
      )}

      {loading ? (
        <div className="leaderboard-empty">Loading leaderboard...</div>
      ) : leaderboard.length === 0 ? (
        <div className="leaderboard-empty">No leaderboard data yet.</div>
      ) : (
        <div className="leaderboard-table-wrap">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>School</th>
                <th>Class</th>
                <th>Score</th>
                <th>Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => (
                <tr className={entry.id === session.id ? "me" : ""} key={entry.id}>
                  <td>#{idx + 1}</td>
                  <td>{entry.name}</td>
                  <td>{entry.schoolName}</td>
                  <td>{entry.className}</td>
                  <td>{entry.points}</td>
                  <td>{entry.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardPage;
