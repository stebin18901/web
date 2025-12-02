import { useEffect, useState } from "react";
import { db } from "../../firebase/firebaseConfig";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./SubjectsList.css";
import {
  FaSpinner,
  FaExclamationTriangle,
  FaTags,
} from "react-icons/fa";

const SubjectList = () => {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        setError("");
        const snapshot = await getDocs(collection(db, "quizzes"));
        const subjectSet = new Set();

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.metadata?.subject) {
            subjectSet.add(data.metadata.subject);
          }
        });

        const sortedSubjects = Array.from(subjectSet).sort((a, b) =>
          a.localeCompare(b)
        );
        setSubjects(sortedSubjects);
      } catch (err) {
        console.error("Failed to load subjects:", err);
        setError(
          "⚠ Failed to load subjects. Please check your internet connection."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  return (
    <div className="subject-page-wrapper">
      <div className="subject-content">
        <div className="subject-header-section">
          <h1 className="main-heading">Foundation</h1>
          <p className="sub-heading">
            Check whether you build the foundation perfectly
          </p>
        </div>

        <div className="subject-content-area">
          {loading ? (
            <div className="state-message loading-state">
              <FaSpinner className="spin-icon" />
              <p>Gathering subjects...</p>
            </div>
          ) : error ? (
            <div className="state-message error-state">
              <FaExclamationTriangle className="error-icon" />
              <p>{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="action-button retry-button"
              >
                Retry
              </button>
            </div>
          ) : subjects.length === 0 ? (
            <div className="state-message no-subjects-state">
              <FaTags className="no-subjects-icon" />
              <p>No subjects available at the moment. Check back soon!</p>
            </div>
          ) : (
            <div className="subject-pills-container">
              {subjects.map((subject) => (
                <button
                  key={subject}
                  className="subject-pill"
                  onClick={() => navigate(`/concepts/${subject}`)}
                  aria-label={`Go to ${subject} quizzes`}
                >
                  {subject}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubjectList;
