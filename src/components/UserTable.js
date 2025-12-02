// src/pages/UserTable.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../context/AuthContext";
import "./UserTable.css";

const UserTable = () => {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState(null);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchUserStats = async () => {
      setLoading(true);
      try {
        const reportSnapshot = await getDocs(collection(db, "reports"));
        const statsMap = {};

        reportSnapshot.docs.forEach((docSnap) => {
          const { userId, score, total } = docSnap.data();
          if (!userId || !total) return;
          const percentage = Math.round((score / total) * 100);
          if (!statsMap[userId]) statsMap[userId] = { totalScore: 0, totalQuizzes: 0 };
          statsMap[userId].totalScore += percentage;
          statsMap[userId].totalQuizzes += 1;
        });

        const leaderboard = await Promise.all(
          Object.entries(statsMap).map(async ([userId, stats]) => {
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
                  if (schoolSnap.exists()) schoolName = schoolSnap.data().schoolName || "Unknown";
                }
              }
            } catch (err) {
              console.warn("Failed to fetch user/school:", err);
            }

            return {
              userId,
              name,
              schoolName,
              score: stats.totalScore,
              avgScore: Math.round(stats.totalScore / stats.totalQuizzes),
              totalQuizzes: stats.totalQuizzes,
            };
          })
        );

        leaderboard.sort((a, b) => b.avgScore - a.avgScore);

        const userIndex = leaderboard.findIndex(u => u.userId === user.uid);
        if (userIndex !== -1) {
          setUserStats(leaderboard[userIndex]);
          setRank(userIndex + 1);
        } else {
          setUserStats(null);
          setRank(null);
        }
      } catch (err) {
        console.error("Error fetching user stats:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserStats();
  }, [user]);

  if (!user) return <p className="loading-text">Please login to view your stats.</p>;
  if (loading) return <p className="loading-text">Loading your stats...</p>;
  if (!userStats) return <p className="loading-text">No stats available yet.</p>;

  const getMedal = (rank) => {
    return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank;
  };

  return (
    <div className="user-card-container">
      <div className="user-card">
        <div className="rank-badge">{getMedal(rank)}</div>
        <h2 className="user-name">{userStats.name}</h2>
        <p className="user-school">{userStats.schoolName}</p>
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value">{userStats.avgScore}%</span>
            <span className="stat-label">Avg Score</span>
          </div>
          <div className="stat">
            <span className="stat-value">{userStats.score}</span>
            <span className="stat-label">Score</span>
          </div>
          <div className="stat">
            <span className="stat-value">{userStats.totalQuizzes}</span>
            <span className="stat-label">Quizzes Played</span>
          </div>
          <div className="stat">
            <span className="stat-value">{rank}</span>
            <span className="stat-label">Rank</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTable;
