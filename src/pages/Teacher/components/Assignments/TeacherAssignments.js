import React, { useState, useRef, useEffect } from "react";
import "./TeacherAssignments.css";
import { db } from "../../../../firebase/firebaseConfig";
import { addDoc, collection, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import {
  FilePlus2,
  Upload,
  CheckCircle,
  ListChecks,
  Calendar,
  BookOpen,
  FileText,
  Save,
  Send,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Trash2,
} from "lucide-react";
import ManageAssignments from "./ManageAssignments";
import ViewSubmissions from "./ViewSubmissions";

function parseRanges(input) {
  if (!input) return [];
  const cleaned = input.replace(/\s+/g, "");
  if (!cleaned) return [];
  const parts = cleaned.split(",").filter(Boolean);
  const indices = new Set();

  for (const p of parts) {
    if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (!isNaN(n) && n > 0) indices.add(n - 1);
      continue;
    }
    if (/^\d+-\d+$/.test(p)) {
      const [aStr, bStr] = p.split("-");
      const a = parseInt(aStr, 10);
      const b = parseInt(bStr, 10);
      if (isNaN(a) || isNaN(b)) continue;
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      for (let i = start; i <= end; i++) indices.add(i - 1);
    }
  }

  return Array.from(indices)
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
}

const QUESTION_TYPES = [
  { id: "mcq", label: "MCQ" },
  { id: "msq", label: "MSQ" },
  { id: "short", label: "Short Answer" },
  { id: "long", label: "Descriptive" },
  { id: "tf", label: "True / False" },
  { id: "numeric", label: "Numeric" },
  { id: "file", label: "File Upload" },
];

