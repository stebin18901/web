import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { collection, doc, getDoc, getDocs, increment, setDoc, writeBatch } from "firebase/firestore";
import { BlockMath, InlineMath } from "react-katex";
import { db } from "../firebase/firebaseConfig";
import { useQuiz } from "../context/QuizContext";
import "./QuizPage.css";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const CORRECT_MARKS = 4;
const WRONG_MARKS = 0;
const HELP_LIMIT_PER_QUIZ = 5;

const safeJsonParse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getQuestionText = (question) =>
  question?.text || question?.question || question?.prompt || question?.title || "Question";

const getQuizTitle = (quiz) =>
  quiz?.title || quiz?.metadata?.chapter || quiz?.quizData?.quizTitle || quiz?.chapter || "Quiz";

const cleanLabel = (value, fallback) => String(value || fallback || "General").trim();

const getQuizHelpUsageKey = (studentId, quizKey) =>
  `quizHelpUsage:${String(studentId || "guest")}:${String(quizKey || "quiz")}`;

const getQuizDraftKey = (studentId, quizKey) =>
  `quizDraft:${String(studentId || "guest")}_${String(quizKey || "quiz")}`;

const getQuizSubmissionKey = (studentId, quizKey) =>
  `quizSubmitted:${String(studentId || "guest")}_${String(quizKey || "quiz")}`;

const getQuizReportCacheKey = (studentId, quizKey) =>
  `quizReport:${String(studentId || "guest")}_${String(quizKey || "quiz")}`;

const getQuestionExplanation = (question) =>
  question?.explanation ||
  question?.concept_explanation ||
  question?.solution?.text ||
  question?.solution?.method ||
  question?.solution ||
  "";

const getQuestionHelpConcept = (question) =>
  question?.notes ||
  question?.concept ||
  question?.concept_explanation ||
  question?.hint ||
  "";

const getQuestionHelpSample = (question) =>
  question?.example ||
  question?.sampleQuestion ||
  question?.sample_question ||
  question?.sampleProblem ||
  question?.sample_problem ||
  question?.workedExample ||
  question?.worked_example ||
  "";

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

const isMultiQuestion = (question) => {
  const type = String(question?.type || question?.questionType || "").toLowerCase();
  return type.includes("multi") || type === "msq" || Array.isArray(question?.correctIndexes);
};

const isNumericalQuestion = (question, options) => {
  const type = String(question?.type || question?.questionType || "").toLowerCase();
  return options.length === 0 || type.includes("integer") || type.includes("numerical");
};

const getDifficultyBucket = (question) => {
  const raw = String(question?.difficulty || question?.level || question?.category || question?.type || "").toLowerCase();
  if (raw.includes("prereq")) return "Prerequisite Questions";
  if (raw.includes("practical") || raw.includes("application")) return "Practical Questions";
  if (raw.includes("entrance") || raw.includes("competitive")) return "Entrance-Level Questions";
  return "Concept Questions";
};

const hasAnswer = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  return String(value || "").trim().length > 0;
};

const isAnsweredCorrectly = (question, selected) => {
  if (!hasAnswer(selected)) return false;
  if (question.isNumerical) {
    return String(selected || "").trim() === String(question.answer ?? question.correctAnswer ?? "").trim();
  }

  const selectedKeys = Array.isArray(selected) ? selected : [selected];
  const correctKeys = question.correctKeys || [];
  if (!correctKeys.length) return false;
  return selectedKeys.length === correctKeys.length && selectedKeys.every((key) => correctKeys.includes(key));
};

const createEmptyStats = () => ({ total: 0, attempted: 0, correct: 0, wrong: 0, unanswered: 0, score: 0 });

const addStats = (stats, question, selected, correct) => {
  stats.total += 1;
  if (!hasAnswer(selected)) {
    stats.unanswered += 1;
    return;
  }
  stats.attempted += 1;
  if (correct) {
    stats.correct += 1;
    stats.score += CORRECT_MARKS;
  } else {
    stats.wrong += 1;
    stats.score += WRONG_MARKS;
  }
};

const finalizeStats = (stats) => ({
  ...stats,
  accuracy: stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0,
  percentage: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
});

