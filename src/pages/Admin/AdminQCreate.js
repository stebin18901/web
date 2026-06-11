import React, { useState, useEffect, useMemo } from "react";
import { db } from "../../firebase/firebaseConfig";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/firebaseConfig";
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
  const [noteHtml, setNoteHtml] = useState("");
  const [quizzes, setQuizzes] = useState([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState([]);
  const [reviewQuizId, setReviewQuizId] = useState(null);
  const [filterClass, setFilterClass] = useState("All");
  const [filterSubject, setFilterSubject] = useState("All");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imageUploadStatus, setImageUploadStatus] = useState({});
  const [reviewDraft, setReviewDraft] = useState(null);
  const [isReviewDirty, setIsReviewDirty] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [reviewSaveMessage, setReviewSaveMessage] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});
  const [reviewNoteQuizId, setReviewNoteQuizId] = useState(null);
  const [pasteEditQuizId, setPasteEditQuizId] = useState(null);
  const [isSortMode, setIsSortMode] = useState(false);
  const [sortedQuizIds, setSortedQuizIds] = useState([]);

  const toMillis = (value) => {
    if (!value) return Number.MAX_SAFE_INTEGER;
    if (typeof value === "number") return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    }
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (typeof value?.seconds === "number") return value.seconds * 1000;
    return Number.MAX_SAFE_INTEGER;
  };

  // Helper: fetch and set quizzes from Firestore
  const fetchAndSetQuizzes = async () => {
    setIsLoading(true);
    setError("");
    try {
      const snapshot = await getDocs(collection(db, "quizzes"));
      // Keep Firestore document id authoritative; do not let payload `id` overwrite it.
      const result = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
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

    // Normalize \( ... \) and \[ ... \] into $...$ and $$...$$ first
    const normalizedText = text
      .replace(/\\\[((?:.|\n|\r)*?)\\\]/g, (_, expr) => `$$${expr}$$`)
      .replace(/\\\(((?:.|\n|\r)*?)\\\)/g, (_, expr) => `$${expr}$`);

    // Regex splits into plain text and tokens ($...$ or $$...$$)
    const tokenRegex = /(\$\$[\s\S]*?\$\$|\$[^$]*?\$)/g;
    const parts = normalizedText.split(tokenRegex);

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

  const mapHtmlAttributes = (attrs = []) => {
    const mapped = {};
    Array.from(attrs).forEach((attr) => {
      if (attr.name === "class") {
        mapped.className = attr.value;
        return;
      }
      if (attr.name === "style") {
        return;
      }
      mapped[attr.name] = attr.value;
    });
    return mapped;
  };

  const renderHtmlNodeWithLatex = (node, keyPrefix = "n") => {
    if (!node) return null;
    if (node.nodeType === Node.TEXT_NODE) {
      return renderWithLatex(node.textContent || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const tag = node.tagName?.toLowerCase?.() || "div";
    const voidTags = new Set([
      "area",
      "base",
      "br",
      "col",
      "embed",
      "hr",
      "img",
      "input",
      "link",
      "meta",
      "param",
      "source",
      "track",
      "wbr",
    ]);
    const children = Array.from(node.childNodes).map((child, idx) =>
      renderHtmlNodeWithLatex(child, `${keyPrefix}-${idx}`)
    );
    const props = { key: keyPrefix, ...mapHtmlAttributes(node.attributes) };
    if (voidTags.has(tag)) {
      return React.createElement(tag, props);
    }
    return React.createElement(tag, props, children);
  };

  const renderNoteHtmlWithLatex = (html) => {
    if (!html || typeof html !== "string") return null;
    try {
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, "text/html");
      return Array.from(parsed.body.childNodes).map((node, idx) =>
        renderHtmlNodeWithLatex(node, `root-${idx}`)
      );
    } catch (err) {
      return <div>{renderWithLatex(html)}</div>;
    }
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

  // Upload JSON from textarea / update existing quiz from paste section
  const handleUpload = async () => {
    setError("");
    try {
      const parsed = JSON.parse(jsonData);
      validateQuiz(parsed);
      parsed.noteHtml = noteHtml || "";
      setIsLoading(true);
      if (pasteEditQuizId) {
        await setDoc(doc(db, "quizzes", pasteEditQuizId), sanitizeForFirestore(parsed));
      } else {
        await addDoc(collection(db, "quizzes"), sanitizeForFirestore(parsed));
      }
      setJsonData("");
      setNoteHtml("");
      setPasteEditQuizId(null);
      await fetchAndSetQuizzes();
    } catch (err) {
      console.error("upload error", err);
      setError(`${pasteEditQuizId ? "Update" : "Upload"} failed: ${err?.message || err}`);
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

  const getQuizById = (id) => quizzes.find((q) => q.id === id);

  const loadQuizIntoPasteEditor = (quiz) => {
    if (!quiz?.id) return;
    setPasteEditQuizId(quiz.id);
    setJsonData(JSON.stringify(quiz, null, 2));
    setNoteHtml(quiz.noteHtml || "");
    setError("");
  };

  const cancelPasteEdit = () => {
    setPasteEditQuizId(null);
    setJsonData("");
    setNoteHtml("");
    setError("");
  };

  useEffect(() => {
    if (!reviewQuizId) {
      setReviewDraft(null);
      setIsReviewDirty(false);
      setNewSectionName("");
      setCollapsedSections({});
      return;
    }
    const current = getQuizById(reviewQuizId);
    if (current) {
      const cloned = JSON.parse(JSON.stringify(current));
      if (!cloned.metadata) cloned.metadata = {};
      if (!Array.isArray(cloned.metadata.sections)) {
        const inferred = Array.from(new Set((cloned.questions || []).map((q) => q.section).filter(Boolean)));
        cloned.metadata.sections = inferred;
      }
      setReviewDraft(cloned);
      setIsReviewDirty(false);
      setNewSectionName("");
      setCollapsedSections({});
    }
  }, [reviewQuizId, quizzes]);

  const getOptionImageUrl = (question, optionKey, optionIndex) => {
    if (question?.optionImages && !Array.isArray(question.optionImages)) {
      return question.optionImages[optionKey] || null;
    }
    if (Array.isArray(question?.optionImages)) {
      return question.optionImages[optionIndex] || null;
    }
    return null;
  };

  const sanitizeForFirestore = (value) => {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeForFirestore(item));
    }
    if (value && typeof value === "object") {
      const cleaned = {};
      Object.entries(value).forEach(([k, v]) => {
        if (v !== undefined) cleaned[k] = sanitizeForFirestore(v);
      });
      return cleaned;
    }
    return value;
  };

  const handleReviewImageUpload = async (event, quizId, qIndex, optionKey = null, optionIndex = null) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const statusKey = optionKey ? `${qIndex}-${optionKey}` : `${qIndex}-question`;
    setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Uploading..." }));
    setError("");

    try {
      const uploadPath = optionKey
        ? `quizzes/${quizId}/questions/${qIndex + 1}/options/${optionKey}-${Date.now()}-${file.name}`
        : `quizzes/${quizId}/questions/${qIndex + 1}/question-${Date.now()}-${file.name}`;
      const fileRef = ref(storage, uploadPath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const quiz = reviewDraft?.id === quizId ? reviewDraft : getQuizById(quizId);
      if (!quiz) throw new Error("Quiz not found");

      const updatedQuiz = JSON.parse(JSON.stringify(quiz));
      const question = updatedQuiz.questions?.[qIndex];
      if (!question) throw new Error("Question not found");

      if (optionKey) {
        if (!question.optionImages || Array.isArray(question.optionImages)) {
          const mapped = {};
          if (Array.isArray(question.optionImages)) {
            Object.keys(question.options || {}).forEach((key, idx) => {
              mapped[key] = question.optionImages[idx] || null;
            });
          }
          question.optionImages = mapped;
        }
        question.optionImages[optionKey] = url;
      } else {
        question.questionImage = url;
      }

      // Persist only the questions array to avoid full-document overwrite issues
      const cleanedQuestions = sanitizeForFirestore(updatedQuiz.questions || []);
      await updateDoc(doc(db, "quizzes", quizId), { questions: cleanedQuestions });

      setReviewDraft(updatedQuiz);
      setIsReviewDirty(false);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Uploaded" }));
    } catch (err) {
      console.error("review image upload error", err);
      setError(`Image upload failed: ${err?.message || err}`);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Failed" }));
    } finally {
      event.target.value = "";
      setTimeout(() => {
        setImageUploadStatus((prev) => {
          const next = { ...prev };
          delete next[statusKey];
          return next;
        });
      }, 2500);
    }
  };

  const handleExplanationImageUpload = async (event, quizId, qIndex) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const statusKey = `${qIndex}-explanation`;
    setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Uploading..." }));
    setError("");
    try {
      const uploadPath = `quizzes/${quizId}/questions/${qIndex + 1}/explanation-${Date.now()}-${file.name}`;
      const fileRef = ref(storage, uploadPath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      const quiz = reviewDraft?.id === quizId ? reviewDraft : getQuizById(quizId);
      if (!quiz) throw new Error("Quiz not found");

      const updatedQuiz = JSON.parse(JSON.stringify(quiz));
      const question = updatedQuiz.questions?.[qIndex];
      if (!question) throw new Error("Question not found");

      question.explanationImage = url;
      const cleanedQuestions = sanitizeForFirestore(updatedQuiz.questions || []);
      await updateDoc(doc(db, "quizzes", quizId), { questions: cleanedQuestions });
      setReviewDraft(updatedQuiz);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Uploaded" }));
    } catch (err) {
      console.error("explanation image upload error", err);
      setError(`Explanation image upload failed: ${err?.code || "unknown"} - ${err?.message || err}`);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Failed" }));
    } finally {
      event.target.value = "";
      setTimeout(() => {
        setImageUploadStatus((prev) => {
          const next = { ...prev };
          delete next[statusKey];
          return next;
        });
      }, 2500);
    }
  };

  const handleReviewImageDelete = async (quizId, qIndex, optionKey = null) => {
    setError("");
    const statusKey = optionKey ? `${qIndex}-${optionKey}` : `${qIndex}-question`;
    setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Removing..." }));
    try {
      const quiz = reviewDraft?.id === quizId ? reviewDraft : getQuizById(quizId);
      if (!quiz) throw new Error("Quiz not found");

      const updatedQuiz = JSON.parse(JSON.stringify(quiz));
      const question = updatedQuiz.questions?.[qIndex];
      if (!question) throw new Error("Question not found");

      if (optionKey === "__explanation__") {
        delete question.explanationImage;
      } else if (optionKey) {
        if (question.optionImages && !Array.isArray(question.optionImages)) {
          delete question.optionImages[optionKey];
        } else if (Array.isArray(question.optionImages)) {
          const optionKeys = Object.keys(question.options || {});
          const optionIdx = optionKeys.findIndex((k) => k === optionKey);
          if (optionIdx >= 0) question.optionImages[optionIdx] = null;
        }
      } else {
        delete question.questionImage;
      }

      const cleanedQuestions = sanitizeForFirestore(updatedQuiz.questions || []);
      await updateDoc(doc(db, "quizzes", quizId), { questions: cleanedQuestions });

      setReviewDraft(updatedQuiz);
      setIsReviewDirty(false);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Removed" }));
    } catch (err) {
      console.error("review image delete error", err);
      setError(`Image delete failed: ${err?.code || "unknown"} - ${err?.message || err}`);
      setImageUploadStatus((prev) => ({ ...prev, [statusKey]: "Failed" }));
    } finally {
      setTimeout(() => {
        setImageUploadStatus((prev) => {
          const next = { ...prev };
          delete next[statusKey];
          return next;
        });
      }, 2500);
    }
  };

  const updateReviewQuestionField = (qIndex, field, value) => {
    setReviewDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.questions?.[qIndex]) return prev;
      next.questions[qIndex][field] = value;
      return next;
    });
    setIsReviewDirty(true);
    setReviewSaveMessage("");
  };

  const updateReviewOptionValue = (qIndex, optionKey, value) => {
    setReviewDraft((prev) => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.questions?.[qIndex]?.options) return prev;
      next.questions[qIndex].options[optionKey] = value;
      return next;
    });
    setIsReviewDirty(true);
    setReviewSaveMessage("");
  };

  const addSection = () => {
    const name = newSectionName.trim();
    if (!name || !reviewDraft) return;
    setReviewDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.metadata) next.metadata = {};
      if (!Array.isArray(next.metadata.sections)) next.metadata.sections = [];
      if (!next.metadata.sections.includes(name)) next.metadata.sections.push(name);
      return next;
    });
    setIsReviewDirty(true);
    setReviewSaveMessage("");
    setNewSectionName("");
  };

  const addQuestionToSection = (sectionName = "General") => {
    if (!reviewDraft) return;
    const blankQuestion = {
      section: sectionName,
      question: "",
      type: "MCQ",
      difficulty: "Medium",
      options: { A: "", B: "", C: "", D: "" },
      answer: "A",
      explanation: "",
    };
    setReviewDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!Array.isArray(next.questions)) next.questions = [];
      next.questions.push(blankQuestion);
      if (!next.metadata) next.metadata = {};
      if (!Array.isArray(next.metadata.sections)) next.metadata.sections = [];
      if (sectionName && sectionName !== "General" && !next.metadata.sections.includes(sectionName)) {
        next.metadata.sections.push(sectionName);
      }
      return next;
    });
    setIsReviewDirty(true);
    setReviewSaveMessage("");
  };

  const toggleSection = (sectionName) => {
    setCollapsedSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const setAllSectionsCollapsed = (collapsed) => {
    const next = {};
    groupedReviewQuestions.forEach(([sectionName]) => {
      next[sectionName] = collapsed;
    });
    setCollapsedSections(next);
  };

  const renameSection = (oldName) => {
    if (!reviewDraft || oldName === "General") return;
    const nextNameRaw = window.prompt("Enter new section name", oldName);
    if (nextNameRaw === null) return;
    const nextName = nextNameRaw.trim();
    if (!nextName || nextName === oldName) return;

    setReviewDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.metadata) next.metadata = {};
      if (!Array.isArray(next.metadata.sections)) next.metadata.sections = [];
      next.metadata.sections = next.metadata.sections.map((s) => (s === oldName ? nextName : s));
      next.questions = (next.questions || []).map((q) =>
        q.section === oldName ? { ...q, section: nextName } : q
      );
      return next;
    });

    setCollapsedSections((prev) => {
      const next = { ...prev };
      if (Object.prototype.hasOwnProperty.call(next, oldName)) {
        next[nextName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });

    setIsReviewDirty(true);
    setReviewSaveMessage("");
  };

  const updateQuestionSection = (qIndex, sectionName) => {
    updateReviewQuestionField(qIndex, "section", sectionName);
    setReviewDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      if (!next.metadata) next.metadata = {};
      if (!Array.isArray(next.metadata.sections)) next.metadata.sections = [];
      if (sectionName && sectionName !== "General" && !next.metadata.sections.includes(sectionName)) {
        next.metadata.sections.push(sectionName);
      }
      return next;
    });
  };

  const removeQuestionAtIndex = (qIndex) => {
    if (!reviewDraft?.questions?.length) return;
    const ok = window.confirm("Delete this question from the chapter?");
    if (!ok) return;

    setReviewDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.questions = (next.questions || []).filter((_, idx) => idx !== qIndex);
      return next;
    });
    setIsReviewDirty(true);
    setReviewSaveMessage("");
  };

  const saveReviewQuiz = async () => {
    if (!reviewQuizId || !reviewDraft) return;
    setError("");
    setReviewSaveMessage("");
    setIsSavingReview(true);
    try {
      const payload = sanitizeForFirestore(reviewDraft);
      await updateDoc(doc(db, "quizzes", reviewQuizId), {
        metadata: payload.metadata || {},
        questions: payload.questions || [],
      });
      await fetchAndSetQuizzes();
      setIsReviewDirty(false);
      setReviewSaveMessage("Saved successfully");
    } catch (err) {
      console.error("save review quiz error", err);
      setError(`Save failed: ${err?.code || "unknown"} - ${err?.message || err}`);
    } finally {
      setIsSavingReview(false);
    }
  };

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

  const groupedReviewQuestions = useMemo(() => {
    if (!reviewDraft?.questions) return [];
    const sections = Array.isArray(reviewDraft.metadata?.sections) ? reviewDraft.metadata.sections : [];
    const order = ["General", ...sections];
    const map = {};
    order.forEach((s) => {
      map[s] = [];
    });
    reviewDraft.questions.forEach((q, idx) => {
      const sectionName = q.section || "General";
      if (!map[sectionName]) map[sectionName] = [];
      map[sectionName].push({ q, idx });
    });
    return Object.entries(map).filter(([, items]) => items.length > 0 || order.includes("General"));
  }, [reviewDraft]);

  const sortDocId = useMemo(() => {
    if (filterClass === "All" || filterSubject === "All") return "";
    return `${String(filterClass)}__${String(filterSubject).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  }, [filterClass, filterSubject]);

  const loadSortOrder = async () => {
    if (!sortDocId) {
      setSortedQuizIds([]);
      return;
    }
    try {
      const snap = await getDoc(doc(db, "quizSortOrders", sortDocId));
      const data = snap.exists() ? snap.data() : {};
      setSortedQuizIds(Array.isArray(data.quizOrder) ? data.quizOrder : []);
    } catch (err) {
      console.error("load sort order error", err);
      setSortedQuizIds([]);
    }
  };

  useEffect(() => {
    loadSortOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortDocId, filteredQuizzes.length]);

  const saveSortOrder = async () => {
    if (!sortDocId) return;
    try {
      await setDoc(
        doc(db, "quizSortOrders", sortDocId),
        {
          className: String(filterClass),
          subject: String(filterSubject),
          quizOrder: sortedQuizIds,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setIsSortMode(false);
      alert("Sort order saved.");
    } catch (err) {
      console.error("save sort order error", err);
      setError(`Sort save failed: ${err?.message || err}`);
    }
  };

  const sortedFilteredQuizzes = useMemo(() => {
    if (!sortedQuizIds.length) {
      return filteredQuizzes.slice().sort((a, b) => {
        const aMs = toMillis(a.createdAt || a.uploadedAt || a.timestamp);
        const bMs = toMillis(b.createdAt || b.uploadedAt || b.timestamp);
        return aMs - bMs || String(a.metadata?.chapter || "").localeCompare(String(b.metadata?.chapter || ""));
      });
    }
    const idxMap = {};
    sortedQuizIds.forEach((id, i) => { idxMap[id] = i; });
    return filteredQuizzes.slice().sort((a, b) => {
      const ai = idxMap[a.id] ?? Number.MAX_SAFE_INTEGER;
      const bi = idxMap[b.id] ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }, [filteredQuizzes, sortedQuizIds]);

  const toggleQuizSortSelection = (quizId) => {
    setSortedQuizIds((prev) => {
      if (prev.includes(quizId)) {
        return prev.filter((id) => id !== quizId);
      }
      return [...prev, quizId];
    });
  };

  const setQuizSortPosition = (quizId, rawValue) => {
    const value = String(rawValue || "").trim();
    setSortedQuizIds((prev) => {
      const withoutCurrent = prev.filter((id) => id !== quizId);
      if (!value) return withoutCurrent;

      const targetPos = Number(value);
      if (!Number.isFinite(targetPos) || targetPos < 1) return withoutCurrent;
      const insertAt = Math.min(withoutCurrent.length, targetPos - 1);
      const next = withoutCurrent.slice();
      next.splice(insertAt, 0, quizId);
      return next;
    });
  };

  return (
    <div className="admin-container">
      <h2>Quiz Management</h2>
      <div className="shortform-guide">Short forms: E = Edit, R = Review, D = Delete, RN = Review Note, EN = Edit Note</div>

      {/* Upload Section */}
      <div className="section">
        <h3>{pasteEditQuizId ? "Edit Quiz In Paste Section" : "Upload New Quiz"}</h3>
        <div className="upload-grid">
          <textarea
            value={jsonData}
            onChange={(e) => setJsonData(e.target.value)}
            placeholder={`Paste your quiz JSON here`}
            rows={15}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
          <textarea
            value={noteHtml}
            onChange={(e) => setNoteHtml(e.target.value)}
            placeholder={`Paste note HTML here`}
            rows={15}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={handleUpload} disabled={!jsonData || isLoading}>
            {isLoading ? (pasteEditQuizId ? "Updating..." : "Uploading...") : (pasteEditQuizId ? "Update Quiz" : "Upload Quiz")}
          </button>
          {pasteEditQuizId && (
            <button type="button" onClick={cancelPasteEdit} style={{ marginLeft: 8, background: "#777" }}>
              Cancel Edit
            </button>
          )}
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
          <button
            type="button"
            onClick={() => setIsSortMode((v) => !v)}
            disabled={filterClass === "All" || filterSubject === "All"}
          >
            {isSortMode ? "Cancel Sort" : "Sort"}
          </button>
          {isSortMode && (
            <button type="button" onClick={saveSortOrder}>Save Sort</button>
          )}
        </div>
        {isSortMode && <p className="warning">Sort mode is active: click quiz cards in desired order.</p>}
      </div>

      {/* Quiz List */}
      <div className="section">
        <h3>Existing Quizzes ({filteredQuizzes.length})</h3>
        {isLoading && !filteredQuizzes.length ? (
          <p>Loading quizzes...</p>
        ) : (
          <div className="quiz-grid">
            {sortedFilteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="quiz-card"
                onClick={() => {
                  if (!isSortMode) return;
                  toggleQuizSortSelection(quiz.id);
                }}
                style={isSortMode ? { cursor: "pointer", border: sortedQuizIds.includes(quiz.id) ? "2px solid #4a6bdf" : "1px solid #ddd" } : {}}
              >
                <h4>
                  {quiz.metadata?.chapter}: {quiz.metadata?.concept}
                </h4>
                <p>
                  Class {quiz.metadata?.class} | {quiz.metadata?.subject}
                </p>
                <p>{quiz.questions?.length || 0} questions</p>
                {isSortMode && (
                  <>
                    <p>Sort Position: {sortedQuizIds.indexOf(quiz.id) >= 0 ? sortedQuizIds.indexOf(quiz.id) + 1 : "-"}</p>
                    <input
                      type="number"
                      min="1"
                      placeholder="Set position"
                      value={sortedQuizIds.indexOf(quiz.id) >= 0 ? sortedQuizIds.indexOf(quiz.id) + 1 : ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setQuizSortPosition(quiz.id, e.target.value)}
                      style={{ width: "120px", marginBottom: "8px" }}
                    />
                  </>
                )}
                <div className="actions">
                  <button onClick={(e) => { e.stopPropagation(); loadQuizIntoPasteEditor(quiz); }}>E</button>
                  <button onClick={(e) => { e.stopPropagation(); setReviewQuizId(quiz.id); }}>R</button>
                  <button onClick={(e) => { e.stopPropagation(); setReviewNoteQuizId(quiz.id); }}>RN</button>
                  <button onClick={(e) => { e.stopPropagation(); loadQuizIntoPasteEditor(quiz); }}>EN</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(quiz.id); }} className="danger">
                    D
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal with LaTeX rendering (complete) */}
      {reviewQuizId && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setReviewQuizId(null)}>
          <div className="modal-content">
            <div className="modal-header">
              <h3>Quiz Review</h3>
              <button onClick={() => setReviewQuizId(null)} className="close-btn">
                &times;
              </button>
            </div>

            {reviewDraft ? (
              <div className="preview-container review-only">
                <div className="metadata-section">
                  <div className="metadata-grid">
                    <div className="metadata-item">
                      <span className="metadata-label">Program:</span>
                      <span className="metadata-value">{reviewDraft.metadata?.program || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Class:</span>
                      <span className="metadata-value">{reviewDraft.metadata?.class || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Subject:</span>
                      <span className="metadata-value">{reviewDraft.metadata?.subject || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Chapter:</span>
                      <span className="metadata-value">{reviewDraft.metadata?.chapter || "N/A"}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="metadata-label">Concept:</span>
                      <span className="metadata-value">{reviewDraft.metadata?.concept || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="questions-section">
                  <h4 className="questions-title">Questions ({reviewDraft.questions?.length || 0})</h4>
                  <div className="section-toolbar">
                    <div className="section-add-row">
                      <input
                        className="review-input section-name-input"
                        placeholder="New section name (e.g. Kinematics)"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                      />
                      <button type="button" title="Add section" className="icon-btn" onClick={addSection}>＋</button>
                    </div>
                    <div className="section-global-actions">
                      <button type="button" title="Expand all sections" className="icon-btn" onClick={() => setAllSectionsCollapsed(false)}>⤢</button>
                      <button type="button" title="Collapse all sections" className="icon-btn" onClick={() => setAllSectionsCollapsed(true)}>⤡</button>
                      <button type="button" title="Add question" className="icon-btn" onClick={() => addQuestionToSection("General")}>＋Q</button>
                    </div>
                  </div>

                  <div className="question-preview-list">
                    {groupedReviewQuestions.map(([sectionName, sectionItems]) => (
                      <div key={sectionName} className="section-block">
                        <div className="section-block-header">
                          <h5>
                            {sectionName}
                            <span className="section-count">{sectionItems.length} question{sectionItems.length === 1 ? "" : "s"}</span>
                          </h5>
                          <div className="section-actions">
                            {sectionName !== "General" && (
                              <button type="button" title="Rename section" className="icon-btn" onClick={() => renameSection(sectionName)}>✎</button>
                            )}
                            <button type="button" title="Add question to section" className="icon-btn" onClick={() => addQuestionToSection(sectionName)}>＋Q</button>
                            <button type="button" title={collapsedSections[sectionName] ? "Expand section" : "Collapse section"} className="icon-btn" onClick={() => toggleSection(sectionName)}>
                              {collapsedSections[sectionName] ? "▾" : "▴"}
                            </button>
                          </div>
                        </div>
                        {!collapsedSections[sectionName] && sectionItems.map(({ q, idx }) => (
                      <div key={`${sectionName}-${idx}`} className="question-card">
                        <div className="question-header">
                          <span className="question-number">Q{idx + 1}</span>
                          <span className="question-meta">
                            <span className={`difficulty-badge ${String(q.difficulty || "").toLowerCase()}`}>
                              {q.difficulty || "Medium"}
                            </span>
                            <span className="type-badge">{q.type || "MCQ"}</span>
                            <button
                              type="button"
                              className="inline-delete-btn"
                              title="Delete question"
                              onClick={() => removeQuestionAtIndex(idx)}
                            >
                              ✕
                            </button>
                          </span>
                        </div>

                        <label className="field-label">Section</label>
                        <select
                          className="review-input"
                          value={q.section || "General"}
                          onChange={(e) => updateQuestionSection(idx, e.target.value)}
                        >
                          <option value="General">General</option>
                          {(reviewDraft.metadata?.sections || []).map((section) => (
                            <option key={section} value={section}>{section}</option>
                          ))}
                        </select>

                        <label className="field-label">Question</label>
                        <textarea
                          className="review-input review-textarea"
                          rows={3}
                          value={q.question || ""}
                          onChange={(e) => updateReviewQuestionField(idx, "question", e.target.value)}
                        />
                        <div className="preview-box">{renderWithLatex(q.question)}</div>
                        <div className="image-upload-row">
                          {q.questionImage ? (
                            <img src={q.questionImage} alt={`Question ${idx + 1}`} className="question-image-preview" />
                          ) : (
                            <span className="muted-note">No question image</span>
                          )}
                          <label className="upload-label">
                            {q.questionImage ? "Replace Question Image" : "Upload Question Image"}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleReviewImageUpload(e, reviewQuizId, idx)}
                            />
                          </label>
                          {q.questionImage && (
                            <button
                              type="button"
                              className="mini-danger-btn"
                              title="Delete question image"
                              onClick={() => handleReviewImageDelete(reviewQuizId, idx)}
                            >
                              ✕
                            </button>
                          )}
                          {imageUploadStatus[`${idx}-question`] && (
                            <span className="upload-status">{imageUploadStatus[`${idx}-question`]}</span>
                          )}
                        </div>

                        {q.options && (
                          <div className="options-grid">
                            {Object.entries(q.options).map(([key, val], optionIndex) => (
                              <div
                                key={key}
                                className={`option-item ${q.answer === key ? "correct-answer" : ""}`}
                              >
                                <span className="option-key">{key}:</span>
                                <span className="option-value">
                                  <input
                                    className="review-input option-input"
                                    value={val || ""}
                                    onChange={(e) => updateReviewOptionValue(idx, key, e.target.value)}
                                  />
                                  <div className="preview-box option-preview">{renderWithLatex(val)}</div>
                                  {getOptionImageUrl(q, key, optionIndex) && (
                                    <img
                                      src={getOptionImageUrl(q, key, optionIndex)}
                                      alt={`Option ${key}`}
                                      className="option-image-preview"
                                    />
                                  )}
                                  <label className="upload-label option-upload-label">
                                  {getOptionImageUrl(q, key, optionIndex) ? "Replace Option Image" : "Upload Option Image"}
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) => handleReviewImageUpload(e, reviewQuizId, idx, key, optionIndex)}
                                    />
                                  </label>
                                  {getOptionImageUrl(q, key, optionIndex) && (
                                    <button
                                      type="button"
                                      className="mini-danger-btn option-delete-btn"
                                      title="Delete option image"
                                      onClick={() => handleReviewImageDelete(reviewQuizId, idx, key)}
                                    >
                                      ✕
                                    </button>
                                  )}
                                  {imageUploadStatus[`${idx}-${key}`] && (
                                    <span className="upload-status">{imageUploadStatus[`${idx}-${key}`]}</span>
                                  )}
                                </span>
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

                        <div className="explanation-section">
                          <span className="explanation-label">Explanation:</span>
                          <textarea
                            className="review-input review-textarea"
                            rows={4}
                            value={q.explanation || ""}
                            onChange={(e) => updateReviewQuestionField(idx, "explanation", e.target.value)}
                            placeholder="Add explanation"
                          />
                          <div className="preview-box">{renderWithLatex(q.explanation || "")}</div>
                          <div className="image-upload-row">
                            {q.explanationImage ? (
                              <img src={q.explanationImage} alt={`Explanation ${idx + 1}`} className="question-image-preview" />
                            ) : (
                              <span className="muted-note">No explanation image</span>
                            )}
                            <label className="upload-label">
                              {q.explanationImage ? "Replace Explanation Image" : "Upload Explanation Image"}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleExplanationImageUpload(e, reviewQuizId, idx)}
                              />
                            </label>
                            {q.explanationImage && (
                              <button
                                type="button"
                                className="mini-danger-btn"
                                title="Delete explanation image"
                                onClick={() => handleReviewImageDelete(reviewQuizId, idx, "__explanation__")}
                              >
                                ✕
                              </button>
                            )}
                            {imageUploadStatus[`${idx}-explanation`] && (
                              <span className="upload-status">{imageUploadStatus[`${idx}-explanation`]}</span>
                            )}
                          </div>
                        </div>
                      </div>
                        ))}
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

      {reviewNoteQuizId && (
        <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && setReviewNoteQuizId(null)}>
          <div className="modal-content">
            <h3>Review Note</h3>
            {getQuizById(reviewNoteQuizId)?.noteHtml ? (
              <div className="note-preview">{renderNoteHtmlWithLatex(getQuizById(reviewNoteQuizId)?.noteHtml)}</div>
            ) : (
              <p>No note found for this quiz.</p>
            )}
            <div className="modal-actions">
              <button onClick={() => setReviewNoteQuizId(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-container { padding: 20px; max-width: 1200px; margin: 0 auto; }
        .shortform-guide { margin-bottom: 12px; padding: 10px; border: 1px solid #d8e2ff; background: #f4f7ff; border-radius: 8px; font-size: 13px; }
        .upload-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
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
        .modal-content { background: white; border-radius: 14px; width: 92%; max-width: 1100px; max-height: 88vh; overflow: auto; padding: 22px; box-shadow: 0 20px 50px rgba(0,0,0,0.2); }
        .modal-actions { margin-top: 12px; display: flex; gap: 10px; }
        .note-preview { border: 1px solid #eee; border-radius: 8px; padding: 12px; max-height: 55vh; overflow: auto; background: #fff; }
        .error { color: #cc0000; margin: 10px 0; padding: 10px; background: #fff0f0; border-radius: 6px; }

        /* Preview Modal Specific */
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
        .close-btn { background: none; border: none; font-size: 26px; cursor: pointer; color: #666; }
        .preview-container { display: flex; flex-direction: column; gap: 20px; }
        .preview-container.review-only .section-toolbar,
        .preview-container.review-only .section-actions,
        .preview-container.review-only .upload-label,
        .preview-container.review-only .mini-danger-btn,
        .preview-container.review-only .inline-delete-btn,
        .preview-container.review-only .review-save-row {
          display: none !important;
        }
        .preview-container.review-only .review-input {
          pointer-events: none;
          background: #f7f8fb;
        }
        .metadata-section { background: #f8f9fa; padding: 12px; border-radius: 8px; border-left: 4px solid #4a6bdf; }
        .metadata-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .metadata-item { display: flex; flex-direction: column; }
        .metadata-label { font-size: 12px; color: #666; font-weight: 100; text-transform: uppercase; }
        .metadata-value { font-weight: 100; color: #222; margin-top: 4px; }

        .questions-section { margin-top: 6px; }
        .questions-title { color: #333; margin-bottom: 12px; }
        .section-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .section-add-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .section-global-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .section-name-input { min-width: 240px; }
        .section-block { background: #f6f9ff; border: 1px solid #d7e3ff; border-radius: 12px; padding: 12px; margin-bottom: 14px; }
        .section-block-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; gap: 12px; }
        .section-block-header h5 { margin: 0; color: #294a99; font-size: 15px; display: flex; align-items: center; gap: 8px; }
        .section-count { font-size: 12px; color: #5b74aa; font-weight: 600; background: #eaf1ff; border-radius: 999px; padding: 2px 8px; }
        .section-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .icon-btn { min-width: 34px; padding: 7px 10px; border-radius: 8px; font-weight: 700; }
        .question-card { background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%); border-radius: 12px; padding: 16px; margin-bottom: 16px; border: 1px solid #e7efff; box-shadow: 0 8px 18px rgba(74,107,223,0.08); }
        .question-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .question-number { font-weight: 100; color: #4a6bdf; }
        .question-meta { display: flex; gap: 8px; align-items: center; }
        .difficulty-badge { padding: 4px 8px; border-radius: 999px; font-size: 12px; font-weight: 100; }
        .difficulty-badge.easy { background: #e6f7ee; color: #28a745; }
        .difficulty-badge.medium { background: #fff8e6; color: #ffc107; }
        .difficulty-badge.hard { background: #ffecec; color: #dc3545; }
        .type-badge { background: #e6f3ff; color: #2b5cc4; padding: 4px 8px; border-radius: 999px; font-weight: 100; font-size: 12px; }
        .inline-delete-btn { background: #ffe6e6; color: #a02121; border: 1px solid #ffcdcd; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; min-width: 28px; }
        .field-label { display: block; font-size: 12px; font-weight: 700; color: #4a6bdf; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.4px; }
        .review-input { width: 100%; border: 1px solid #dbe7ff; border-radius: 8px; padding: 10px 12px; font-size: 14px; color: #1f2937; background: #fff; }
        .review-input:focus { outline: none; border-color: #4a6bdf; box-shadow: 0 0 0 3px rgba(74,107,223,0.15); }
        .review-textarea { resize: vertical; margin-bottom: 8px; font-family: inherit; }
        .preview-box { background: #f7faff; border: 1px dashed #c7d8ff; border-radius: 8px; padding: 10px; margin-bottom: 10px; color: #1e2a42; line-height: 1.55; }
        .option-preview { margin-top: 8px; }
        .options-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-bottom: 12px; }
        .option-item { padding: 12px; border-radius: 10px; background: #fafcff; border: 1px solid #dce9ff; display: flex; gap: 10px; align-items: flex-start; }
        .option-item.correct-answer { background: #e9f8ea; border-color: #cfead1; }
        .option-key { color: #4a6bdf; font-weight: 700; margin-right: 8px; }
        .option-value { display: block; width: 100%; }
        .option-input { margin-bottom: 6px; }
        .image-upload-row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 12px; }
        .question-image-preview { max-width: 220px; max-height: 140px; border-radius: 6px; border: 1px solid #e5e5e5; object-fit: cover; }
        .option-image-preview { display: block; margin-top: 8px; max-width: 170px; max-height: 110px; border-radius: 6px; border: 1px solid #e8e8e8; object-fit: cover; }
        .upload-label { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #2b5cc4; cursor: pointer; }
        .upload-label input { display: none; }
        .option-upload-label { margin-top: 8px; }
        .upload-status { font-size: 12px; color: #666; }
        .muted-note { font-size: 12px; color: #777; }
        .mini-danger-btn { border: none; background: #ff5555; color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 12px; cursor: pointer; }
        .option-delete-btn { margin-top: 8px; display: inline-block; }
        .review-save-row { position: sticky; bottom: 0; z-index: 2; display: flex; align-items: center; gap: 10px; margin-top: 8px; background: #fff; border-top: 1px solid #eee; padding-top: 12px; }
        .save-success { font-size: 12px; color: #14833b; }
        .answer-section { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
        .answer-label { font-weight: 100; color: #666; }
        .answer-value { font-weight: 100; color: #14833b; }
        .explanation-section { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #eee; }
        .explanation-label { display: block; font-size: 13px; color: #666; font-weight: 100; margin-bottom: 6px; }
        .explanation-text { color: #444; line-height: 1.6; }

        @media (max-width: 600px) {
          .modal-content { width: 95%; padding: 12px; }
          .metadata-grid { grid-template-columns: 1fr; }
          .upload-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
};

export default AdminQCreate;
