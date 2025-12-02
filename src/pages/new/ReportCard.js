import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDocFromServer } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import "./ReportCard.css";

const ReportCard = () => {
  const { quizId, concept } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchReport = async () => {
      if (!user) return;

      try {
        const encodedConcept = encodeURIComponent(concept);
        const reportId = `${user.uid}_${quizId}_${encodedConcept}`;
        console.log("Fetching report with ID:", reportId);
        
        const reportRef = doc(db, "reports", reportId);
        const reportSnap = await getDocFromServer(reportRef);

        if (reportSnap.exists()) {
          console.log("Report found:", reportSnap.id);
          setReport(reportSnap.data());
        } else {
          console.log("Report not found");
          setNotFound(true);
        }
      } catch (err) {
        console.error("Error fetching report:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [user, quizId, concept]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString();
    } catch (e) {
      console.error("Error formatting timestamp:", e);
      return "Invalid date";
    }
  };

  if (loading) return <p className="loading-text">Loading report...</p>;
  if (notFound || !report) return (
    <div className="report-container">
      <p className="loading-text">No report found for this quiz.</p>
      <button onClick={() => navigate("/dashboard")} className="dashboard-button">
        Go to Dashboard
      </button>
    </div>
  );

  return (
    <div className="report-container">
      <h2 className="report-title">📊 Report Card – {report.concept || decodeURIComponent(concept)}</h2>
      <p className="report-meta"><strong>Score:</strong> {report.score}/{report.total} ({report.percentage}%)</p>
      <p className="report-meta"><strong>Completed on:</strong> {formatTimestamp(report.submittedAt)}</p>
      <hr className="report-divider" />

      <h3 className="review-title">🔍 Detailed Review:</h3>
      {report.responses.map((item, index) => (
        <div
          key={index}
          className={`question-card ${item.selected === item.correct ? "correct" : "wrong"}`}
        >
          <p className="question-title"><strong>Q{index + 1}:</strong> {item.question}</p>
          <ul className="option-list">
            {["A", "B", "C", "D"].map((opt) => (
              <li key={opt} className="option-item">
                <strong>{opt}.</strong> {item.options?.[opt]}
                {opt === item.correct && (
                  <span className="correct-answer">✔️ Correct Answer</span>
                )}
                {opt === item.selected && opt !== item.correct && (
                  <span className="wrong-answer">❌ Your Selection</span>
                )}
              </li>
            ))}
          </ul>
          <p className="answer-detail">
            <span className="detail-label">Your Answer:</span>{" "}
            {item.selected ? item.options?.[item.selected] : "Not answered"}
            {item.selected !== item.correct && item.selected && (
              <span className="wrong-answer"> (Wrong)</span>
            )}
          </p>
          <p className="answer-detail">
            <span className="detail-label">Correct Answer:</span>{" "}
            {item.options?.[item.correct] || "N/A"}
          </p>
          {item.explanation && (
            <p className="explanation"><strong>Explanation:</strong> {item.explanation}</p>
          )}
          {item.concept && (
            <p className="concept"><strong>Concept:</strong> {item.concept}</p>
          )}
          {item.example && (
            <p className="example"><strong>Example:</strong> {item.example}</p>
          )}
        </div>
      ))}

      <div className="dashboard-button-container">
        <button
          onClick={() => navigate("/dashboard")}
          className="dashboard-button"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
};

export default ReportCard;