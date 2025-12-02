import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import "./SubDetail.css";
import {Notes} from "./Notes";

const SubDetail = () => {
  const { subject } = useParams();
  const [selectedClass, setSelectedClass] = useState(6);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [schoolName, setSchoolName] = useState("");
  const [enabledChapters, setEnabledChapters] = useState([]);
  const [hasSchool, setHasSchool] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const auth = getAuth();
      const user = auth.currentUser;
      
      if (!user) {
        setError("Please log in to view this content");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // 1. Get user's document from the users collection
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (!userDoc.exists()) {
          setError("User profile not found");
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const schoolId = userData.schoolId;

        // 2. Get school data if school ID exists
        let schoolEnabledChapters = [];
        if (schoolId) {
          const schoolDoc = await getDoc(doc(db, "schools", schoolId));
          if (schoolDoc.exists()) {
            setSchoolName(schoolDoc.data().schoolName || "Your school");
            schoolEnabledChapters = schoolDoc.data().enabledChapters || [];
            setEnabledChapters(schoolEnabledChapters);
            setHasSchool(true);
          }
        } else {
          setHasSchool(false);
        }

        // 3. Fetch chapters for this subject and class
        const q = query(
          collection(db, "chapters"),
          where("subject", "==", subject),
          where("class", "==", selectedClass)
        );
        const querySnapshot = await getDocs(q);
        const allChapters = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // 4. Filter chapters based on school access
        const filteredChapters = hasSchool
          ? allChapters.filter(chapter => schoolEnabledChapters.includes(chapter.id))
          : allChapters;
        
        setChapters(filteredChapters);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [subject, selectedClass, hasSchool]);

  const handleTestClick = (testLinks) => {
    if (!testLinks || testLinks.length === 0) {
      alert("Test link is missing. Please contact the admin.");
      return;
    }

    const auth = getAuth();
    const studentUid = auth.currentUser.uid;
    const preFilledLink = testLinks[0].replace("UID_PLACEHOLDER", studentUid);
    window.open(preFilledLink, "_blank");
  };

  const handleNotesClick = (chapterId) => {
    setSelectedChapter(chapterId === selectedChapter ? null : chapterId);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading {subject} content...</p>
      </div>
    );
  }

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="subdetail-container">
      <div className="subdetail-header">
        <h1 className="subdetail-title">
          {subject.toUpperCase()} - GRADE {selectedClass}
        </h1>
        <div className="class-selector">
          <label htmlFor="classSelect">Select Grade:</label>
          <select
            id="classSelect"
            value={selectedClass}
            onChange={(e) => setSelectedClass(parseInt(e.target.value))}
            className="class-dropdown"
          >
            {[6, 7, 8, 9].map((cls) => (
              <option key={cls} value={cls}>
                Grade {cls}
              </option>
            ))}
          </select>
        </div>
      </div>

      {hasSchool ? (
        <div className={`quiz-status-banner ${enabledChapters.length > 0 ? 'enabled' : 'disabled'}`}>
          <div className="status-icon">
            {enabledChapters.length > 0 ? '✓' : '⚠️'}
          </div>
          <div className="status-text">
            <h4>
              {enabledChapters.length > 0 
                ? `Quizzes Enabled for ${schoolName}`
                : `Quizzes Disabled for ${schoolName}`}
            </h4>
            <p>
              {enabledChapters.length > 0
                ? "You can take tests for enabled chapters"
                : "Contact your school administrator to enable chapters"}
            </p>
          </div>
        </div>
      ) : (
        <div className="quiz-status-banner info">
          <div className="status-icon">ℹ️</div>
          <div className="status-text">
            <h4>No School Assigned</h4>
            <p>Showing all available chapters</p>
          </div>
        </div>
      )}

      <div className="chapters-list">
        {chapters.length > 0 ? (
          chapters.map((chapter, index) => (
            <div key={chapter.id} className="chapter-card">
              <div className="chapter-number">{index + 1}</div>
              <div className="chapter-content">
                <h3 className="chapter-title">{chapter.chapterName}</h3>
                <div className="chapter-actions">
                  {/* <button 
                    className="action-button notes-button"
                    onClick={() => handleNotesClick(chapter.id)}
                  >
                    Study Notes
                  </button> */}
                  <button
                    className="action-button test-button"
                    onClick={() => handleTestClick(chapter.testLinks)}
                  >
                    Take Test
                  </button>
                </div>
                {selectedChapter === chapter.id && (
                  <Notes chapterId={chapter.id} />
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <h3>No Chapters Available</h3>
            <p>
              {hasSchool
                ? "No chapters are currently enabled for your school"
                : "No chapters found for this subject and grade"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubDetail;