import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { db } from "../../firebase/firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import Confetti from "react-confetti";
import { FiHelpCircle, FiSend } from "react-icons/fi";
import { BlockMath, InlineMath } from "react-katex";
import "./Quiz.css";

const Quiz = () => {
  const { id, concept } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [responses, setResponses] = useState([]);
  const [showHelp, setShowHelp] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);
  const [badge, setBadge] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // ✅ Check if user already has a report for this quiz
  useEffect(() => {
    if (!user) return;
    const checkReport = async () => {
      const encodedConcept = encodeURIComponent(concept);
      const reportId = `${user.uid}_${id}_${encodedConcept}`;
      const reportRef = doc(db, "reports", reportId);
      const snap = await getDoc(reportRef);
      if (snap.exists()) navigate(`/reportcard/${id}/${encodedConcept}`);
    };
    checkReport();
  }, [user, id, concept, navigate]);

  // ✅ Fetch quiz data
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const docSnap = await getDoc(doc(db, "quizzes", id));
        if (!docSnap.exists()) return setNotFound(true);

        const data = docSnap.data();
        if (data.metadata?.concept === decodeURIComponent(concept)) {
          setQuestions(data.questions || []);
        } else setNotFound(true);
      } catch (error) {
        console.error("Error fetching quiz:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id, concept]);

  // ✅ Helper: render math-aware text
  const renderContent = (text) => {
    if (!text) return "";
    const parts = text.split(/(\$[^$]+\$)/g); // Split by $...$
    return parts.map((part, i) =>
      part.startsWith("$") && part.endsWith("$") ? (
        <InlineMath key={i} math={part.slice(1, -1)} />
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // ✅ Handle answer submission
  const handleSubmitAnswer = useCallback(() => {
    const q = questions[current];
    const selectedAns = selected?.trim().toUpperCase();
    const correctAns = q.answer?.trim().toUpperCase();

    const updated = [...responses];
    updated[current] = {
      selected: selectedAns,
      correct: correctAns,
      question: q.question,
      options: q.options,
      explanation: q.explanation,
      concept: q.concept,
      example: q.example,
    };
    setResponses(updated);

    const correct = selectedAns === correctAns;
    setScore((s) => s + (correct ? 1 : 0));
    setXp((xp) => xp + (correct ? 100 : 20));
    setStreak((s) => (correct ? s + 1 : 0));
    setShowConfetti(correct);
    setBadge(
      correct
        ? streak + 1 === 3
          ? "🔥 3 in a row!"
          : streak + 1 === 5
          ? "🏆 5 in a row!"
          : "✅ Correct!"
        : "💡 Try again!"
    );

    setShowResult(true);
    setTimeout(() => setShowConfetti(false), 1200);
    setTimeout(() => setBadge(null), 1500);
  }, [selected, current, responses, questions, streak]);

  const handleNext = () => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      setSelected(null);
      setShowResult(false);
      setShowHelp(false);
    } else {
      setQuizCompleted(true);
    }
  };

  // ✅ Save final report
  useEffect(() => {
    const saveReport = async () => {
      if (!quizCompleted || !user) return;
      setSubmitting(true);
      const encodedConcept = encodeURIComponent(concept);
      const reportId = `${user.uid}_${id}_${encodedConcept}`;
      await setDoc(doc(db, "reports", reportId), {
        userId: user.uid,
        quizId: id,
        concept: decodeURIComponent(concept),
        score,
        total: questions.length,
        responses,
        xp,
        createdAt: serverTimestamp(),
      });
      setSubmitting(false);
      navigate(`/reportcard/${id}/${encodedConcept}`);
    };
    saveReport();
  }, [quizCompleted]);

  if (loading) return <p className="loading-text">Loading quiz...</p>;
  if (notFound) return <p className="loading-text">Quiz not found</p>;
  if (!questions.length) return <p>No questions found.</p>;

  const q = questions[current];
  const progress = ((current + 1) / questions.length) * 100;

  return (
    <div className="quiz-chat-container">
      {showConfetti && <Confetti recycle={false} />}
      {badge && <div className="badge-popup">{badge}</div>}

      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="chat-window">
        <div className="question-row">
          <div className="chat-bubble question-bubble">
            <span className="question-number">Q{current + 1}:</span>{" "}
            {renderContent(q.question)}
          </div>
          <button
            onClick={() => setShowHelp((h) => !h)}
            className="help-icon-btn"
            title="Show Concept Help"
          >
            <FiHelpCircle size={20} />
          </button>
        </div>

        {showHelp && (
          <div className="chat-bubble help-bubble">
            {q.concept && (
              <p>
                <strong>Concept:</strong> {renderContent(q.concept)}
              </p>
            )}
            {q.example && (
              <p>
                <strong>Example:</strong> {renderContent(q.example)}
              </p>
            )}
          </div>
        )}

        <div className="options-wrapper">
          {["A", "B", "C", "D"].map((key) => {
            const isCorrect = showResult && key === q.answer;
            const isWrong = showResult && selected === key && key !== q.answer;

            return (
              <div
                key={key}
                onClick={() => !showResult && setSelected(key)}
                className={`chat-bubble option-bubble
                  ${selected === key ? "selected" : ""}
                  ${isCorrect ? "correct" : ""}
                  ${isWrong ? "incorrect" : ""}
                `}
              >
                <strong>{key}.</strong> {renderContent(q.options?.[key])}
              </div>
            );
          })}
        </div>

        {showResult && (
          <div className="chat-bubble answer-bubble">
            <strong>Explanation:</strong>{" "}
            {q.explanation ? renderContent(q.explanation) : "No explanation provided."}
          </div>
        )}
      </div>

      <div className="chat-actions">
        {!showResult ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={!selected}
            className="send-btn"
          >
            <FiSend size={20} /> Submit
          </button>
        ) : (
          <button onClick={handleNext} className="next-btn">
            {current < questions.length - 1 ? "Next" : "Finish"}
          </button>
        )}
      </div>

      {submitting && <p className="loading-text">Generating report...</p>}
    </div>
  );
};

export default Quiz;
