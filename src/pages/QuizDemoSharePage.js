import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useLocation } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import {
  getQuizChapter,
  getQuizClass,
  getQuizConcept,
  getQuizSubject,
  getQuestionOptions,
  normalizePreviewText,
  parseExampleSteps,
  renderMathText,
} from "../utils/quizDemoShare";
import "./QuizDemoSharePage.css";

const useQuery = () => new URLSearchParams(useLocation().search);

const QuizDemoSharePage = () => {
  const query = useQuery();
  const selectedClass = normalizePreviewText(query.get("class"));
  const selectedSubject = normalizePreviewText(query.get("subject"));
  const selectedChapter = normalizePreviewText(query.get("chapter"));

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
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
        console.error("quiz share fetch error", err);
        setError("Unable to load this chapter demo right now.");
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, []);

  const filteredQuizzes = useMemo(() => {
    return quizzes
      .filter(
        (quiz) =>
          (!selectedClass || getQuizClass(quiz) === selectedClass) &&
          (!selectedSubject || getQuizSubject(quiz) === selectedSubject) &&
          (!selectedChapter || getQuizChapter(quiz) === selectedChapter)
      )
      .sort((a, b) => getQuizConcept(a).localeCompare(getQuizConcept(b)));
  }, [quizzes, selectedClass, selectedSubject, selectedChapter]);

  const totalQuestions = useMemo(
    () =>
      filteredQuizzes.reduce(
        (sum, quiz) => sum + (Array.isArray(quiz.questions) ? quiz.questions.length : 0),
        0
      ),
    [filteredQuizzes]
  );

  const references = useMemo(() => {
    const values = new Set();
    filteredQuizzes.forEach((quiz) => {
      (quiz?.metadata?.references || []).forEach((item) => {
        const value = normalizePreviewText(item);
        if (value) values.add(value);
      });
    });
    return [...values];
  }, [filteredQuizzes]);

  const isMissingFilters = !selectedClass || !selectedSubject || !selectedChapter;

  return (
    <div className="quiz-share-page">
      <section className="quiz-share-hero">
        <div className="quiz-share-hero-copy">
          <span className="quiz-share-kicker">Hepsy Demo Chapter</span>
          <h1>{selectedChapter || "Quiz Demo"}</h1>
          <p>
            A share-ready chapter showcase for schools, teachers, and academic
            decision-makers. Each question includes concept focus, options,
            correct answer, explanation, and worked example.
          </p>
          <div className="quiz-share-badges">
            <span>Class {selectedClass || "-"}</span>
            <span>{selectedSubject || "-"}</span>
            <span>{filteredQuizzes.length} quiz sets</span>
            <span>{totalQuestions} questions</span>
          </div>
        </div>

        <aside className="quiz-share-summary">
          <div>
            <span>Program</span>
            <strong>
              {normalizePreviewText(filteredQuizzes[0]?.metadata?.program || "Hepsy Academic Demo")}
            </strong>
          </div>
          <div>
            <span>Subject Variant</span>
            <strong>
              {normalizePreviewText(filteredQuizzes[0]?.metadata?.subject_variant || selectedSubject || "-")}
            </strong>
          </div>
          <div>
            <span>Learning Path</span>
            <strong>
              {normalizePreviewText(
                (filteredQuizzes[0]?.metadata?.learning_path || []).join(" / ") || selectedChapter || "-"
              )}
            </strong>
          </div>
        </aside>
      </section>

      {isMissingFilters ? (
        <section className="quiz-share-state">
          <h2>Chapter details are missing</h2>
          <p>Open this page using the share link generated from the admin panel.</p>
        </section>
      ) : loading ? (
        <section className="quiz-share-state">
          <h2>Loading chapter demo...</h2>
        </section>
      ) : error ? (
        <section className="quiz-share-state error">
          <h2>{error}</h2>
        </section>
      ) : filteredQuizzes.length === 0 ? (
        <section className="quiz-share-state">
          <h2>No quiz sets found</h2>
          <p>There are no demo questions yet for this class, subject, and chapter.</p>
        </section>
      ) : (
        <>
          {references.length > 0 && (
            <section className="quiz-share-section">
              <div className="quiz-share-section-head">
                <h2>Reference Sources</h2>
              </div>
              <div className="quiz-share-reference-list">
                {references.map((item) => (
                  <div key={item} className="quiz-share-reference-item">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          )}

          {filteredQuizzes.map((quiz, quizIndex) => (
            <section key={quiz.id} className="quiz-share-section">
              <div className="quiz-share-section-head">
                <div>
                  <p>Quiz Set {quizIndex + 1}</p>
                  <h2>{getQuizConcept(quiz) || "Concept Demo"}</h2>
                </div>
                <span>
                  {Array.isArray(quiz.questions) ? quiz.questions.length : 0} questions
                </span>
              </div>

              <div className="quiz-share-meta-grid">
                <div>
                  <span>Program</span>
                  <strong>{normalizePreviewText(quiz?.metadata?.program || "-")}</strong>
                </div>
                <div>
                  <span>Subject Variant</span>
                  <strong>{normalizePreviewText(quiz?.metadata?.subject_variant || "-")}</strong>
                </div>
                <div>
                  <span>Learning Path</span>
                  <strong>
                    {normalizePreviewText((quiz?.metadata?.learning_path || []).join(" / ") || "-")}
                  </strong>
                </div>
              </div>

              <div className="quiz-share-card-list">
                {(quiz.questions || []).map((question, questionIndex) => {
                  const options = getQuestionOptions(question);
                  const exampleSteps = parseExampleSteps(question?.example);

                  return (
                    <article key={question.id || questionIndex} className="quiz-share-card">
                      <div className="quiz-share-card-top">
                        <div>
                          <p>Question {questionIndex + 1}</p>
                          <h3>{renderMathText(question?.question || "-", "quiz-share-question", `question-${quiz.id}-${questionIndex}`)}</h3>
                        </div>
                        <div className="quiz-share-pill-group">
                          <span>{normalizePreviewText(question?.difficulty || "Not specified")}</span>
                          <span>{normalizePreviewText(question?.type || "MCQ")}</span>
                        </div>
                      </div>

                      <div className="quiz-share-concept">
                        <label>Question Concept</label>
                        <div>
                          {renderMathText(
                            question?.concept || getQuizConcept(quiz) || "-",
                            "quiz-share-body",
                            `concept-${quiz.id}-${questionIndex}`
                          )}
                        </div>
                      </div>

                      <div className="quiz-share-options">
                        {options.map((option) => (
                          <div key={`${question.id || questionIndex}-${option.key}`} className="quiz-share-option">
                            <span className="quiz-share-option-key">{option.key}</span>
                            <div className="quiz-share-option-text">
                              {renderMathText(
                                option.value || "-",
                                "quiz-share-body",
                                `option-${quiz.id}-${questionIndex}-${option.key}`
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="quiz-share-answer">
                        <label>Correct Answer</label>
                        <strong>{normalizePreviewText(question?.answer || "-")}</strong>
                      </div>

                      {question?.explanation && (
                        <div className="quiz-share-explanation">
                          <label>Answer Explanation</label>
                          <div>
                            {renderMathText(
                              question.explanation,
                              "quiz-share-body",
                              `explanation-${quiz.id}-${questionIndex}`
                            )}
                          </div>
                        </div>
                      )}

                      {exampleSteps.length > 0 && (
                        <div className="quiz-share-example">
                          <label>Worked Example</label>
                          <div className="quiz-share-example-rows">
                            {exampleSteps.map((step, stepIndex) => (
                              <div key={`${question.id || questionIndex}-${stepIndex}`} className="quiz-share-example-row">
                                <span>{step.label}</span>
                                <div>
                                  {renderMathText(
                                    step.content,
                                    "quiz-share-body",
                                    `example-${quiz.id}-${questionIndex}-${stepIndex}`
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
};

export default QuizDemoSharePage;
