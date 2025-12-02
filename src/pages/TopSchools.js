// src/pages/TopSchools.js
import React, { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import "./TopSchool.css";

const TopSchools = () => {
  const [schoolsData, setSchoolsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchoolLeaderboard = async () => {
      try {
        const reportSnapshot = await getDocs(collection(db, "reports"));
        const schoolStats = {};

        // Step 1: Collect student scores
        for (const docSnap of reportSnapshot.docs) {
          const report = docSnap.data();
          const { userId, score, total } = report;
          if (!userId || !total) continue;

          const percentage = Math.round((score / total) * 100);

          try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) continue;

            const userData = userSnap.data();
            const schoolId = userData.schoolId;
            if (!schoolId) continue;

            if (!schoolStats[schoolId]) {
              schoolStats[schoolId] = {
                totalScore: 0,
                totalQuizzes: 0,
                students: new Set(),
              };
            }

            schoolStats[schoolId].totalScore += percentage;
            schoolStats[schoolId].totalQuizzes += 1;
            schoolStats[schoolId].students.add(userId);
          } catch (err) {
            console.warn(`Failed fetching user ${userId}`, err);
          }
        }

        // Step 2: Map schools with names
        const leaderboard = await Promise.all(
          Object.entries(schoolStats).map(async ([schoolId, stats]) => {
            let schoolName = schoolId;
            try {
              const schoolRef = doc(db, "schools", schoolId);
              const schoolSnap = await getDoc(schoolRef);
              if (schoolSnap.exists()) {
                schoolName = schoolSnap.data().schoolName || schoolId;
              }
            } catch (err) {
              console.warn(`Failed fetching school ${schoolId}`, err);
            }

            return {
              schoolName,
              avgScore: Math.round(stats.totalScore / stats.totalQuizzes),
              attempts: stats.totalQuizzes,
              studentsCount: stats.students.size,
            };
          })
        );

        // Step 3: Sort schools
        leaderboard.sort((a, b) => {
          if (b.avgScore === a.avgScore) {
            return b.attempts - a.attempts; // tie-breaker
          }
          return b.avgScore - a.avgScore;
        });

        setSchoolsData(leaderboard.slice(0, 3)); // Top 3 only
      } catch (err) {
        console.error("Error loading schools leaderboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolLeaderboard();
  }, []);

  return (
  <div className="top-schools-container">
    <h2 className="top-schools-title">Top 3 Schools</h2>
    {loading ? (
      <p>Loading schools...</p>
    ) : schoolsData.length > 0 ? (
      <div className="top-schools-podium">
        {schoolsData.map((school, index) => (
          <div
            key={index}
            className={`podium-item ${
              index === 0 ? "first" : index === 1 ? "second" : "third"
            }`}
          >
            <div className="podium-rank">#{index + 1}</div>
            <div className="podium-name">{school.schoolName}</div>
            <div className="podium-stats">
              Avg: {school.avgScore}% <br />
              Attempts: {school.attempts} <br />
              Students: {school.studentsCount}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p>No school data available.</p>
    )}
  </div>
);
};

export default TopSchools;
