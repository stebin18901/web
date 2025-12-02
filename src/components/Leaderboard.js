// src/pages/Leaderboard.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./Leaderboard.css";
import TopSchools from "../pages/TopSchools";
import UserTable from "./UserTable";

const Leaderboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const reportSnapshot = await getDocs(collection(db, "reports"));
        const userStats = {};

        reportSnapshot.forEach((docSnap) => {
          const report = docSnap.data();
          const { userId, score, total } = report;
          if (!userId || !total) return;

          const percentage = Math.round((score / total) * 100);
          if (!userStats[userId]) {
            userStats[userId] = { totalScore: 0, totalQuizzes: 0 };
          }
          userStats[userId].totalScore += percentage;
          userStats[userId].totalQuizzes += 1;
        });

        const leaderboard = await Promise.all(
          Object.entries(userStats).map(async ([userId, stats]) => {
            let name = userId;
            let schoolName = "Unknown";

            try {
              const userRef = doc(db, "users", userId);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const userData = userSnap.data();
                name = userData.name || userId;

                if (userData.schoolId) {
                  const schoolRef = doc(db, "schools", userData.schoolId);
                  const schoolSnap = await getDoc(schoolRef);
                  if (schoolSnap.exists()) {
                    schoolName = schoolSnap.data().schoolName || "Unknown";
                  }
                }
              }
            } catch (err) {
              console.warn(`Failed to fetch user/school for ${userId}:`, err);
            }

            return {
              name,
              schoolName,
              avgScore: Math.round(stats.totalScore / stats.totalQuizzes),
              attempts: stats.totalQuizzes,
            };
          })
        );

        leaderboard.sort((a, b) => b.avgScore - a.avgScore);
        setData(leaderboard.slice(0, 10));
      } catch (err) {
        console.error("Error loading leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, []);

  return (
    <div className="leaderboard-wrapper">
      {/* LEFT SIDE - Leaderboard Table */}
      <div className="leaderboard-left">
        <h2 className="leaderboard-title">Leaderboard (Top 10)</h2>
        {loading ? (
          <p className="loading-text">Loading leaderboard...</p>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Name</th>
                <th>School</th>
                <th>Average Score (%)</th>
                <th>Total Quizzes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user, index) => (
                <tr key={index}>
                  <td className="rank">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                  </td>
                  <td>{user.name}</td>
                  <td>{user.schoolName}</td>
                  <td>{user.avgScore}</td>
                  <td>{user.attempts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* RIGHT SIDE - TopSchools + Dummy Card */}
      <div className="leaderboard-right">
        <div className="right-card">
          <TopSchools />
        </div>
        <div className="right-card">
          <UserTable />
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
