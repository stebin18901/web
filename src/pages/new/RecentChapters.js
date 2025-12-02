import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, getDocs, orderBy, limit, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./RecentChapters.css";

const RecentChapters = () => {
  const [recentTutors, setRecentTutors] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const q = query(
          collection(db, "tutors"),
          orderBy("createdAt", "desc"),
          limit(4) // only 4
        );
        const snap = await getDocs(q);
        const docs = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() }));
        setRecentTutors(docs);
      } catch (err) {
        console.error("Error fetching recent chapters:", err);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div className="recent-chapters-container">
      <div className="header-row">
        <h2>Recently Added Chapters</h2>
        <button className="view-all-btn" onClick={() => navigate("/chapters")}>
          View All →
        </button>
      </div>

      <div className="recent-grid">
        {recentTutors.length === 0 ? (
          <p>No chapters available</p>
        ) : (
          recentTutors.map((t) => (
            <div
              key={t.id}
              className="recent-card"
              onClick={() => navigate(`/tutor/${t.id}`)}
            >

              <h3>{t.meta?.chapterNumber}: {t.meta?.title}</h3>
              <div className="meta-info">
               
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentChapters;
