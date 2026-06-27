import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import {
  buildQuizDemoSearch,
  getQuizChapter,
  getQuizClass,
  getQuizConcept,
  getQuizSubject,
  normalizePreviewText,
} from "../../utils/quizDemoShare";
import "./AdminQuizDemoPdf.css";

const AdminQuizDemoPdf = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadQuizzes = async () => {
      setLoading(true);
      setError("");

      try {
        const snap = await getDocs(collection(db, "quizzes"));
        const rows = snap.docs
          .map((entry) => ({ id: entry.id, ...entry.data() }))
          .filter(
            (quiz) => getQuizClass(quiz) && getQuizSubject(quiz) && getQuizChapter(quiz)
          );
        setQuizzes(rows);
      } catch (err) {
        console.error("quiz demo fetch error", err);
        setError("Failed to load quizzes for the demo share page.");
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, []);

  const classOptions = useMemo(
    () =>
      [...new Set(quizzes.map((quiz) => getQuizClass(quiz)).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, undefined, { numeric: true })
      ),
    [quizzes]
  );

  const subjectOptions = useMemo(() => {
    const base = quizzes.filter(
      (quiz) => !selectedClass || getQuizClass(quiz) === selectedClass
    );
    return [...new Set(base.map((quiz) => getQuizSubject(quiz)).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [quizzes, selectedClass]);

  const chapterOptions = useMemo(() => {
    const base = quizzes.filter(
      (quiz) =>
        (!selectedClass || getQuizClass(quiz) === selectedClass) &&
        (!selectedSubject || getQuizSubject(quiz) === selectedSubject)
    );
    return [...new Set(base.map((quiz) => getQuizChapter(quiz)).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b)
    );
  }, [quizzes, selectedClass, selectedSubject]);

  const filteredQuizzes = useMemo(() => {
    return quizzes
      .filter(
        (quiz) =>
          (!selectedClass || getQuizClass(quiz) === selectedClass) &&
          (!selectedSubject || getQuizSubject(quiz) === selectedSubject) &&
          (!selectedChapter || getQuizChapter(quiz) === selectedChapter)
      )
      .sort((a, b) => {
        const conceptCompare = getQuizConcept(a).localeCompare(getQuizConcept(b));
        if (conceptCompare !== 0) return conceptCompare;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });
  }, [quizzes, selectedClass, selectedSubject, selectedChapter]);

  const totalQuestions = useMemo(
    () =>
      filteredQuizzes.reduce(
        (sum, quiz) => sum + (Array.isArray(quiz.questions) ? quiz.questions.length : 0),
        0
      ),
    [filteredQuizzes]
  );

  const shareLink = useMemo(() => {
    if (!selectedClass || !selectedSubject || !selectedChapter) return "";
    const search = buildQuizDemoSearch({
      selectedClass,
      selectedSubject,
      selectedChapter,
    });
    const origin = window.location.origin || "";
    return `${origin}/quiz-demo-share?${search}`;
  }, [selectedClass, selectedSubject, selectedChapter]);

  useEffect(() => {
    if (selectedClass && !classOptions.includes(selectedClass)) {
      setSelectedClass("");
    }
  }, [classOptions, selectedClass]);

  useEffect(() => {
    if (selectedSubject && !subjectOptions.includes(selectedSubject)) {
      setSelectedSubject("");
    }
  }, [subjectOptions, selectedSubject]);

  useEffect(() => {
    if (selectedChapter && !chapterOptions.includes(selectedChapter)) {
      setSelectedChapter("");
    }
  }, [chapterOptions, selectedChapter]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 2200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const isDisabled =
    loading ||
    opening ||
    !selectedClass ||
    !selectedSubject ||
    !selectedChapter ||
    filteredQuizzes.length === 0;

  const openSharePage = () => {
    if (isDisabled || !shareLink) {
      setError("Select class, subject, and chapter with available quiz data.");
      return;
    }

    setOpening(true);
    setError("");
    window.open(shareLink, "_blank", "noopener,noreferrer");
    window.setTimeout(() => setOpening(false), 300);
  };

  const copyShareLink = async () => {
    if (isDisabled || !shareLink) {
      setError("Select class, subject, and chapter with available quiz data.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setError("");
    } catch (err) {
      console.error("copy share link error", err);
      setError("Unable to copy the share link on this device.");
    }
  };

  return (
    <div className="quiz-demo-admin">
      <section className="quiz-demo-hero">
        <div>
          <span className="quiz-demo-kicker">Admin / Demo Kit</span>
          <h2>Create a shareable chapter demo page</h2>
          <p>
            Select class, subject, and chapter, then open a polished public page
            with proper LaTeX rendering, structured questions, answers,
            explanations, and worked examples.
          </p>
        </div>
        <div className="quiz-demo-stats">
          <div className="quiz-demo-stat">
            <span>Total Quiz Sets</span>
            <strong>{quizzes.length}</strong>
          </div>
          <div className="quiz-demo-stat">
            <span>Matching Sets</span>
            <strong>{filteredQuizzes.length}</strong>
          </div>
          <div className="quiz-demo-stat">
            <span>Questions Included</span>
            <strong>{totalQuestions}</strong>
          </div>
        </div>
      </section>

      <section className="quiz-demo-panel">
        <div className="quiz-demo-toolbar">
          <select
            value={selectedClass}
            onChange={(event) => {
              setSelectedClass(event.target.value);
              setSelectedSubject("");
              setSelectedChapter("");
            }}
            disabled={loading}
          >
            <option value="">Select Class</option>
            {classOptions.map((item) => (
              <option key={item} value={item}>
                Class {item}
              </option>
            ))}
          </select>

          <select
            value={selectedSubject}
            onChange={(event) => {
              setSelectedSubject(event.target.value);
              setSelectedChapter("");
            }}
            disabled={!selectedClass || loading}
          >
            <option value="">Select Subject</option>
            {subjectOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={selectedChapter}
            onChange={(event) => setSelectedChapter(event.target.value)}
            disabled={!selectedSubject || loading}
          >
            <option value="">Select Chapter</option>
            {chapterOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button type="button" onClick={openSharePage} disabled={isDisabled}>
            {opening ? "Opening..." : "Open Share Page"}
          </button>
        </div>

        <div className="quiz-demo-toolbar quiz-demo-secondary-actions">
          <button
            type="button"
            className="quiz-demo-secondary-btn"
            onClick={copyShareLink}
            disabled={isDisabled}
          >
            {copied ? "Link Copied" : "Copy Share Link"}
          </button>
          <input
            className="quiz-demo-link"
            readOnly
            value={shareLink || "Share link will appear here after selecting filters"}
          />
        </div>

        {error && <div className="quiz-demo-error">{error}</div>}

        <div className="quiz-demo-preview">
          <div className="quiz-demo-preview-head">
            <h3>Share Page Preview</h3>
            <span>
              {selectedClass && selectedSubject && selectedChapter
                ? `Class ${selectedClass} / ${selectedSubject} / ${selectedChapter}`
                : "Choose filters to preview"}
            </span>
          </div>

          {loading ? (
            <p className="quiz-demo-empty">Loading quizzes...</p>
          ) : filteredQuizzes.length === 0 ? (
            <p className="quiz-demo-empty">
              No quiz sets found for the current selection.
            </p>
          ) : (
            <div className="quiz-demo-list">
              {filteredQuizzes.map((quiz, index) => (
                <article key={quiz.id} className="quiz-demo-card">
                  <div className="quiz-demo-card-top">
                    <div>
                      <p className="quiz-demo-card-label">Quiz Set {index + 1}</p>
                      <h4>{getQuizConcept(quiz) || "Concept Demo"}</h4>
                    </div>
                    <span>
                      {Array.isArray(quiz.questions) ? quiz.questions.length : 0} questions
                    </span>
                  </div>
                  <p className="quiz-demo-card-copy">
                    Program: {normalizePreviewText(quiz?.metadata?.program || "-")}
                  </p>
                  <ul>
                    {(quiz.questions || []).slice(0, 3).map((question, qIndex) => (
                      <li key={question.id || qIndex}>
                        <strong>Q{qIndex + 1}.</strong>{" "}
                        {normalizePreviewText(question.question || "-")}
                      </li>
                    ))}
                  </ul>
                  {Array.isArray(quiz.questions) && quiz.questions.length > 3 && (
                    <p className="quiz-demo-more">
                      + {quiz.questions.length - 3} more questions on the share page
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default AdminQuizDemoPdf;
