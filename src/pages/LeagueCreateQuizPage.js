import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import Navbar from "../components/Navbar";
import { db, storage } from "../firebase/firebaseConfig";
import "./LeaguePage.css";

const QUESTION_TYPES = [
  { value: "single", label: "One Option Correct" },
  { value: "multiple", label: "Multiple Options Correct" },
  { value: "numerical", label: "Numerical" },
  { value: "sorting", label: "Sorting" },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const emptyQuestionDraft = () => ({
  id: uid(),
  type: "single",
  prompt: "",
  difficulty: "Medium",
  explanation: "",
  questionImageFile: null,
  questionImagePreview: "",
  questionImageUrl: "",
  options: ["", "", "", ""],
  optionImageFiles: [null, null, null, null],
  optionImagePreviews: ["", "", "", ""],
  optionImageUrls: ["", "", "", ""],
  singleCorrectIndex: 0,
  multiCorrectIndexes: [],
  numericalAnswer: "",
  tolerance: "0",
  sortingItems: ["", "", "", ""],
  sortingCorrectOrder: [0, 1, 2, 3],
});

const LeagueCreateQuizPage = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState("");
  const [quizName, setQuizName] = useState("");
  const [quizDescription, setQuizDescription] = useState("");
  const [questionDraft, setQuestionDraft] = useState(emptyQuestionDraft());
  const [questions, setQuestions] = useState([]);

  const isEditMode = useMemo(() => Boolean(quizId), [quizId]);

  const mapStoredQuestionToEditor = (question) => {
    const options = Array.isArray(question.options) ? question.options : ["", "", "", ""];
    const paddedOptions = [...options, "", "", ""].slice(0, 4);
    const optionImageUrls = Array.isArray(question.optionImageUrls)
      ? [...question.optionImageUrls, "", "", ""].slice(0, 4)
      : ["", "", "", ""];
    return {
      id: question.id || uid(),
      type: question.type || "single",
      prompt: question.prompt || "",
      difficulty: question.difficulty || "Medium",
      explanation: question.explanation || "",
      questionImageFile: null,
      questionImagePreview: question.questionImageUrl || "",
      questionImageUrl: question.questionImageUrl || "",
      options: paddedOptions,
      optionImageFiles: [null, null, null, null],
      optionImagePreviews: optionImageUrls,
      optionImageUrls,
      singleCorrectIndex: Number.isInteger(question.correctIndex) ? question.correctIndex : 0,
      multiCorrectIndexes: Array.isArray(question.correctIndexes) ? question.correctIndexes : [],
      numericalAnswer: question.answer !== undefined ? String(question.answer) : "",
      tolerance: question.tolerance !== undefined ? String(question.tolerance) : "0",
      sortingItems: Array.isArray(question.items) ? [...question.items, "", "", ""].slice(0, 4) : ["", "", "", ""],
      sortingCorrectOrder: Array.isArray(question.correctOrder)
        ? question.correctOrder
        : [0, 1, 2, 3],
    };
  };

  useEffect(() => {
    if (!quizId) return;
    let mounted = true;

    const loadQuiz = async () => {
      setIsLoadingQuiz(true);
      try {
        const snap = await getDoc(doc(db, "leagueBuilderQuizzes", quizId));
        if (!snap.exists()) {
          alert("Quiz not found.");
          navigate("/league");
          return;
        }
        if (!mounted) return;
        const data = snap.data();
        setQuizName(data.name || "");
        setQuizDescription(data.description || "");
        setQuestions(
          Array.isArray(data.questions) ? data.questions.map(mapStoredQuestionToEditor) : []
        );
      } catch (error) {
        console.error("Failed to load quiz:", error);
        alert("Failed to load quiz.");
      } finally {
        if (mounted) setIsLoadingQuiz(false);
      }
    };

    loadQuiz();
    return () => {
      mounted = false;
    };
  }, [quizId, navigate]);

  const updateOption = (index, value) => {
    setQuestionDraft((prev) => {
      const next = [...prev.options];
      next[index] = value;
      return { ...prev, options: next };
    });
  };

  const startEditQuestion = (question) => {
    setQuestionDraft({
      ...emptyQuestionDraft(),
      ...question,
      options: [...(question.options || ["", "", "", ""]), "", "", ""].slice(0, 4),
      optionImageFiles: [null, null, null, null],
      optionImagePreviews: [...(question.optionImageUrls || ["", "", "", ""]), "", "", ""].slice(0, 4),
      optionImageUrls: [...(question.optionImageUrls || ["", "", "", ""]), "", "", ""].slice(0, 4),
      questionImageFile: null,
      questionImagePreview: question.questionImageUrl || "",
      questionImageUrl: question.questionImageUrl || "",
    });
    setEditingQuestionId(question.id);
  };

  const cancelEditQuestion = () => {
    setEditingQuestionId("");
    setQuestionDraft(emptyQuestionDraft());
  };

  const updateQuestionImage = (file) => {
    setQuestionDraft((prev) => ({
      ...prev,
      questionImageFile: file || null,
      questionImagePreview: file ? URL.createObjectURL(file) : "",
      questionImageUrl: file ? "" : prev.questionImageUrl,
    }));
  };

  const clearQuestionImage = () => {
    setQuestionDraft((prev) => ({
      ...prev,
      questionImageFile: null,
      questionImagePreview: "",
      questionImageUrl: "",
    }));
  };

  const updateOptionImage = (index, file) => {
    setQuestionDraft((prev) => {
      const nextFiles = [...prev.optionImageFiles];
      const nextPreviews = [...prev.optionImagePreviews];
      nextFiles[index] = file || null;
      nextPreviews[index] = file ? URL.createObjectURL(file) : "";
      return {
        ...prev,
        optionImageFiles: nextFiles,
        optionImagePreviews: nextPreviews,
        optionImageUrls: nextFiles.map((currentFile, idx) =>
          currentFile ? "" : prev.optionImageUrls[idx]
        ),
      };
    });
  };

  const clearOptionImage = (index) => {
    setQuestionDraft((prev) => {
      const nextFiles = [...prev.optionImageFiles];
      const nextPreviews = [...prev.optionImagePreviews];
      const nextUrls = [...prev.optionImageUrls];
      nextFiles[index] = null;
      nextPreviews[index] = "";
      nextUrls[index] = "";
      return {
        ...prev,
        optionImageFiles: nextFiles,
        optionImagePreviews: nextPreviews,
        optionImageUrls: nextUrls,
      };
    });
  };

  const updateSortingItem = (index, value) => {
    setQuestionDraft((prev) => {
      const next = [...prev.sortingItems];
      next[index] = value;
      return { ...prev, sortingItems: next };
    });
  };

  const moveSortingPosition = (position, direction) => {
    setQuestionDraft((prev) => {
      const order = [...prev.sortingCorrectOrder];
      const swapWith = direction === "up" ? position - 1 : position + 1;
      if (swapWith < 0 || swapWith >= order.length) return prev;
      const current = order[position];
      order[position] = order[swapWith];
      order[swapWith] = current;
      return { ...prev, sortingCorrectOrder: order };
    });
  };

  const toggleMultipleCorrect = (optionIndex) => {
    setQuestionDraft((prev) => {
      const exists = prev.multiCorrectIndexes.includes(optionIndex);
      const next = exists
        ? prev.multiCorrectIndexes.filter((index) => index !== optionIndex)
        : [...prev.multiCorrectIndexes, optionIndex].sort((a, b) => a - b);
      return { ...prev, multiCorrectIndexes: next };
    });
  };

  const validateQuestion = () => {
    if (!questionDraft.prompt.trim()) return "Question prompt is required.";

    if (questionDraft.type === "single") {
      if (questionDraft.options.some((option) => !option.trim())) {
        return "Fill all options for one-option-correct questions.";
      }
      return null;
    }

    if (questionDraft.type === "multiple") {
      if (questionDraft.options.some((option) => !option.trim())) {
        return "Fill all options for multi-option-correct questions.";
      }
      if (questionDraft.multiCorrectIndexes.length === 0) {
        return "Mark at least one correct option.";
      }
      return null;
    }

    if (questionDraft.type === "numerical") {
      if (questionDraft.numericalAnswer === "") return "Numerical answer is required.";
      if (Number.isNaN(Number(questionDraft.numericalAnswer))) return "Numerical answer must be valid.";
      if (Number.isNaN(Number(questionDraft.tolerance))) return "Tolerance must be valid.";
      return null;
    }

    if (questionDraft.type === "sorting") {
      if (questionDraft.sortingItems.some((item) => !item.trim())) return "Fill all sorting items.";
      return null;
    }

    return "Unsupported question type.";
  };

  const addQuestion = (event) => {
    event.preventDefault();
    const validationError = validateQuestion();
    if (validationError) {
      alert(validationError);
      return;
    }

    const baseQuestion = {
      id: editingQuestionId || uid(),
      type: questionDraft.type,
      prompt: questionDraft.prompt.trim(),
      difficulty: questionDraft.difficulty,
      explanation: questionDraft.explanation.trim(),
      questionImageFile: questionDraft.questionImageFile,
      questionImagePreview: questionDraft.questionImagePreview,
      optionImageFiles: [...questionDraft.optionImageFiles],
      optionImagePreviews: [...questionDraft.optionImagePreviews],
      optionImageUrls: [...questionDraft.optionImageUrls],
    };

    let payload = {};
    if (questionDraft.type === "single") {
      payload = {
        options: questionDraft.options.map((option) => option.trim()),
        correctIndex: questionDraft.singleCorrectIndex,
      };
    } else if (questionDraft.type === "multiple") {
      payload = {
        options: questionDraft.options.map((option) => option.trim()),
        correctIndexes: [...questionDraft.multiCorrectIndexes],
      };
    } else if (questionDraft.type === "numerical") {
      payload = {
        answer: Number(questionDraft.numericalAnswer),
        tolerance: Number(questionDraft.tolerance),
      };
    } else if (questionDraft.type === "sorting") {
      payload = {
        items: questionDraft.sortingItems.map((item) => item.trim()),
        correctOrder: [...questionDraft.sortingCorrectOrder],
      };
    }

    const nextQuestion = { ...baseQuestion, ...payload };
    if (editingQuestionId) {
      setQuestions((prev) =>
        prev.map((question) => (question.id === editingQuestionId ? nextQuestion : question))
      );
    } else {
      setQuestions((prev) => [nextQuestion, ...prev]);
    }
    cancelEditQuestion();
  };

  const removeQuestion = (questionId) => {
    setQuestions((prev) => prev.filter((question) => question.id !== questionId));
    if (editingQuestionId === questionId) cancelEditQuestion();
  };

  const saveQuiz = async () => {
    if (!quizName.trim()) {
      alert("Quiz name is required.");
      return;
    }
    if (questions.length === 0) {
      alert("Add at least one question before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const quizStorageKey = uid();

      const uploadImageIfNeeded = async (file, path) => {
        if (!file) return "";
        const fileRef = ref(storage, path);
        await uploadBytes(fileRef, file);
        return getDownloadURL(fileRef);
      };

      const serializedQuestions = await Promise.all(
        questions.map(async (question, questionIndex) => {
          const {
            questionImageFile,
            questionImagePreview,
            optionImageFiles = [],
            ...rest
          } = question;

          const questionImageUrl = await uploadImageIfNeeded(
            questionImageFile,
            `leagueBuilderQuizzes/${quizStorageKey}/questions/${questionIndex}/question-image`
          );
          const resolvedQuestionImageUrl = questionImageUrl || rest.questionImageUrl || "";

          let optionImageUrls = [];
          if (rest.type === "single" || rest.type === "multiple") {
            optionImageUrls = await Promise.all(
              rest.options.map((_, optionIndex) =>
                uploadImageIfNeeded(
                  optionImageFiles[optionIndex],
                  `leagueBuilderQuizzes/${quizStorageKey}/questions/${questionIndex}/option-${optionIndex}`
                )
              )
            );
            optionImageUrls = optionImageUrls.map(
              (url, optionIndex) => url || rest.optionImageUrls?.[optionIndex] || ""
            );
          }

          return {
            ...rest,
            questionImageUrl: resolvedQuestionImageUrl,
            optionImageUrls,
          };
        })
      );

      if (isEditMode && quizId) {
        await updateDoc(doc(db, "leagueBuilderQuizzes", quizId), {
          name: quizName.trim(),
          description: quizDescription.trim(),
          questions: serializedQuestions,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "leagueBuilderQuizzes"), {
          name: quizName.trim(),
          description: quizDescription.trim(),
          questions: serializedQuestions,
          createdAt: serverTimestamp(),
        });
      }
      navigate("/league");
    } catch (error) {
      console.error("Failed to save quiz:", error);
      alert("Failed to save quiz.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="league-page">
      <Navbar />

      <main className="league-main">
        <section className="league-hero">
          <h1>{isEditMode ? "Edit Quiz" : "Create Quiz"}</h1>
          <p>
            {isEditMode
              ? "Update quiz details, question content, and images."
              : "Build a full quiz with many questions, then use it in one or more leagues."}
          </p>
        </section>

        <div className="league-grid league-grid-single">
          {isLoadingQuiz && (
            <section className="league-card">
              <p className="league-empty">Loading quiz...</p>
            </section>
          )}
          <section className="league-card">
            <div className="league-card-header">
              <h2>Quiz Info</h2>
              <span>{questions.length} questions added</span>
            </div>

            <div className="league-form">
              <label>
                Quiz Name
                <input
                  value={quizName}
                  onChange={(event) => setQuizName(event.target.value)}
                  placeholder="Example: Algebra Sprint - Round 1"
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={quizDescription}
                  onChange={(event) => setQuizDescription(event.target.value)}
                  placeholder="Optional quiz summary"
                />
              </label>
            </div>
          </section>

          <section className="league-card">
            <div className="league-card-header">
              <h2>Add Question</h2>
              <span>{questionDraft.type}</span>
            </div>
            <form className="league-form" onSubmit={addQuestion}>
              <div className="league-row">
                <label>
                  Type
                  <select
                    value={questionDraft.type}
                    onChange={(event) =>
                      setQuestionDraft((prev) => ({ ...prev, type: event.target.value }))
                    }
                  >
                    {QUESTION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Difficulty
                  <select
                    value={questionDraft.difficulty}
                    onChange={(event) =>
                      setQuestionDraft((prev) => ({ ...prev, difficulty: event.target.value }))
                    }
                  >
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Hard</option>
                  </select>
                </label>
              </div>

              <label>
                Prompt
                <textarea
                  rows={3}
                  value={questionDraft.prompt}
                  onChange={(event) =>
                    setQuestionDraft((prev) => ({ ...prev, prompt: event.target.value }))
                  }
                  placeholder="Type the question text"
                  required
                />
              </label>

              <div className="league-image-input">
                <label>
                  Question Image (optional)
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => updateQuestionImage(event.target.files?.[0] || null)}
                  />
                </label>
                {questionDraft.questionImagePreview && (
                  <>
                    <img
                      src={questionDraft.questionImagePreview}
                      alt="Question preview"
                      className="league-image-preview"
                    />
                    <button
                      type="button"
                      className="league-danger-link"
                      onClick={clearQuestionImage}
                    >
                      Remove Image
                    </button>
                  </>
                )}
              </div>

              {(questionDraft.type === "single" || questionDraft.type === "multiple") && (
                <div className="league-type-block">
                  <p className="league-block-title">Options</p>
                  {questionDraft.options.map((option, index) => (
                    <div key={index} className="league-option-row">
                      <input
                        value={option}
                        onChange={(event) => updateOption(index, event.target.value)}
                        placeholder={`Option ${index + 1}`}
                        required
                      />
                      {questionDraft.type === "single" ? (
                        <label className="league-check-label">
                          <input
                            type="radio"
                            name="single-correct"
                            checked={questionDraft.singleCorrectIndex === index}
                            onChange={() =>
                              setQuestionDraft((prev) => ({
                                ...prev,
                                singleCorrectIndex: index,
                              }))
                            }
                          />
                          Correct
                        </label>
                      ) : (
                        <label className="league-check-label">
                          <input
                            type="checkbox"
                            checked={questionDraft.multiCorrectIndexes.includes(index)}
                            onChange={() => toggleMultipleCorrect(index)}
                          />
                          Correct
                        </label>
                      )}
                      <div className="league-option-image-input">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) =>
                            updateOptionImage(index, event.target.files?.[0] || null)
                          }
                        />
                        {questionDraft.optionImagePreviews[index] && (
                          <>
                            <img
                              src={questionDraft.optionImagePreviews[index]}
                              alt={`Option ${index + 1} preview`}
                              className="league-image-preview small"
                            />
                            <button
                              type="button"
                              className="league-danger-link"
                              onClick={() => clearOptionImage(index)}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {questionDraft.type === "numerical" && (
                <div className="league-type-block">
                  <p className="league-block-title">Numerical Answer</p>
                  <div className="league-row">
                    <label>
                      Correct value
                      <input
                        type="number"
                        step="any"
                        value={questionDraft.numericalAnswer}
                        onChange={(event) =>
                          setQuestionDraft((prev) => ({
                            ...prev,
                            numericalAnswer: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Tolerance
                      <input
                        type="number"
                        step="any"
                        value={questionDraft.tolerance}
                        onChange={(event) =>
                          setQuestionDraft((prev) => ({
                            ...prev,
                            tolerance: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              )}

              {questionDraft.type === "sorting" && (
                <div className="league-type-block">
                  <p className="league-block-title">Sorting Items</p>
                  {questionDraft.sortingItems.map((item, index) => (
                    <input
                      key={index}
                      value={item}
                      onChange={(event) => updateSortingItem(index, event.target.value)}
                      placeholder={`Item ${index + 1}`}
                      required
                    />
                  ))}
                  <p className="league-block-subtitle">Correct order</p>
                  <div className="league-sort-order">
                    {questionDraft.sortingCorrectOrder.map((itemIndex, position) => (
                      <div key={`${itemIndex}-${position}`} className="league-sort-chip">
                        <span>
                          {position + 1}. {questionDraft.sortingItems[itemIndex] || `Item ${itemIndex + 1}`}
                        </span>
                        <div className="league-sort-actions">
                          <button
                            type="button"
                            onClick={() => moveSortingPosition(position, "up")}
                            disabled={position === 0}
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSortingPosition(position, "down")}
                            disabled={position === questionDraft.sortingCorrectOrder.length - 1}
                          >
                            Down
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <label>
                Explanation (optional)
                <textarea
                  rows={2}
                  value={questionDraft.explanation}
                  onChange={(event) =>
                    setQuestionDraft((prev) => ({ ...prev, explanation: event.target.value }))
                  }
                  placeholder="Short explanation shown after answer"
                />
              </label>

              <button type="submit" className="league-primary-btn" disabled={isLoadingQuiz || isSaving}>
                {editingQuestionId ? "Update Question" : "Add Question"}
              </button>
              {editingQuestionId && (
                <button type="button" className="league-secondary-btn" onClick={cancelEditQuestion}>
                  Cancel Edit
                </button>
              )}
            </form>
          </section>

          <section className="league-card">
            <div className="league-card-header">
              <h2>Questions in This Quiz</h2>
              <span>{questions.length}</span>
            </div>
            {questions.length === 0 ? (
              <p className="league-empty">No questions added yet.</p>
            ) : (
              <div className="league-question-list">
                {questions.map((question) => (
                  <article key={question.id} className="league-question-item">
                    <header>
                      <div className="league-question-badges">
                        <span className="league-badge type">{question.type}</span>
                        <span className="league-badge difficulty">{question.difficulty}</span>
                      </div>
                      <button className="league-danger-link" onClick={() => removeQuestion(question.id)}>
                        Delete
                      </button>
                      <button
                        className="league-secondary-btn compact"
                        onClick={() => startEditQuestion(question)}
                      >
                        Edit
                      </button>
                    </header>
                    <p className="league-question-prompt">{question.prompt}</p>
                    {(question.questionImagePreview || question.questionImageUrl) && (
                      <img
                        src={question.questionImagePreview || question.questionImageUrl}
                        alt="Question preview"
                        className="league-image-preview"
                      />
                    )}
                    {(question.type === "single" || question.type === "multiple") &&
                      Array.isArray(question.optionImageUrls) &&
                      question.optionImageUrls.some(Boolean) && (
                        <div className="league-option-preview-strip">
                          {question.optionImageUrls.map((url, idx) =>
                            url ? (
                              <img
                                key={`${question.id}-preview-${idx}`}
                                src={url}
                                alt={`Option ${idx + 1}`}
                                className="league-image-preview small"
                              />
                            ) : null
                          )}
                        </div>
                      )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="league-card league-actions-row">
            <button className="league-secondary-btn" onClick={() => navigate("/league")}>
              Back to Workspace
            </button>
            <button className="league-primary-btn" onClick={saveQuiz} disabled={isSaving || isLoadingQuiz}>
              {isSaving ? "Saving..." : isEditMode ? "Update Quiz" : "Save Quiz"}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LeagueCreateQuizPage;