const buildAnalytics = (questions, answers, statuses, startedAt) => {
  const summary = createEmptyStats();
  const subjectStats = {};
  const chapterStats = {};
  const difficultyStats = {};
  const responses = questions.map((question, index) => {
    const selected = answers[question.attemptId];
    const correct = isAnsweredCorrectly(question, selected);
    const answerStatus = hasAnswer(selected) ? (correct ? "correct" : "wrong") : "unanswered";
    const subject = cleanLabel(question.subject, "General");
    const chapter = cleanLabel(question.chapterName || question.chapter, question.quizTitle);
    const difficulty = getDifficultyBucket(question);

    addStats(summary, question, selected, correct);
    subjectStats[subject] = subjectStats[subject] || createEmptyStats();
    chapterStats[chapter] = chapterStats[chapter] || createEmptyStats();
    difficultyStats[difficulty] = difficultyStats[difficulty] || createEmptyStats();
    addStats(subjectStats[subject], question, selected, correct);
    addStats(chapterStats[chapter], question, selected, correct);
    addStats(difficultyStats[difficulty], question, selected, correct);

    return {
      questionId: question.attemptId,
      questionNumber: index + 1,
      quizId: question.quizId,
      subject,
      chapter,
      difficulty,
      questionText: question.text,
      selectedAnswer: selected || "",
      correctAnswer: question.isNumerical ? question.answer ?? question.correctAnswer ?? "" : question.correctKeys,
      status: statuses[question.attemptId] === "review" ? "markedForReview" : answerStatus,
      isCorrect: correct,
      marks: !hasAnswer(selected) ? 0 : correct ? CORRECT_MARKS : WRONG_MARKS,
    };
  });

  const attempted = summary.attempted;
  const totalTimeSeconds = Math.max(0, Math.round((Date.now() - startedAt) / 1000));
  const finalSummary = finalizeStats(summary);

  return {
    responses,
    summary: {
      ...finalSummary,
      skipped: finalSummary.unanswered,
      totalTimeSeconds,
      averageTimePerQuestion: questions.length ? Math.round(totalTimeSeconds / questions.length) : 0,
      attempted,
    },
    subjectStats: Object.fromEntries(Object.entries(subjectStats).map(([key, value]) => [key, finalizeStats(value)])),
    chapterStats: Object.fromEntries(Object.entries(chapterStats).map(([key, value]) => [key, finalizeStats(value)])),
    difficultyStats: Object.fromEntries(Object.entries(difficultyStats).map(([key, value]) => [key, finalizeStats(value)])),
  };
};

const getFeedback = (percentage) => {
  if (percentage >= 90) return "Outstanding! You are performing at entrance-exam level.";
  if (percentage >= 75) return "Great job! Keep practicing to reach the top ranks.";
  if (percentage >= 50) return "Good effort. A little more practice can significantly improve your score.";
  return "Don't worry. Review the concepts and try again.";
};