// -----------------------------
// Main
// -----------------------------
export default function TeacherAssignments({ teacher }) {
  const [activeTab, setActiveTab] = useState("create");
  const [editData, setEditData] = useState(null);


  return (
    <div className="assignments-container">
      <header className="assignment-header">
        <h2>Homework | Assignments</h2>
        <nav className="assignment-tabs">
          <button
            className={activeTab === "create" ? "active" : ""}
            onClick={() => setActiveTab("create")}
          >
            <FilePlus2 size={16} /> Create
          </button>
          <button
            className={activeTab === "manage" ? "active" : ""}
            onClick={() => setActiveTab("manage")}
          >
            <ListChecks size={16} /> My Assignments
          </button>
          <button
            className={activeTab === "submissions" ? "active" : ""}
            onClick={() => setActiveTab("submissions")}
          >
            <CheckCircle size={16} /> Submissions
          </button>
        </nav>
      </header>

      <div className="assignment-body">
        {activeTab === "create" && (
          <CreateAssignment
            teacher={teacher}
            editData={editData}
            setActiveTab={setActiveTab}
            setEditData={setEditData}
          />
        )}

        {activeTab === "manage" && (
          <ManageAssignments
            teacher={teacher}
            onEdit={setEditData}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "submissions" && <ViewSubmissions teacher={teacher}/>}
      </div>
    </div>
  );
}

// -----------------------------
// Create Assignment
// -----------------------------
function CreateAssignment({ teacher, editData, setActiveTab, setEditData }) {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [attachments, setAttachments] = useState([]);

  const [questionCount, setQuestionCount] = useState(5);
  const [selectedType, setSelectedType] = useState("mcq");
  const [rangeInput, setRangeInput] = useState("");
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: 5 }, (_, i) => blankQuestion(i + 1))
  );
  useEffect(() => {
    if (editData) {
      setTitle(editData.title || "");
      setInstructions(editData.instructions || "");
      setDueDate(editData.dueDate || "");
      setAttachments(editData.attachments || []);
      setQuestions(editData.questions || []);
    }
  }, [editData]);


  const fileRef = useRef();

  useEffect(() => {
    setQuestions((prev) => {
      const next = prev.slice(0, questionCount);
      while (next.length < questionCount) next.push(blankQuestion(next.length + 1));
      return next;
    });
  }, [questionCount]);

  function blankQuestion(no) {
    return {
      qNo: no,
      type: "mcq",
      text: "",
      options: ["A", "B", "C", "D"],
      correct: [],
      marks: 1,
      explanation: "",
      keywords: "",
      tolerance: "",
      fileType: "",
      showAdvanced: false,
    };
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    const newFiles = files.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
    }));
    setAttachments((prev) => [...prev, ...newFiles]);
  }

  function applyRangeAssign() {
    const indices = parseRanges(rangeInput);
    if (!indices.length) return alert("Invalid input format.");
    setQuestions((prev) => {
      const copy = [...prev];
      indices.forEach((i) => {
        if (i >= 0 && i < copy.length) copy[i] = { ...copy[i], type: selectedType };
      });
      return copy;
    });
    setRangeInput("");
  }

  function toggleAdvanced(i) {
    setQuestions((prev) =>
      prev.map((q, idx) => (idx === i ? { ...q, showAdvanced: !q.showAdvanced } : q))
    );
  }

  function updateQuestion(i, data) {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[i] = { ...copy[i], ...data };
      return copy;
    });
  }



  async function handleSave(publish = false) {
    if (!title.trim()) return alert("Please enter a title");

    const data = {
      title,
      instructions,
      dueDate,
      attachments,
      questions,
      createdBy: teacher?.email || "unknown",
      updatedAt: serverTimestamp(),
      status: publish ? "published" : "draft",
    };

    try {
      if (editData?.id) {
        await updateDoc(doc(db, "assignments", editData.id), data);
        alert("✅ Assignment updated successfully!");
      } else {
        await addDoc(collection(db, "assignments"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        alert(publish ? "✅ Published" : "💾 Saved as Draft");
      }
      // Reset and return to manage view
      setEditData(null);
      setActiveTab("manage");
    } catch (err) {
      console.error("Error saving assignment:", err);
      alert("❌ Failed to save assignment.");
    }
  }


  return (
    <div className="create-assignment improved">
      {/* Assignment Info - Horizontal Layout */}
      <div className="assignment-info-grid">
        {/* LEFT SIDE */}
        <div className="assignment-left">
          <div className="form-group">
            <label>Assignment Title</label>
            <input
              className="form-input"
              placeholder="Assignment Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Instructions</label>
            <textarea
              className="form-textarea"
              placeholder="Instructions or task description"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="assignment-right">
          <div className="form-group">
            <label><Calendar size={14} /> Due Date</label>
            <input
              type="date"
              className="form-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="attachments-box">
            <div className="attachment-header">
              <FileText size={14} /> <h4>Attachments</h4>
            </div>
            <input type="file" multiple ref={fileRef} hidden onChange={handleFileChange} />
            <button className="btn-outline" onClick={() => fileRef.current.click()}>
              <Upload size={14} /> Add Files
            </button>
            <div className="file-preview">
              {attachments.map((a, i) => (
                <div key={i} className="file-item">
                  <FileText size={13} /> {a.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* Controls */}
      <div className="question-controls">
        <label>Number of questions</label>
        <input
          type="number"
          min={1}
          max={200}
          className="form-input small"
          value={questionCount}
          onChange={(e) => setQuestionCount(Number(e.target.value || 1))}
        />

        <div className="type-selector">
          {QUESTION_TYPES.map((t) => (
            <button
              key={t.id}
              className={`type-pill ${selectedType === t.id ? "active" : ""}`}
              onClick={() => setSelectedType(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="range-assign">
          <input
            placeholder="Assign slots: ex. 1-3,5,7"
            className="form-input"
            value={rangeInput}
            onChange={(e) => setRangeInput(e.target.value)}
          />
          <button className="btn-outline" onClick={applyRangeAssign}>
            Apply
          </button>
        </div>
      </div>

      {/* Questions */}
      <div className="question-list">
        {questions.map((q, i) => (
          <div key={i} className="question-row">
            <div className="basic-row">
              <span className="q-no">Q{i + 1}</span>
              <select
                value={q.type}
                onChange={(e) => updateQuestion(i, { type: e.target.value })}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                className="marks-input"
                type="number"
                value={q.marks}
                onChange={(e) => updateQuestion(i, { marks: Number(e.target.value) })}
              />
              <input
                className="question-text"
                placeholder="Enter question (optional)"
                value={q.text}
                onChange={(e) => updateQuestion(i, { text: e.target.value })}
              />
              <button className="btn-advanced" onClick={() => toggleAdvanced(i)}>
                {q.showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                Advanced
              </button>
            </div>

            {/* BASIC (always visible) */}
            <div className="simple-setup">
              {["mcq", "msq"].includes(q.type) && (
                <div className="options-inline">
                  {q.options.map((opt, j) => (
                    <label key={j} className="opt-edit">
                      <input
                        type={q.type === "msq" ? "checkbox" : "radio"}
                        name={`correct-${i}`}
                        checked={(q.correct || []).includes(j)}
                        onChange={() => {
                          if (q.type === "msq") {
                            const set = new Set(q.correct || []);
                            set.has(j) ? set.delete(j) : set.add(j);
                            updateQuestion(i, { correct: Array.from(set) });
                          } else updateQuestion(i, { correct: [j] });
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              )}

              {q.type === "tf" && (
                <select
                  className="tf-select"
                  value={q.correct[0] || ""}
                  onChange={(e) => updateQuestion(i, { correct: [Number(e.target.value)] })}
                >
                  <option value="">Select correct</option>
                  <option value="0">True</option>
                  <option value="1">False</option>
                </select>
              )}

              {q.type === "short" && (
                <input
                  className="form-input small"
                  placeholder="Expected short answer"
                  value={q.correct[0] || ""}
                  onChange={(e) => updateQuestion(i, { correct: [e.target.value] })}
                />
              )}

              {q.type === "long" && (
                <textarea
                  className="form-textarea small"
                  placeholder="Expected descriptive answer (optional)"
                  value={q.correct[0] || ""}
                  onChange={(e) => updateQuestion(i, { correct: [e.target.value] })}
                />
              )}

              {q.type === "numeric" && (
                <input
                  type="number"
                  className="form-input small"
                  placeholder="Enter correct number"
                  value={q.correct[0] || ""}
                  onChange={(e) => updateQuestion(i, { correct: [e.target.value] })}
                />
              )}

              {q.type === "file" && (
                <input
                  className="form-input small"
                  placeholder="Expected upload description"
                  value={q.correct[0] || ""}
                  onChange={(e) => updateQuestion(i, { correct: [e.target.value] })}
                />
              )}
            </div>

            {/* ADVANCED (optional extras) */}
            {q.showAdvanced && (
              <div className="advanced-section">
                {["mcq", "msq"].includes(q.type) && (
                  <>
                    <h5>Edit Options</h5>
                    {q.options.map((opt, j) => (
                      <div key={j} className="opt-edit">
                        <input
                          className="form-input small"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[j] = e.target.value;
                            updateQuestion(i, { options: newOpts });
                          }}
                        />
                        <button
                          className="btn-icon"
                          onClick={() => {
                            const newOpts = q.options.filter((_, idx) => idx !== j);
                            updateQuestion(i, { options: newOpts });
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn-outline small"
                      onClick={() =>
                        updateQuestion(i, { options: [...q.options, `Option ${q.options.length + 1}`] })
                      }
                    >
                      <PlusCircle size={14} /> Add Option
                    </button>

                    <textarea
                      className="form-textarea small"
                      placeholder="Explanation (optional)"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
                    />
                  </>
                )}

                {["short", "long"].includes(q.type) && (
                  <>
                    <input
                      className="form-input"
                      placeholder="Keywords for checking (comma separated)"
                      value={q.keywords}
                      onChange={(e) => updateQuestion(i, { keywords: e.target.value })}
                    />
                    <textarea
                      className="form-textarea small"
                      placeholder="Explanation / Notes"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
                    />
                  </>
                )}

                {q.type === "numeric" && (
                  <>
                    <input
                      className="form-input small"
                      placeholder="Allowed tolerance (e.g. ±0.5)"
                      value={q.tolerance}
                      onChange={(e) => updateQuestion(i, { tolerance: e.target.value })}
                    />
                    <textarea
                      className="form-textarea small"
                      placeholder="Explanation or formula (optional)"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
                    />
                  </>
                )}

                {q.type === "file" && (
                  <>
                    <input
                      className="form-input small"
                      placeholder="Expected file type (e.g. PDF, PNG)"
                      value={q.fileType}
                      onChange={(e) => updateQuestion(i, { fileType: e.target.value })}
                    />
                    <textarea
                      className="form-textarea small"
                      placeholder="Instructions for upload"
                      value={q.explanation}
                      onChange={(e) => updateQuestion(i, { explanation: e.target.value })}
                    />
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="assignment-actions">
        <button className="btn-primary" onClick={() => handleSave(true)}>
          <Send size={14} /> Publish
        </button>
        <button className="btn-outline" onClick={() => handleSave(false)}>
          <Save size={14} /> Save Draft
        </button>
      </div>
    </div>
  );
}

// -----------------------------



