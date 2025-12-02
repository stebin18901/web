import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

/**
 * AdminQCreate.jsx
 * - Full admin component to upload, edit, delete and preview quizzes
 * - Supports LaTeX rendering (inline $...$ and block $$...$$) in preview modal
 *
 * Dependencies:
 *   npm install react-katex katex
 *
 * Notes:
 * - This file uses a small inline style block at the bottom. Move styles to a CSS file
 *   if you don't use `style jsx` in your project.
 */

const AdminQCreate = () => {
  const [jsonData, setJsonData] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [editJson, setEditJson] = useState("");
  const [reviewQuizId, setReviewQuizId] = useState(null);
  const [filterClass, setFilterClass] = useState("All");
  const [filterSubject, setFilterSubject] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper: fetch and set quizzes from Firestore
  const fetchAndSetQuizzes = async () => {
    setIsLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(collection(db, "quizzes"));
      const result = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setQuizzes(result);
      setFilteredQuizzes(result);
    } catch (err) {
      console.error("fetch quizzes error", err);
      setError("Failed to fetch quizzes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAndSetQuizzes();
  }, []);

  // Robust LaTeX renderer that handles $$...$$ (block) and $...$ (inline)
  const renderWithLatex = (text) => {
    if (text === null || text === undefined) return null;
    // If already a React node or non-string, return as-is
    if (typeof text !== "string") return text;

    // Regex splits into plain text and tokens ($...$ or $$...$$)
    const tokenRegex = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const math = part.slice(2, -2);
        return (
          <div key={i} style={{ margin: "10px 0" }}>
            <BlockMath math={math} />
          </div>
        );
      }
      if (part.startsWith("$") && part.endsWith("$")) {
        const math = part.slice(1, -1);
        return <InlineMath key={i} math={math} />;
      }
      // plain text
      return <span key={i}>{part}</span>;
    });
  };

  // Validate quiz object structure
  const validateQuiz = (quiz) => {
    if (!quiz.metadata || !quiz.questions) {
      throw new Error("Missing metadata or questions array");
    }
    const { class: quizClass, subject, chapter, concept } = quiz.metadata;
    if (!quizClass || !subject || !chapter || !concept) {
      throw new Error("Metadata incomplete (class, subject, chapter, concept required)");
    }
    if (!Array.isArray(quiz.questions)) {
      throw new Error("Questions must be an array");
    }
  };

  // Upload JSON from textarea
  const handleUpload = async () => {
    setError("");
    try {
      const parsed = JSON.parse(jsonData);
      validateQuiz(parsed);
      setIsLoading(true);
      await addDoc(collection(db, "quizzes"), parsed);
      setJsonData("");
      await fetchAndSetQuizzes();
    } catch (err) {
      console.error("upload error", err);
      setError(`Upload failed: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Delete quiz
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    setError("");
    try {
      setIsLoading(true);
      await deleteDoc(doc(db, "quizzes", id));
      await fetchAndSetQuizzes();
    } catch (err) {
      console.error("delete error", err);
      setError("Failed to delete quiz");
    } finally {
      setIsLoading(false);
    }
  };

  // Edit flow
  const startEditing = (quiz) => {
    setEditId(quiz.id);
    setEditJson(JSON.stringify(quiz, null, 2));
  };

  const saveEdit = async () => {
    setError("");
    try {
      const updated = JSON.parse(editJson);
      validateQuiz(updated);
      setIsLoading(true);
      // Use setDoc to replace the whole document reliably
      await setDoc(doc(db, "quizzes", editId), updated);
      setEditId(null);
      setEditJson("");
      await fetchAndSetQuizzes();
    } catch (err) {
      console.error("save edit error", err);
      setError(`Update failed: ${err?.message || err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getQuizById = (id) => quizzes.find((q) => q.id === id);

  // Filters
  const applyFilters = (quizList = quizzes) => {
    let result = quizList.slice();
    if (filterClass !== "All") {
      result = result.filter((q) => String(q.metadata?.class) === String(filterClass));
    }
    if (filterSubject !== "All") {
      result = result.filter((q) => q.metadata?.subject === filterSubject);
    }
    setFilteredQuizzes(result);
  };

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClass, filterSubject, quizzes]);

  const classOptions = useMemo(() => {
    const classes = quizzes.map((q) => q.metadata?.class).filter((c) => c !== undefined && c !== null);
    return ["All", ...Array.from(new Set(classes))];
  }, [quizzes]);

  const subjectOptions = useMemo(() => {
    const subs = quizzes.map((q) => q.metadata?.subject).filter(Boolean);
    return ["All", ...Array.from(new Set(subs))];
  }, [quizzes]);

  return (
    <div className="admin-container">
      <h2>Quiz Management</h2>

      {/* Upload Section */}
      <div className="section">
        <h3>Upload New Quiz</h3>
        <textarea
          value={jsonData}
          onChange={(e) => setJsonData(e.target.value)}
          placeholder={`Paste your quiz JSON here`}
          rows={15}
          style={{ width: "100%", fontFamily: "monospace" }}
        />
        <div style={{ marginTop: 10 }}>
          <button onClick={handleUpload} disabled={!jsonData || isLoading}>
            {isLoading ? "Uploading..." : "Upload Quiz"}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Filter Section */}
      <div className="section">
        <h3>Filter Quizzes</h3>
        <div className="filters">
          <select value={String(filterClass)} onChange={(e) => setFilterClass(e.target.value)}>
            {classOptions.map((cls, idx) => (
              <option key={idx} value={String(cls)}>
                {cls === "All" ? "All Classes" : `Class ${cls}`}
              </option>
            ))}
          </select>

          <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
            {subjectOptions.map((subj, idx) => (
              <option key={idx} value={subj}>
                {subj === "All" ? "All Subjects" : subj}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Quiz List */}
      <div className="section">
        <h3>Existing Quizzes ({filteredQuizzes.length})</h3>
        {isLoading && !filteredQuizzes.length ? (
          <p>Loading quizzes...</p>
        ) : (
          <div className="quiz-grid">
            {filteredQuizzes.map((quiz) => (
              <div key={quiz.id} className="quiz-card">
                <h4>
                  {quiz.metadata?.chapter}: {quiz.metadata?.concept}
                </h4>
                <p>
                  Class {quiz.metadata?.class} | {quiz.metadata?.subject}
                </p>
                <p>{quiz.questions?.length || 0} questions</p>
                <div className="actions">
                  <button onClick={() => startEditing(quiz)}>Edit</button>
                  <button onClick={() => setReviewQuizId(quiz.id)}>Review</button>
                  <button onClick={() => handleDelete(quiz.id)} className="danger">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editId && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setEditId(null)}>
          <div className="modal-content">
            <h3>Edit Quiz</h3>
            <textarea
              value={editJson}
              onChange={(e) => setEditJson(e.target.value)}
              rows={20}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
            <div className="modal-actions">
              <button onClick={saveEdit} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Changes"}
              </button>
              <button onClick={() => setEditId(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Review Modal with LaTeX rendering (complete) */}
      {reviewQuizId && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setReviewQuizId(null)}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Quiz Preview</h3>
              <button onClick={() => setReviewQuizId(null)} className="close-btn">
                &times;
              </button>
            </div>

            {getQuizById(reviewQuizId) ? (
              <div className="preview-container">
                <div className="metadata-section">
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <span className="metadata-label">Program:</span>
                      <span className="metadata-value">{getQuizById(reviewQuizId).metadata?.program || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Class:</span>
                      <span className="metadata-value">{getQuizById(reviewQuizId).metadata?.class || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Subject:</span>
                      <span className="metadata-value">{getQuizById(reviewQuizId).metadata?.subject || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Chapter:</span>
                      <span className="metadata-value">{getQuizById(reviewQuizId).metadata?.chapter || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Concept:</span>
                      <span className="metadata-value">{getQuizById(reviewQuizId).metadata?.concept || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="questions-section">
                  <h4 className="questions-title">Questions ({getQuizById(reviewQuizId).questions?.length || 0})</h4>

                  <div className="question-preview-list">
                    {getQuizById(reviewQuizId).questions?.map((q, idx) => (
                      <div key={idx} className="question-card">
                        <div className="question-header">
                          <span className="question-number">Q{idx + 1}</span>
                          <span className="question-meta">
                            <span className={`difficulty-badge ${String(q.difficulty || "").toLowerCase()}`}>
                              {q.difficulty || "Medium"}
                            </span>
                            <span className="type-badge">{q.type || "MCQ"}</span>
                          </span>
                        </div>

                        <div className="question-text">{renderWithLatex(q.question)}</div>

                        {q.options && (
                          <div className="options-grid">
                            {Object.entries(q.options).map(([key, val]) => (
                              <div
                                key={key}
                                className={`option-item ${q.answer === key ? "correct-answer" : ""}`}
                              >
                                <span className="option-key">{key}:</span>
                                <span className="option-value">{renderWithLatex(val)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.answer && (
                          <div className="answer-section">
                            <span className="answer-label">Correct Answer:</span>
                            <span className="answer-value">{q.answer}</span>
                          </div>
                        )}

                        {q.explanation && (
                          <div className="explanation-section">
                            <span className="explanation-label">Explanation:</span>
                            <div className="explanation-text">{renderWithLatex(q.explanation)}</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p>Loading preview...</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .section { margin-bottom: 30px; background: #f5f5f5; border-radius: 8px; padding: 20px; }
        .filters { display: flex; gap: 15px; align-items: center; }
        select { padding: 8px 12px; }
        .quiz-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; }
        .quiz-card { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.08); }
        .actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
        button { padding: 8px 14px; cursor: pointer; border: none; border-radius: 6px; background: #4a6bdf; color: white; transition: background .15s; }
        button:hover { filter: brightness(.95); }
        .danger { background: #ff5555; }
        .modal { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-content { background: white; border-radius: 8px; width: 90%; max-width: 1000px; max-height: 85vh; overflow: auto; padding: 20px; box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
        .modal-actions { margin-top: 12px; display: flex; gap: 10px; }
        .error { color: #cc0000; margin: 10px 0; padding: 10px; background: #fff0f0; border-radius: 6px; }

        /* Preview Modal Specific */
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .close-btn { background: none; border: none; font-size: 26px; cursor: pointer; color: #666; }
        .preview-container { display: flex; flex-direction: column; gap: 20px; }
        .metadata-section { background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 4px solid #4a6bdf; }
        .metadata-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .metadata-item { display: flex; flex-direction: column; }
        .metadata-label { font-size: 12px; color: #666; font-weight: 100; text-transform: uppercase; }
        .metadata-value { font-weight: 100; color: #222; margin-top: 4px; }

        .questions-section { margin-top: 6px; }
        .questions-title { color: #333; margin-bottom: 12px; }
        .question-card { background: #fff; border-radius: 8px; padding: 14px; margin-bottom: 14px; border-left: 4px solid #4a6bdf; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
        .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .question-number { font-weight: 100; color: #4a6bdf; }
        .question-meta { display: flex; gap: 8px; align-items: center; }
        .difficulty-badge { padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 100; }
        .difficulty-badge.easy { background: #e6f7ee; color: #28a745; }
        .difficulty-badge.medium { background: #fff8e6; color: #ffc107; }
        .difficulty-badge.hard { background: #ffecec; color: #dc3545; }
        .type-badge { background: #e6f3ff; color: #2b5cc4; padding: 4px 8px; border-radius: 999px; font-weight: 100; font-size: 12px; }
        .question-text { font-size: 15px; color: #222; margin-bottom: 10px; line-height: 1.6; }
        .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .option-item { padding: 10px; border-radius: 6px; background: #fafafa; border: 1px solid #eee; display: flex; gap: 10px; align-items: flex-start; }
        .option-item.correct-answer { background: #e9f8ea; border-color: #cfead1; }
        .option-key { color: #4a6bdf; font-weight: 100; margin-right: 8px; }
        .answer-section { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .answer-label { font-weight: 100; color: #666; }
        .answer-value { font-weight: 100; color: #14833b; }
        .explanation-section { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee; }
        .explanation-label { display: block; font-size: 13px; color: #666; font-weight: 100; margin-bottom: 6px; }
        .explanation-text { color: #444; line-height: 1.6; }

        @media (max-width: 600px) {
          .modal-content { width: 95%; padding: 12px; }
          .metadata-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AdminQCreate;