const getBadges = (summary, subjectStats, classRank) => {
  const badges = [];
  if (summary.attempted > 0 && summary.accuracy === 100) badges.push("Perfect Accuracy");
  if (classRank && classRank <= 10) badges.push("Top 10 Performer");
  Object.entries(subjectStats).forEach(([subject, stats]) => {
    if (stats.score >= 20 && stats.accuracy >= 80) badges.push(`${subject} Master`);
  });
  if (summary.score >= 40) badges.push("Consistency Champion");
  return [...new Set(badges)];
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const getWeekKey = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), 0, 1);
  const days = Math.floor((now - firstDay) / 86400000);
  const week = Math.ceil((days + firstDay.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
};

const decodeMathText = (value) =>
  String(value || "")
    .replace(/&middot;|&#183;|&#xB7;/g, "·")
    .replace(/&times;/g, "×")
    .replace(/&divide;/g, "÷")
    .replace(/&nbsp;/g, " ");

const normalizeLatex = (value) =>
  String(value || "")
    .replace(/·/g, " \\cdot ")
    .replace(/×/g, " \\times ")
    .replace(/÷/g, " \\div ");

const decodeHtmlEntities = (value) => {
  if (typeof window === "undefined") return String(value || "");
  const textarea = window.document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
};

const renderMathText = (value, className = "") => {
  const text = decodeHtmlEntities(decodeMathText(value));
  if (!text.trim()) return null;

  const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\))/g);
  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (!part) return null;
        if (part.startsWith("$$") && part.endsWith("$$")) {
          return <BlockMath key={index} math={normalizeLatex(part.slice(2, -2)).trim()} />;
        }
        if (part.startsWith("\\[") && part.endsWith("\\]")) {
          return <BlockMath key={index} math={normalizeLatex(part.slice(2, -2)).trim()} />;
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          return <InlineMath key={index} math={normalizeLatex(part.slice(1, -1)).trim()} />;
        }
        if (part.startsWith("\\(") && part.endsWith("\\)")) {
          return <InlineMath key={index} math={normalizeLatex(part.slice(2, -2)).trim()} />;
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

const getCorrectAnswerText = (question) => {
  if (!question) return "Not available";
  if (question.isNumerical) {
    return String(question.answer ?? question.correctAnswer ?? "").trim() || "Not available";
  }

  const keys = Array.isArray(question.correctKeys) ? question.correctKeys : [];
  if (!keys.length) return "Not available";

  return keys
    .map((key) => {
      const option = question.options.find((item) => item.key === key);
      return option ? `${option.key}. ${option.label}` : key;
    })
    .join(" | ");
};

const QuizPage = () => {
  const { quizId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { quizzes, loading } = useQuiz();
  const [answers, setAnswers] = useState({});
  const [statuses, setStatuses] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [revealedQuestions, setRevealedQuestions] = useState({});
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 980 : true
  );
  const [lastSavedCheckpoint, setLastSavedCheckpoint] = useState(0);

  const session = useMemo(() => safeJsonParse(localStorage.getItem("schoolStudentSession")), []);
  const requestedQuizIds = useMemo(() => {
    const stateIds = Array.isArray(location.state?.quizIds) ? location.state.quizIds : [];
    return stateIds.length ? stateIds : [quizId];
  }, [location.state, quizId]);

  const selectedQuizzes = useMemo(() => {
    const idSet = new Set(requestedQuizIds.filter(Boolean));
    return quizzes.filter((quiz) => idSet.has(quiz.id));
  }, [quizzes, requestedQuizIds]);

  const attemptQuestions = useMemo(() => {
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
          subject: cleanLabel(question.subject || quiz.subject || quiz.subjectName || quiz.metadata?.subject, "General"),
          chapterName: cleanLabel(
            question.chapterName || question.chapter || quiz.chapterName || quiz.chapter || quiz.metadata?.chapter,
            getQuizTitle(quiz)
          ),
          options,
          correctKeys: getCorrectKeys(question, options),
          isMulti: isMultiQuestion(question),
          isNumerical: isNumericalQuestion(question, options),
        };
      });
    });
  }, [selectedQuizzes]);

  const currentTitle = location.state?.chapterName || selectedQuizzes.map(getQuizTitle).join(" + ") || "Quiz";
  const quizAttemptKey = useMemo(
    () => quizId || requestedQuizIds.filter(Boolean).join("_") || "quiz",
    [quizId, requestedQuizIds]
  );
  const currentQuestion = attemptQuestions[currentIndex];
  const analytics = useMemo(
    () => buildAnalytics(attemptQuestions, answers, statuses, startedAt),
    [attemptQuestions, answers, statuses, startedAt]
  );
  const checkpointQuestions = useMemo(() => {
    const total = attemptQuestions.length;
    if (!total) return [];
    return [...new Set([1, 2, 3].map((step) => Math.min(total, Math.ceil((total * step) / 3))))];
  }, [attemptQuestions.length]);
  const answeredCount = analytics.summary.attempted;
  const completionPercentage = attemptQuestions.length
    ? Math.round((answeredCount / attemptQuestions.length) * 100)
    : 0;

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const [helpUsedCount, setHelpUsedCount] = useState(0);

  useEffect(() => {
    const storageKey = getQuizHelpUsageKey(session?.id, quizAttemptKey);
    const nextCount = Number(localStorage.getItem(storageKey) || 0);
    setHelpUsedCount(Number.isFinite(nextCount) ? nextCount : 0);
  }, [quizAttemptKey, session?.id]);

  useEffect(() => {
    if (!currentQuestion) return;
    setStatuses((prev) => (prev[currentQuestion.attemptId] ? prev : { ...prev, [currentQuestion.attemptId]: "visited" }));
  }, [currentQuestion]);

  useEffect(() => {
    setShowHelpPanel(false);
  }, [currentIndex]);

  useEffect(() => {
    if (!session?.id) return;
    const submittedKey = getQuizSubmissionKey(session.id, quizAttemptKey);
    const cachedSubmission = safeJsonParse(sessionStorage.getItem(submittedKey));
    if (!cachedSubmission) return;

    const reportCacheKey = getQuizReportCacheKey(session.id, quizAttemptKey);
    const cachedReport = safeJsonParse(sessionStorage.getItem(reportCacheKey));
    if (cachedReport) {
      navigate("/quiz-report", { state: { report: cachedReport }, replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  }, [navigate, quizAttemptKey, session?.id]);

  useEffect(() => {
    if (!session?.id || !attemptQuestions.length) return;
    const draftKey = getQuizDraftKey(session.id, quizAttemptKey);
    const savedDraft = safeJsonParse(localStorage.getItem(draftKey));
    if (!savedDraft) {
      setLastSavedCheckpoint(0);
      return;
    }

    if (savedDraft.answers && typeof savedDraft.answers === "object") {
      setAnswers(savedDraft.answers);
    }
    if (savedDraft.statuses && typeof savedDraft.statuses === "object") {
      setStatuses(savedDraft.statuses);
    }
    if (savedDraft.revealedQuestions && typeof savedDraft.revealedQuestions === "object") {
      setRevealedQuestions(savedDraft.revealedQuestions);
    }
    if (Number.isInteger(savedDraft.currentIndex)) {
      setCurrentIndex(Math.max(0, Math.min(savedDraft.currentIndex, attemptQuestions.length - 1)));
    }
    setLastSavedCheckpoint(Number(savedDraft.lastSavedCheckpoint) || 0);
  }, [attemptQuestions.length, quizAttemptKey, session?.id]);

  useEffect(() => {
    if (!session?.id || !attemptQuestions.length || !checkpointQuestions.length) return;

    const reachedCheckpoint = checkpointQuestions
      .filter((questionNumber) => currentIndex + 1 >= questionNumber)
      .at(-1);

    if (!reachedCheckpoint || reachedCheckpoint <= lastSavedCheckpoint) return;

    const payload = {
      studentId: session.id,
      quizId,
      chapterQuizIds: requestedQuizIds,
      quizTitle: currentTitle,
      answers,
      statuses,
      revealedQuestions,
      currentIndex,
      lastSavedCheckpoint: reachedCheckpoint,
      liveScore: analytics.summary.score,
      subjectStats: analytics.subjectStats,
      chapterStats: analytics.chapterStats,
      totalQuestions: attemptQuestions.length,
      attempted: analytics.summary.attempted,
      updatedAt: new Date().toISOString(),
    };

    const draftKey = getQuizDraftKey(session.id, quizAttemptKey);
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setDoc(doc(db, "quizLiveScores", `${session.id}_${quizAttemptKey}`), payload, { merge: true }).catch(() => {});
    setLastSavedCheckpoint(reachedCheckpoint);
  }, [
    analytics,
    answers,
    attemptQuestions.length,
    checkpointQuestions,
    currentIndex,
    currentTitle,
    lastSavedCheckpoint,
    quizAttemptKey,
    quizId,
    requestedQuizIds,
    revealedQuestions,
    session?.id,
    statuses,
  ]);

  const revealQuestion = (question) => {
    if (!question) return;
    setRevealedQuestions((prev) => ({ ...prev, [question.attemptId]: true }));
  };

  const handleHelpToggle = () => {
    if (!hasQuestionHelp) return;

    if (showHelpPanel) {
      setShowHelpPanel(false);
      return;
    }

    if (helpUsedCount >= HELP_LIMIT_PER_QUIZ) {
      setError(`Help limit reached for this quiz. You can use help only ${HELP_LIMIT_PER_QUIZ} times.`);
      return;
    }

    const nextCount = helpUsedCount + 1;
    const storageKey = getQuizHelpUsageKey(session?.id, quizAttemptKey);
    localStorage.setItem(storageKey, String(nextCount));
    setHelpUsedCount(nextCount);
    setError("");
    setShowHelpPanel(true);
  };

  const selectOption = (question, optionKey) => {
    if (revealedQuestions[question.attemptId]) return;

    setAnswers((prev) => {
      if (!question.isMulti) return { ...prev, [question.attemptId]: optionKey };
      const current = Array.isArray(prev[question.attemptId]) ? prev[question.attemptId] : [];
      const exists = current.includes(optionKey);
      return { ...prev, [question.attemptId]: exists ? current.filter((key) => key !== optionKey) : [...current, optionKey] };
    });
    setStatuses((prev) => ({ ...prev, [question.attemptId]: "answered" }));

    if (!question.isMulti) {
      setRevealedQuestions((prev) => ({ ...prev, [question.attemptId]: true }));
    }
  };

  const setNumericalAnswer = (question, value) => {
    if (revealedQuestions[question.attemptId]) return;
    setAnswers((prev) => ({ ...prev, [question.attemptId]: value }));
    setStatuses((prev) => ({ ...prev, [question.attemptId]: hasAnswer(value) ? "answered" : "visited" }));
  };

  const checkCurrentAnswer = () => {
    if (!currentQuestion) return;
    const selected = answers[currentQuestion.attemptId];
    if (!hasAnswer(selected)) {
      setError("Please answer the question first.");
      return;
    }
    setError("");
    revealQuestion(currentQuestion);
    setStatuses((prev) => ({ ...prev, [currentQuestion.attemptId]: "answered" }));
  };

  const getQuestionStatus = (question) => {
    if (!question) return "notVisited";
    if (statuses[question.attemptId] === "review") return "review";
    if (hasAnswer(answers[question.attemptId])) return "answered";
    return statuses[question.attemptId] || "notVisited";
  };

  const goToQuestion = (index) => {
    if (index < 0 || index >= attemptQuestions.length) return;
    setCurrentIndex(index);
  };

  const toggleReview = () => {
    if (!currentQuestion) return;
    setStatuses((prev) => ({
      ...prev,
      [currentQuestion.attemptId]: prev[currentQuestion.attemptId] === "review" ? (hasAnswer(answers[currentQuestion.attemptId]) ? "answered" : "visited") : "review",
    }));
  };

  const calculateRanks = async (score) => {
    try {
      const ranksSnap = await getDocs(collection(db, "leaderboardScores"));
      const rows = ranksSnap.docs.map((rankDoc) => ({ id: rankDoc.id, ...rankDoc.data() })).filter((row) => row.studentId);
      const withCurrent = rows
        .filter((row) => row.studentId !== session.id)
        .concat({
          studentId: session.id,
          schoolId: session.schoolId || "",
          className: session.className || "",
          overallScore: score,
        })
        .sort((a, b) => Number(b.overallScore || 0) - Number(a.overallScore || 0));
      const overallRank = withCurrent.findIndex((row) => row.studentId === session.id) + 1;
      const schoolRank = withCurrent.filter((row) => row.schoolId === session.schoolId).findIndex((row) => row.studentId === session.id) + 1;
      const classRank = withCurrent
        .filter((row) => row.schoolId === session.schoolId && String(row.className || "") === String(session.className || ""))
        .findIndex((row) => row.studentId === session.id) + 1;
      return { overallRank: overallRank || null, schoolRank: schoolRank || null, classRank: classRank || null };
    } catch {
      return { overallRank: null, schoolRank: null, classRank: null };
    }
  };

  const handleSubmit = async () => {
    if (!session) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const attemptId = `${session.id}_${quizId || requestedQuizIds.join("_")}_${Date.now()}`;
      const finalAnalytics = buildAnalytics(attemptQuestions, answers, statuses, startedAt);
      const previousStatsSnap = await getDoc(doc(db, "userStats", session.id));
      const previousStats = previousStatsSnap.exists() ? previousStatsSnap.data() : {};
      const previousLeaderboardSnap = await getDoc(doc(db, "leaderboardScores", session.id));
      const previousLeaderboard = previousLeaderboardSnap.exists() ? previousLeaderboardSnap.data() : {};
      const previousTotalScore = Number(previousStats.totalScore || 0);
      const newOverallScore = previousTotalScore + finalAnalytics.summary.score;
      const ranks = await calculateRanks(newOverallScore);
      const badges = getBadges(finalAnalytics.summary, finalAnalytics.subjectStats, ranks.classRank);
      const weekKey = getWeekKey();
      const monthKey = new Date().toISOString().slice(0, 7);
      const weeklyScore =
        previousLeaderboard.weekKey === weekKey
          ? Number(previousLeaderboard.weeklyScore || 0) + finalAnalytics.summary.score
          : finalAnalytics.summary.score;
      const monthlyScore =
        previousLeaderboard.monthKey === monthKey
          ? Number(previousLeaderboard.monthlyScore || 0) + finalAnalytics.summary.score
          : finalAnalytics.summary.score;
      const report = {
        attemptId,
        reportType: "final",
        studentId: session.id,
        studentName: session.name || "Student",
        schoolId: session.schoolId || "",
        schoolName: session.schoolName || "",
        className: session.className || "",
        quizId,
        chapterQuizIds: requestedQuizIds,
        quizTitle: currentTitle,
        chapterName: location.state?.chapterName || "",
        totalQuestions: finalAnalytics.summary.total,
        attendedCount: finalAnalytics.summary.attempted,
        attemptedCount: finalAnalytics.summary.attempted,
        correctCount: finalAnalytics.summary.correct,
        wrongCount: finalAnalytics.summary.wrong,
        unattendedCount: finalAnalytics.summary.unanswered,
        unansweredCount: finalAnalytics.summary.unanswered,
        skippedCount: finalAnalytics.summary.skipped,
        score: finalAnalytics.summary.score,
        percentage: finalAnalytics.summary.percentage,
        accuracy: finalAnalytics.summary.accuracy,
        totalTimeSeconds: finalAnalytics.summary.totalTimeSeconds,
        averageTimePerQuestion: finalAnalytics.summary.averageTimePerQuestion,
        answers,
        questionResponses: finalAnalytics.responses,
        subjectStats: finalAnalytics.subjectStats,
        chapterStats: finalAnalytics.chapterStats,
        difficultyStats: finalAnalytics.difficultyStats,
        ranks,
        badges,
        feedback: getFeedback(finalAnalytics.summary.percentage),
        submittedAt: new Date().toISOString(),
      };

      const batch = writeBatch(db);
      const reportRef = doc(collection(db, "reports"));
      batch.set(reportRef, report);
      batch.set(doc(db, "userQuizAttempts", attemptId), report);
      finalAnalytics.responses.forEach((response) => {
        batch.set(doc(db, "userQuizAttempts", attemptId, "responses", response.questionId), response);
      });
      batch.set(
        doc(db, "userStats", session.id),
        {
          studentId: session.id,
          studentName: session.name || "Student",
          schoolId: session.schoolId || "",
          schoolName: session.schoolName || "",
          className: session.className || "",
          totalScore: increment(finalAnalytics.summary.score),
          totalQuestionsAttempted: increment(finalAnalytics.summary.attempted),
          totalCorrectAnswers: increment(finalAnalytics.summary.correct),
          totalWrongAnswers: increment(finalAnalytics.summary.wrong),
          totalQuizzesCompleted: increment(1),
          bestQuizScore: Math.max(Number(previousStats.bestQuizScore || 0), finalAnalytics.summary.score),
          averageQuizScore:
            Math.round(((Number(previousStats.averageQuizScore || 0) * Number(previousStats.totalQuizzesCompleted || 0)) + finalAnalytics.summary.score) /
            (Number(previousStats.totalQuizzesCompleted || 0) + 1)),
          overallAccuracy:
            finalAnalytics.summary.attempted + Number(previousStats.totalQuestionsAttempted || 0)
              ? Math.round(
                  ((finalAnalytics.summary.correct + Number(previousStats.totalCorrectAnswers || 0)) /
                    (finalAnalytics.summary.attempted + Number(previousStats.totalQuestionsAttempted || 0))) *
                    100
                )
              : 0,
          currentRank: ranks.overallRank,
          highestRankAchieved: previousStats.highestRankAchieved
            ? Math.min(Number(previousStats.highestRankAchieved), ranks.overallRank || Number(previousStats.highestRankAchieved))
            : ranks.overallRank,
          lastActivityDate: new Date().toISOString().slice(0, 10),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      batch.set(
        doc(db, "leaderboardScores", session.id),
        {
          studentId: session.id,
          studentName: session.name || "Student",
          schoolId: session.schoolId || "",
          schoolName: session.schoolName || "",
          className: session.className || "",
          overallScore: newOverallScore,
          overallAccuracy:
            finalAnalytics.summary.attempted + Number(previousStats.totalQuestionsAttempted || 0)
              ? Math.round(
                  ((finalAnalytics.summary.correct + Number(previousStats.totalCorrectAnswers || 0)) /
                    (finalAnalytics.summary.attempted + Number(previousStats.totalQuestionsAttempted || 0))) *
                    100
                )
              : 0,
          weeklyScore,
          monthlyScore,
          weekKey,
          monthKey,
          subjectScores: finalAnalytics.subjectStats,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      await batch.commit();

      const draftKey = getQuizDraftKey(session.id, quizAttemptKey);
      const helpUsageKey = getQuizHelpUsageKey(session.id, quizAttemptKey);
      const submittedKey = getQuizSubmissionKey(session.id, quizAttemptKey);
      const reportCacheKey = getQuizReportCacheKey(session.id, quizAttemptKey);

      localStorage.removeItem(draftKey);
      localStorage.removeItem(helpUsageKey);
      sessionStorage.setItem(
        submittedKey,
        JSON.stringify({
          attemptId,
          submittedAt: report.submittedAt,
          quizTitle: report.quizTitle,
        })
      );
      sessionStorage.setItem(reportCacheKey, JSON.stringify(report));
      sessionStorage.setItem("lastQuizReport", JSON.stringify(report));

      navigate("/quiz-report", { state: { report }, replace: true });
    } catch (err) {
      setError("Unable to submit quiz: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="quiz-master-page">Loading quiz...</div>;
  if (!selectedQuizzes.length) return <div className="quiz-master-page">Quiz not found.</div>;
  if (!attemptQuestions.length) return <div className="quiz-master-page">No questions found for this quiz.</div>;

  const currentSelected = answers[currentQuestion.attemptId];
  const currentQuestionRevealed = !!revealedQuestions[currentQuestion.attemptId];
  const currentQuestionCorrect = isAnsweredCorrectly(currentQuestion, currentSelected);
  const currentQuestionExplanation = getQuestionExplanation(currentQuestion);
  const currentCorrectAnswerText = getCorrectAnswerText(currentQuestion);
  const currentQuestionConceptHelp = getQuestionHelpConcept(currentQuestion);
  const currentQuestionSampleHelp = getQuestionHelpSample(currentQuestion);
  const hasQuestionHelp =
    !!String(currentQuestionConceptHelp || "").trim() ||
    !!String(currentQuestionSampleHelp || "").trim() ||
    !!currentQuestion?.notesImage;
  const helpRemaining = Math.max(0, HELP_LIMIT_PER_QUIZ - helpUsedCount);

    return (
      <div className="quiz-master-page">
        <header className="qm-topbar">
          <div className="qm-topbar-main">
            <button
              type="button"
              className="qm-back-icon-btn"
              onClick={() => navigate("/dashboard")}
              aria-label="Back to dashboard"
              title="Back"
            >
              ←
            </button>
            <div>
              <h1>{currentTitle}</h1>
              <p>{selectedQuizzes.length} quiz set(s) | {attemptQuestions.length} questions | Time {formatTime(elapsedSeconds)}</p>
            </div>
          </div>
          <div className="qm-score-box">
            <span>Current Quiz Score</span>
            <strong>{analytics.summary.score}</strong>
          </div>
        </header>

      {isPaletteOpen ? (
        <button
          type="button"
          className="qm-sidebar-scrim"
          aria-label="Close question palette"
          onClick={() => setIsPaletteOpen(false)}
        />
      ) : null}

      <button
        type="button"
        className={`qm-sidebar-handle ${isPaletteOpen ? "open" : "closed"}`}
        onClick={() => setIsPaletteOpen((prev) => !prev)}
        aria-expanded={isPaletteOpen}
        aria-controls="qm-question-palette"
        aria-label={isPaletteOpen ? "Hide question palette" : "Show question palette"}
        title={isPaletteOpen ? "Hide question palette" : "Show question palette"}
      >
        <span>{isPaletteOpen ? "‹" : "›"}</span>
      </button>

      <div className={`qm-body ${isPaletteOpen ? "palette-open" : "palette-closed"}`}>
        <aside
          id="qm-question-palette"
          className={`qm-sidebar ${isPaletteOpen ? "open" : "closed"}`}
        >
          <h3>Question Palette</h3>
          <div className="legend"><span className="dot not-visited" /> Not Visited</div>
          <div className="legend"><span className="dot visited" /> Visited</div>
          <div className="legend"><span className="dot done" /> Answered</div>
          <div className="legend"><span className="dot review" /> Marked for Review</div>
          <div className="qm-number-grid">
            {attemptQuestions.map((question, index) => {
              const status = getQuestionStatus(question);
              const isCheckpoint = checkpointQuestions.includes(index + 1);
              return (
                <button
                  key={question.attemptId}
                  className={`qm-num ${status} ${index === currentIndex ? "current" : ""} ${isCheckpoint ? "checkpoint" : ""}`}
                  onClick={() => goToQuestion(index)}
                  type="button"
                  title={isCheckpoint ? `Checkpoint question ${index + 1}` : `Question ${index + 1}`}
                >
                  {isCheckpoint ? <span className="qm-num-flag">CP</span> : null}
                  {index + 1}
                </button>
              );
            })}
          </div>
          <button className="mark-review-btn" type="button" onClick={toggleReview}>
            {getQuestionStatus(currentQuestion) === "review" ? "Unmark Review" : "Mark for Review"}
          </button>
        </aside>

        <main className="qm-main">
          <section className="qm-meta-card">
            <div><span>Student</span><strong>{session?.name || "Student"}</strong></div>
            <div><span>Progress</span><strong>Question {currentIndex + 1} of {attemptQuestions.length}</strong></div>
            <div><span>Completion</span><strong>{completionPercentage}%</strong></div>
            <div><span>Subject Score</span><strong>{analytics.subjectStats[currentQuestion.subject]?.score || 0}</strong></div>
            <div><span>Chapter Score</span><strong>{analytics.chapterStats[currentQuestion.chapterName]?.score || 0}</strong></div>
            <div><span>Overall Attempted</span><strong>{answeredCount}/{attemptQuestions.length}</strong></div>
          </section>
          <div className="qm-progress-line"><div style={{ width: `${completionPercentage}%` }} /></div>

          <section className="qm-question-card">
            <div className="qm-question-topbar">
              <div className="qm-question-kicker">
                <span>{currentQuestion.subject}</span>
                <span>{currentQuestion.chapterName}</span>
                <span>{getDifficultyBucket(currentQuestion)}</span>
              </div>
                <button
                  type="button"
                  className="qm-help-btn"
                  onClick={handleHelpToggle}
                  aria-expanded={showHelpPanel}
                  aria-controls="qm-help-panel"
                  disabled={!hasQuestionHelp || (!showHelpPanel && helpUsedCount >= HELP_LIMIT_PER_QUIZ)}
                  title={
                    !hasQuestionHelp
                      ? "No concept help available"
                      : !showHelpPanel && helpUsedCount >= HELP_LIMIT_PER_QUIZ
                        ? `Help limit reached (${HELP_LIMIT_PER_QUIZ}/${HELP_LIMIT_PER_QUIZ})`
                        : `Show concept help (${helpRemaining} left)`
                  }
                >
                  <span>?</span>
                  <small>{helpRemaining}</small>
                </button>
              </div>
              <div className="qm-help-usage">
                Help used: {helpUsedCount}/{HELP_LIMIT_PER_QUIZ}
                {hasQuestionHelp && helpRemaining > 0 ? ` • ${helpRemaining} left` : ""}
              </div>
            <h2>
              <span>{currentIndex + 1}. </span>
              {renderMathText(currentQuestion.text, "qm-latex-question")}
            </h2>
            {currentQuestion.imageUrl && <img className="qm-question-image" src={currentQuestion.imageUrl} alt="Question" />}

            {showHelpPanel && hasQuestionHelp && (
              <aside id="qm-help-panel" className="qm-help-panel">
                <div className="qm-help-panel-head">
                  <strong>Question Help</strong>
                  <span>Concept and worked sample from your dataset</span>
                </div>

                {currentQuestionConceptHelp ? (
                  <div className="qm-help-block">
                    <label>Concept</label>
                    <div>{renderMathText(currentQuestionConceptHelp, "qm-latex-explanation")}</div>
                  </div>
                ) : null}

                {currentQuestionSampleHelp ? (
                  <div className="qm-help-block">
                    <label>Sample Problem</label>
                    <div>{renderMathText(currentQuestionSampleHelp, "qm-latex-explanation")}</div>
                  </div>
                ) : null}

                {currentQuestion?.notesImage ? (
                  <div className="qm-help-block">
                    <label>Reference</label>
                    <img
                      className="qm-help-image"
                      src={currentQuestion.notesImage}
                      alt="Question help reference"
                    />
                  </div>
                ) : null}
              </aside>
            )}

            {currentQuestion.isNumerical ? (
              <>
                <input
                  className="login-input"
                  value={currentSelected || ""}
                  onChange={(event) => setNumericalAnswer(currentQuestion, event.target.value)}
                  placeholder="Enter answer"
                  disabled={currentQuestionRevealed}
                />
                {!currentQuestionRevealed && (
                  <button className="qm-check-btn" type="button" onClick={checkCurrentAnswer}>
                    Check Answer
                  </button>
                )}
              </>
            ) : (
              <div className="qm-options">
                {currentQuestion.options.map((option) => {
                  const isSelected = Array.isArray(currentSelected)
                    ? currentSelected.includes(option.key)
                    : currentSelected === option.key;
                  const isCorrectOption = currentQuestion.correctKeys.includes(option.key);
                  const isWrongSelected = currentQuestionRevealed && isSelected && !isCorrectOption;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      className={`qm-option ${isSelected ? "selected" : ""} ${currentQuestionRevealed && isCorrectOption ? "correct" : ""} ${isWrongSelected ? "incorrect" : ""}`}
                      onClick={() => selectOption(currentQuestion, option.key)}
                      disabled={currentQuestionRevealed}
                    >
                      <span className="opt-badge">{option.key}</span>
                      {renderMathText(option.label, "opt-text")}
                      <input className="opt-radio" type={currentQuestion.isMulti ? "checkbox" : "radio"} checked={isSelected} readOnly />
                    </button>
                  );
                })}
              </div>
            )}

            {currentQuestion.isMulti && !currentQuestionRevealed && (
              <button className="qm-check-btn" type="button" onClick={checkCurrentAnswer}>
                Check Answer
              </button>
            )}

            {currentQuestionRevealed && (
              <div className={`qm-result-note ${currentQuestionCorrect ? "correct" : "incorrect"}`}>
                <strong>
                  {currentQuestionCorrect ? `Correct! +${CORRECT_MARKS} points` : `Incorrect. +${WRONG_MARKS} points`}
                </strong>
                <div className="qm-result-answer">
                  <span>Correct Answer</span>
                  <div>{renderMathText(currentCorrectAnswerText, "qm-latex-explanation")}</div>
                </div>
                {currentQuestionExplanation ? (
                  <div className="qm-result-answer">
                    <span>Explanation</span>
                    <div>{renderMathText(currentQuestionExplanation, "qm-latex-explanation")}</div>
                  </div>
                ) : (
                  <div className="qm-result-answer">
                    <span>Explanation</span>
                    <div>No explanation provided.</div>
                  </div>
                )}
              </div>
            )}
          </section>

          {error && <div className="login-error">{error}</div>}
          <div className="qm-quiz-actions">
            <button type="button" onClick={() => goToQuestion(currentIndex - 1)} disabled={currentIndex === 0}>Previous</button>
            <button type="button" onClick={() => goToQuestion(currentIndex + 1)} disabled={currentIndex === attemptQuestions.length - 1}>Next</button>
            <button className="submit-btn" type="button" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Quiz"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default QuizPage;
