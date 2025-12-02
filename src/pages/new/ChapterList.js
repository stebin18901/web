import React, { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./ChapterList.css";

const ChapterList = () => {
  const [tutors, setTutors] = useState([]);
  const [filterSubject, setFilterSubject] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const q = query(collection(db, "tutors"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        const docs = [];
        snap.forEach((d) =>
          docs.push({
            id: d.id,
            ...d.data(),
          })
        );
        setTutors(docs);
      } catch (err) {
        console.error("Error fetching tutors:", err);
      }
    };
    fetchTutors();
  }, []);

  const subjects = [...new Set(tutors.map((t) => t.meta?.subject))];

  return (
    <div className="chapter-list-container">
      <h1>Available Chapters</h1>

      {/* Subject Filter */}
      <div className="subject-filter">
        <label>Filter by Subject:</label>
        <select
          value={filterSubject}
          onChange={(e) => setFilterSubject(e.target.value)}
        >
          <option value="">All</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Chapters */}
      <div className="chapters-grid">
        {tutors
          .filter((t) =>
            filterSubject ? t.meta?.subject === filterSubject : true
          )
          .map((t) => (
            <div
              key={t.id}
              className="chapter-card"
              onClick={() => navigate(`/tutor/${t.id}`)}
            >
              {t.meta?.chapterNumber}:<h3>{t.meta?.title}</h3>
              
            </div>
          ))}
      </div>
    </div>
  );
};

export default ChapterList;
