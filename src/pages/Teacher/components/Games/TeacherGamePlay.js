import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { db } from "../../../../firebase/firebaseConfig";
import { useQuiz } from "../../../../context/QuizContext";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CORRECT_MARKS = 4;

const getQuestionText = (question) =>
  question?.text || question?.question || question?.prompt || question?.title || "Question";

const getQuizTitle = (quiz) =>
  quiz?.title || quiz?.metadata?.chapter || quiz?.quizData?.quizTitle || quiz?.chapter || "Quiz";

const normalizeOptions = (question) => {
  const raw = question?.options;
  if (Array.isArray(raw)) {
    return raw
      .map((option, index) => {
        const key = option?.id || option?.key || LETTERS[index] || String(index + 1);
        const label =
          typeof option === "object"
            ? option.text || option.label || option.value || option.name || ""
            : option;
        return { key: String(key), label: String(label || "").trim() };
      })
      .filter((option) => option.label);
  }

  if (raw && typeof raw === "object") {
    return Object.entries(raw)
      .map(([key, value]) => ({
        key: String(key),
        label:
          typeof value === "object"
            ? String(value.text || value.label || value.value || "")
            : String(value || ""),
      }))
      .filter((option) => option.label);
  }

  return [];
};

const getCorrectKeys = (question, options) => {
  const byIndex = (index) => options[Number(index)]?.key;
  const byValue = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "";
    const directKey = options.find((option) => option.key === raw)?.key;
    if (directKey) return directKey;
    const letterIndex = LETTERS.indexOf(raw.toUpperCase());
    if (letterIndex >= 0 && options[letterIndex]) return options[letterIndex].key;
    return options.find((option) => option.label.trim().toLowerCase() === raw.toLowerCase())?.key || raw;
  };

  if (Array.isArray(question?.correctIndexes)) return question.correctIndexes.map(byIndex).filter(Boolean);
  if (Array.isArray(question?.correctAnswers)) return question.correctAnswers.map(byValue).filter(Boolean);
  if (Array.isArray(question?.answer)) return question.answer.map(byValue).filter(Boolean);
  if (Number.isInteger(question?.correctIndex)) return [byIndex(question.correctIndex)].filter(Boolean);
  if (question?.answer !== undefined && question?.answer !== null) {
    return String(question.answer).split(",").map(byValue).filter(Boolean);
  }
  return [];
};

