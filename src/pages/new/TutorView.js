import React, { useState, useEffect } from "react";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";
import { useParams } from "react-router-dom";
import "./TutorView.css";

const TutorView = () => {
  const { tutorId } = useParams();
  const [tutor, setTutor] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [theme, setTheme] = useState("light"); // NEW state

  // Fetch tutor data
  useEffect(() => {
    const fetchTutor = async () => {
      try {
        const ref = doc(db, "tutors", tutorId);
        const snapshot = await getDoc(ref);
        if (snapshot.exists()) {
          setTutor(snapshot.data());
        }
      } catch (err) {
        console.error("Error fetching tutor:", err);
      }
    };
    fetchTutor();
  }, [tutorId]);

  // Helper: Render mixed LaTeX + text
  const renderMixedText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\$[^$]+\$)/g); // split into normal + $...$
    return parts.map((part, i) =>
      part.startsWith("$") && part.endsWith("$") ? (
        <InlineMath key={i} math={part.replace(/\$/g, "")} />
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  if (!tutor) return <p>Loading Tutor...</p>;

  const questions = tutor.data?.questions || [];
  const currentQ = questions[currentQIndex];

  const handleOptionClick = (optId) => {
    if (isAnswered) return;
    setSelectedOption(optId);
    setIsAnswered(true);
  };

  const nextQuestion = () => {
    setSelectedOption(null);
    setIsAnswered(false);
    setCurrentQIndex((prev) => (prev + 1) % questions.length);
  };

  return (
    <div className={`tutor-view-container ${theme}`}>
      {/* Theme Toggle */}
      <div className="theme-toggle">
        <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          Switch to {theme === "light" ? "Dark" : "Light"} Mode
        </button>
      </div>

      {/* Left: Tutor Content */}
      <div className="tutor-content">
        <h2>{tutor.meta?.title}</h2>
        <p>
          <strong>Class:</strong> {tutor.meta?.class} |{" "}
          <strong>Subject:</strong> {tutor.meta?.subject} |{" "}
          <strong>Chapter:</strong> {tutor.meta?.chapterNumber}
        </p>
        <p className="summary">{tutor.meta?.summary}</p>

        {tutor.data?.contents?.map((c) => (
          <div key={c.id} className="content-block">
            <h4>{c.title}</h4>
            <div className="content-body">{renderMixedText(c.body)}</div>
            {c.solution && (
              <div className="solution">
                <strong>Solution:</strong> {renderMixedText(c.solution.text)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: Testing Slot */}
      <div className="tutor-testing">
        <h3>Practice Questions</h3>
        {currentQ ? (
          <div className="question-box">
            <div className="stem">
              <strong>Q{currentQIndex + 1} ({currentQ.level}):</strong>{" "}
              {renderMixedText(currentQ.stem)}
            </div>

            {/* Multiple Choice */}
            {currentQ.type === "mcq" && (
              <ul className="options-list">
                {currentQ.options.map((opt) => (
                  <li
                    key={opt.id}
                    className={`option ${
                      isAnswered
                        ? opt.id === currentQ.correctAnswer
                          ? "correct"
                          : selectedOption === opt.id
                          ? "wrong"
                          : ""
                        : ""
                    }`}
                    onClick={() => handleOptionClick(opt.id)}
                  >
                    {renderMixedText(opt.text)}
                  </li>
                ))}
              </ul>
            )}

            {/* Numeric / Text Answer */}
            {currentQ.type === "numeric" && (
              <div>
                <input
                  type="text"
                  placeholder="Enter your answer..."
                  disabled={isAnswered}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSelectedOption(e.target.value.trim());
                      setIsAnswered(true);
                    }
                  }}
                />
                {isAnswered && (
                  <div
                    className={
                      selectedOption === currentQ.correctAnswer
                        ? "feedback correct"
                        : "feedback wrong"
                    }
                  >
                    {selectedOption === currentQ.correctAnswer
                      ? "✅ Correct"
                      : `❌ Wrong. Correct Answer: ${currentQ.correctAnswer}`}
                  </div>
                )}
              </div>
            )}

            {/* Explanation */}
            {isAnswered && (
              <div className="explanation">
                <strong>Explanation:</strong>{" "}
                {renderMixedText(currentQ.explanation)}
              </div>
            )}

            <button className="next-btn" onClick={nextQuestion}>
              Next Question →
            </button>
          </div>
        ) : (
          <p>No questions available</p>
        )}
      </div>
    </div>
  );
};

export default TutorView;
