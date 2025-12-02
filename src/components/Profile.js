// src/pages/Profile.js
import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import "./Profile.css";

const Profile = () => {
  const { user } = useAuth();
  const [userData, setUserData] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        // ---- Fetch user ----
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const u = userSnap.data();
          if (!cancelled) setUserData(u);

          // ---- Fetch school name from schoolId ----
          if (u?.schoolId) {
            try {
              const schoolRef = doc(db, "schools", u.schoolId);
              const schoolSnap = await getDoc(schoolRef);
              const sName = schoolSnap.exists()
                ? (schoolSnap.data().schoolName || u.schoolId)
                : u.schoolId;
              if (!cancelled) setSchoolName(sName);
            } catch (e) {
              console.warn("Failed to fetch school:", e);
              if (!cancelled) setSchoolName(u.schoolId);
            }
          }
        }

        // ---- Fetch reports for this user ----
        const reportsRef = collection(db, "reports");
        const q = query(reportsRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);

        const fetched = querySnapshot.docs.map((d) => {
          const r = d.data();
          const scoreNum = Number(r.score ?? 0);
          const totalNum = Number(r.total ?? 0);

          const percentage =
            typeof r.percentage === "number"
              ? Math.round(r.percentage)
              : totalNum > 0
              ? Math.round((scoreNum / totalNum) * 100)
              : 0;

          // Normalize submittedAt to a JS Date if possible
          let submittedAt = null;
          if (r.submittedAt?.toDate) {
            submittedAt = r.submittedAt.toDate();
          } else if (typeof r.submittedAt === "string") {
            const dParsed = new Date(r.submittedAt);
            if (!isNaN(dParsed)) submittedAt = dParsed;
          }

          return {
            id: d.id,
            concept: r.concept || r.quizName || "Untitled Quiz",
            score: scoreNum,
            total: totalNum,
            percentage,
            submittedAt,
          };
        });

        // Sort by most recent
        fetched.sort((a, b) => {
          const ta = a.submittedAt ? a.submittedAt.getTime() : 0;
          const tb = b.submittedAt ? b.submittedAt.getTime() : 0;
          return tb - ta;
        });

        if (!cancelled) setReports(fetched);
      } catch (err) {
        console.error("Error loading profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const completedCount = reports.length;
  const avgScore =
    completedCount === 0
      ? 0
      : Math.round(
          reports.reduce((sum, r) => sum + (Number(r.percentage) || 0), 0) /
            completedCount
        );

  const weakConcepts = reports.filter((r) => (r.percentage ?? 0) < 40);

  if (loading) return <div className="loading-spinner"></div>;

  return (
    <div className="profile-container">
      <h2 className="profile-heading">👤 My Profile</h2>

      {userData && (
        <div className="profile-card">
          <div className="profile-header">
            <h3>{userData.name || "Student"}</h3>
          </div>
          <div className="profile-details">
            <p><span className="detail-icon">📧</span> {userData.email || "-"}</p>
            <p><span className="detail-icon">🏫</span> School: {schoolName || "—"}</p>
            <p><span className="detail-icon">🎓</span> Class: {userData.class || "-"}</p>
          </div>
        </div>
      )}

      <div className="stats-section">
        <div className="stat-box">
          <span className="stat-icon">✅</span>
          <div>
            <div className="stat-label">Quizzes Completed</div>
            <div className="stat-value">{completedCount}</div>
          </div>
        </div>
        <div className="stat-box">
          <span className="stat-icon">📈</span>
          <div>
            <div className="stat-label">Avg. Score</div>
            <div className="stat-value">{avgScore}%</div>
          </div>
        </div>
      </div>

      <div className="progress-section">
        <h3 className="section-title">Progress Overview</h3>
        <div className="progress-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${avgScore}%` }}
              data-label={`${avgScore}%`}
            />
          </div>
        </div>
      </div>

      {weakConcepts.length > 0 && (
        <div className="weak-section">
          <h3 className="section-title">⚠️ Weak Areas (Score &lt; 40%)</h3>
          <ul className="weak-list">
            {weakConcepts.map((item) => (
              <li key={item.id}>
                <span className="weak-concept">{item.concept}</span>
                <span className="weak-score">{item.percentage}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="report-section">
        <div
          className="report-header"
          onClick={() => setShowCompleted((s) => !s)}
        >
          <h3 className="section-title">📝 Completed Quizzes ({completedCount})</h3>
          <span className="dropdown-icon">{showCompleted ? "▲" : "▼"}</span>
        </div>

        {showCompleted && (
          <div className="report-list">
            {reports.length === 0 ? (
              <p className="no-quizzes">No quizzes completed yet.</p>
            ) : (
              reports.map((report) => (
                <div key={report.id} className="report-card">
                  <div className="report-card-header">
                    <h4>{report.concept}</h4>
                    <div
                      className={`score-badge ${
                        report.percentage < 40 ? "low-score" : ""
                      }`}
                    >
                      {report.percentage}%
                    </div>
                  </div>
                  <div className="report-details">
                    <p>
                      Score: {report.score}/{report.total}
                    </p>
                    <p className="date">
                      Completed:{" "}
                      {report.submittedAt
                        ? report.submittedAt.toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