const TeacherGamePlay = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { gameId } = useParams();
  const { teacher } = useTeacherAuth();
  const { quizzes, loading } = useQuiz();
  const [students, setStudents] = useState([]);
  const [studentProfilesByRoll, setStudentProfilesByRoll] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeStudentId, setActiveStudentId] = useState("");
  const [answersByStudent, setAnswersByStudent] = useState({});
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const selectedQuizIds = useMemo(
    () => (Array.isArray(location.state?.quizIds) ? location.state.quizIds : []),
    [location.state]
  );
  const className = teacher?.assignedClass || teacher?.assignedClasses?.[0] || "";
  const normalizedSchoolId = String(teacher?.schoolId || "").trim().toLowerCase();
  const normalizedClassName = String(className || "").trim().toUpperCase();

  useEffect(() => {
    if (!normalizedSchoolId || !normalizedClassName) return undefined;
    const studentsRef = query(
      collection(db, "studentAccounts"),
      where("schoolId", "==", normalizedSchoolId),
      where("className", "==", normalizedClassName)
    );
    const unsub = onSnapshot(studentsRef, (snap) => {
      const rows = snap.docs
        .map((entry) => {
          const data = entry.data() || {};
          return {
            id: entry.id,
            ...data,
            rollNumber: String(data.rollNumber || "").trim(),
            name: data.fullName || data.name || "",
          };
        })
        .filter((entry) => entry.rollNumber)
        .sort((a, b) => String(a.rollNumber || "").localeCompare(String(b.rollNumber || ""), undefined, { numeric: true }));
      setStudents(rows);
      setActiveStudentId((prev) => (prev && rows.some((row) => row.id === prev) ? prev : rows[0]?.id || ""));
    });
    return () => unsub();
  }, [normalizedClassName, normalizedSchoolId]);

  useEffect(() => {
    if (!normalizedSchoolId || !normalizedClassName) return undefined;
    const accountsRef = query(collection(db, "studentAccounts"), where("schoolId", "==", normalizedSchoolId));
    const unsub = onSnapshot(accountsRef, (snap) => {
      const nextProfiles = {};
      snap.docs.forEach((entry) => {
        const data = entry.data() || {};
        if (String(data.className || "").toUpperCase() !== normalizedClassName) return;
        const rollKey = String(data.rollNumber || "").trim();
        if (!rollKey) return;
        nextProfiles[rollKey] = data;
      });
      setStudentProfilesByRoll(nextProfiles);
    });
    return () => unsub();
  }, [normalizedClassName, normalizedSchoolId]);

  const attemptQuestions = useMemo(() => {
    const selectedQuizzes = quizzes.filter((quiz) => selectedQuizIds.includes(quiz.id));
    return selectedQuizzes.flatMap((quiz) => {
      const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
      return questions.map((question, index) => {
        const options = normalizeOptions(question);
        return {
          ...question,
          attemptId: `${quiz.id}_${question.id || index}`,
          quizId: quiz.id,
          quizTitle: getQuizTitle(quiz),
          questionNumber: index + 1,
          text: getQuestionText(question),
          options,
          correctKeys: getCorrectKeys(question, options),
        };
      });
    });
  }, [quizzes, selectedQuizIds]);

  const currentQuestion = attemptQuestions[currentIndex];
  const activeStudent = useMemo(() => {
    const selectedStudent = students.find((student) => student.id === activeStudentId) || null;
    if (!selectedStudent) return null;
    const profile = studentProfilesByRoll[String(selectedStudent.rollNumber || "").trim()] || null;
    return {
      ...selectedStudent,
      displayName: profile?.fullName || profile?.name || selectedStudent.name || `Student ${selectedStudent.rollNumber || ""}`.trim(),
      phone: profile?.phone || profile?.parentPhone || selectedStudent.phone || "",
    };
  }, [activeStudentId, studentProfilesByRoll, students]);

  const leaderboard = useMemo(() => {
    return students
      .map((student) => {
        const answers = answersByStudent[student.id] || {};
        let correct = 0;
        attemptQuestions.forEach((question) => {
          if (answers[question.attemptId] && question.correctKeys.includes(answers[question.attemptId])) {
            correct += 1;
          }
        });
        const profile = studentProfilesByRoll[String(student.rollNumber || "").trim()] || null;
        return {
          id: student.id,
          name: profile?.fullName || profile?.name || student.name || `Student ${student.rollNumber}`,
          rollNumber: student.rollNumber || "-",
          correct,
          score: correct * CORRECT_MARKS,
        };
      })
      .sort((a, b) => b.score - a.score || a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }))
      .slice(0, 10);
  }, [answersByStudent, attemptQuestions, studentProfilesByRoll, students]);

  if (loading) return <Loader text="Loading game..." />;

  if (!selectedQuizIds.length) {
    return (
      <div className="teacher-game-empty">
        <h2>No chapter selected</h2>
        <button type="button" className="teacher-game-start-btn" onClick={() => navigate(`/teacher-dashboard/games/${gameId}`)}>
          Select Chapter
        </button>
      </div>
    );
  }

  if (!attemptQuestions.length) return <Loader text="Preparing quiz questions..." />;

  const handleOptionSelect = (optionKey) => {
    if (!activeStudentId || !currentQuestion) return;
    setAnswersByStudent((prev) => ({
      ...prev,
      [activeStudentId]: {
        ...(prev[activeStudentId] || {}),
        [currentQuestion.attemptId]: optionKey,
      },
    }));
  };

  return (
    <div className="teacher-game-play-shell">
      <div className="teacher-game-play-topbar">
        <div>
          <span className="teacher-games-kicker">Live Play</span>
          <h2 className="gradient-text">{location.state?.chapterName || "Quiz Game"}</h2>
          <p className="teacher-game-play-context">
            {teacher?.schoolName || "School"} · {className || "Class not set"} · {students.length} available student{students.length === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" className="teacher-game-start-btn secondary" onClick={() => navigate(`/teacher-dashboard/games/${gameId}`)}>
          Change Chapter
        </button>
      </div>

      {!showLeaderboard ? (
        <div className="teacher-game-play-layout">
          <aside className="teacher-game-palette-panel">
            <h3>Question Palette</h3>
            <div className="teacher-game-palette-grid">
              {attemptQuestions.map((question, index) => (
                <button
                  key={question.attemptId}
                  type="button"
                  className={`teacher-game-palette-item ${index === currentIndex ? "active" : ""}`}
                  onClick={() => setCurrentIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </aside>

          <main className="teacher-game-question-panel">
            <div className="teacher-game-question-meta">
              <span>{location.state?.subject || "General"}</span>
              <strong>Question {currentIndex + 1} of {attemptQuestions.length}</strong>
            </div>
            <div className="teacher-game-question-card">
              <h3>{currentQuestion.text}</h3>
              <div className="teacher-game-options">
                {currentQuestion.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`teacher-game-option ${
                      answersByStudent[activeStudentId]?.[currentQuestion.attemptId] === option.key ? "selected" : ""
                    }`}
                    onClick={() => handleOptionSelect(option.key)}
                    disabled={!activeStudentId}
                  >
                    <span>{option.key}</span>
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="teacher-game-nav-row">
              <button type="button" className="teacher-game-start-btn secondary" onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))} disabled={currentIndex === 0}>
                Previous
              </button>
              {currentIndex === attemptQuestions.length - 1 ? (
                <button type="button" className="teacher-game-start-btn" onClick={() => setShowLeaderboard(true)}>
                  Finish Game
                </button>
              ) : (
                <button type="button" className="teacher-game-start-btn" onClick={() => setCurrentIndex((prev) => Math.min(attemptQuestions.length - 1, prev + 1))}>
                  Next Question
                </button>
              )}
            </div>
          </main>

          <aside className="teacher-game-students-panel">
            <div className="teacher-game-active-student">
              <span>Active Student</span>
              <strong>{activeStudent?.displayName || "Select a student"}</strong>
              <small>{activeStudent ? `Roll No: ${activeStudent.rollNumber || "-"}` : "Answers are assigned to the selected roll number."}</small>
              {activeStudent?.phone ? <small>Phone: {activeStudent.phone}</small> : null}
            </div>
            <h3>Roll Numbers</h3>
            {students.length === 0 ? (
              <div className="teacher-game-empty-state">
                No students found for {className || "this class"}. Add student roll numbers to this class first.
              </div>
            ) : (
              <div className="teacher-game-student-list">
                {students.map((student) => {
                  const hasAnswered = Boolean(answersByStudent[student.id]?.[currentQuestion.attemptId]);
                  return (
                    <button
                      key={student.id}
                      type="button"
                      className={`teacher-game-student-chip ${student.id === activeStudentId ? "active" : ""} ${hasAnswered ? "answered" : ""}`}
                      onClick={() => setActiveStudentId(student.id)}
                      title={`Roll No: ${student.rollNumber || "-"}`}
                    >
                      <strong>{student.rollNumber || "-"}</strong>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      ) : (
        <section className="teacher-game-leaderboard-board">
          <div className="teacher-games-board-head">
            <div>
              <span className="teacher-games-section-label">Leaderboard</span>
              <h3>Top 10 students from this quiz</h3>
            </div>
            <button type="button" className="teacher-game-start-btn secondary" onClick={() => setShowLeaderboard(false)}>
              Back to Play
            </button>
          </div>
          <div className="teacher-game-leaderboard-list">
            {leaderboard.map((entry, index) => (
              <article key={entry.id} className="teacher-game-leaderboard-item">
                <div>
                  <span>#{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <small>Roll No: {entry.rollNumber}</small>
                </div>
                <div className="teacher-game-leaderboard-score">
                  <strong>{entry.score}</strong>
                  <span>{entry.correct} correct</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default TeacherGamePlay;
