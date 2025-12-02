import React, { useState } from "react";
import notesData from "./data/math_notes.json";
import { InlineMath, BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import "./NotesViewer.css";

// ✅ Enhanced universal LaTeX renderer
const renderLatex = (text) => {
  if (!text) return null;

  // Clean and normalize JSON-escaped LaTeX
  let safeText = text
    .replace(/\\\\/g, "\\") // Convert \\( → \( and \\{ → \{
    .replace(/\\\{/g, "{")
    .replace(/\\\}/g, "}")
    .replace(/\\n/g, " ")
    .trim();

  // Unified regex: supports \( ... \), \[ ... \], $$ ... $$
  const regex =
    /(\$\$([^$]+)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^$]+)\$)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(safeText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={lastIndex}>{safeText.slice(lastIndex, match.index)}</span>
      );
    }

    const latex =
      match[2] || match[3] || match[4] || match[5] || match[1];
    const isBlock = match[0].startsWith("$$") || match[0].startsWith("\\[");

    parts.push(
      isBlock ? (
        <BlockMath key={match.index}>{latex.trim()}</BlockMath>
      ) : (
        <InlineMath key={match.index}>{latex.trim()}</InlineMath>
      )
    );

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < safeText.length) {
    parts.push(<span key={lastIndex}>{safeText.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
};

const NotesViewer = () => {
  const data = notesData.data || [];
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapter, setSelectedChapter] = useState("");
  const [selectedPart, setSelectedPart] = useState("");
  const [viewType, setViewType] = useState("notes");
  const [selectedQuiz, setSelectedQuiz] = useState("");

  // Safe data access with defaults
  const classData = data.find((c) => c.class_id === selectedClass);
  const subjectData = classData?.subjects?.find(
    (s) => s.subject_id === selectedSubject
  );
  const chapterData = subjectData?.chapters?.find(
    (ch) => ch.chapter_id === selectedChapter
  );
  const parts = chapterData?.parts || [];
  const part = parts.find((p) => p.part_id === selectedPart) || parts[0];

  const quizList = part?.quiz_data ? Object.values(part.quiz_data) : [];
  const activeQuiz = quizList.find((q) => q.quiz_id === selectedQuiz) || quizList[0];

  // ✅ Safe render functions for nested content (now inside component)
  const renderExamples = (examples) => {
    if (!examples || !Array.isArray(examples)) return null;
    return (
      <>
        <strong>Examples:</strong>
        <ul>
          {examples.map((ex, i) => (
            <li key={i}>{renderLatex(ex)}</li>
          ))}
        </ul>
      </>
    );
  };

  const renderTypesOfSets = (typesData) => {
    if (!typesData?.content || !Array.isArray(typesData.content)) return null;
    return (
      <>
        <h4>🔹 Types of Sets</h4>
        <ul>
          {typesData.content.map((t, i) => (
            <li key={i}>
              <strong>{t.type}:</strong> {renderLatex(t.definition)}
            </li>
          ))}
        </ul>
      </>
    );
  };

  const renderRepresentation = (repData) => {
    if (!repData?.types || !Array.isArray(repData.types)) return null;
    return (
      <>
        <h4>🧩 Representation of Sets</h4>
        {repData.types.map((t, i) => (
          <div key={i} className="content-block">
            <strong>{t.name}:</strong> {renderLatex(t.description)}
            <br />
            <em>Example:</em> {renderLatex(t.example)}
          </div>
        ))}
        {repData.key_point && (
          <p className="key-point">
            <strong>Key Point:</strong> {renderLatex(repData.key_point)}
          </p>
        )}
      </>
    );
  };

  const renderOperations = (operations) => {
    if (!operations) return null;
    return (
      <>
        <h4>⚙️ Operations on Sets</h4>
        {Object.entries(operations).map(([key, val]) => {
          if (key === "properties" && Array.isArray(val)) {
            return (
              <div key={key} className="properties-section">
                <strong>Properties:</strong>
                <ul>
                  {val.map((p, i) => (
                    <li key={i}>{renderLatex(p)}</li>
                  ))}
                </ul>
              </div>
            );
          }
          
          if (val && typeof val === 'object' && val.definition) {
            return (
              <div key={key} className="operation-item">
                <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong>{" "}
                {renderLatex(val.definition)}
                {val.example && (
                  <>
                    <br />
                    <em>Example:</em> {renderLatex(val.example)}
                  </>
                )}
              </div>
            );
          }
          
          return null;
        })}
      </>
    );
  };

  const renderLaws = (lawsData) => {
    if (!lawsData?.important_laws || !Array.isArray(lawsData.important_laws)) return null;
    return (
      <>
        <h4>📗 Laws of Set Algebra</h4>
        <ul>
          {lawsData.important_laws.map((law, i) => (
            <li key={i}>{renderLatex(law)}</li>
          ))}
        </ul>
        {lawsData.example && <p>{renderLatex(lawsData.example)}</p>}
      </>
    );
  };

  return (
    <div className="notes-root">
      <h1 className="main-title">{notesData.description}</h1>

      {/* ======= DROPDOWNS ======= */}
      <div className="dropdowns">
        <select
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setSelectedSubject("");
            setSelectedChapter("");
            setSelectedPart("");
          }}
        >
          <option value="">Select Class</option>
          {data.map((cls) => (
            <option key={cls.class_id} value={cls.class_id}>
              {cls.class_name}
            </option>
          ))}
        </select>

        {selectedClass && (
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedChapter("");
              setSelectedPart("");
            }}
          >
            <option value="">Select Subject</option>
            {classData?.subjects?.map((sub) => (
              <option key={sub.subject_id} value={sub.subject_id}>
                {sub.subject_name}
              </option>
            )) ?? []}
          </select>
        )}

        {selectedSubject && (
          <select
            value={selectedChapter}
            onChange={(e) => {
              setSelectedChapter(e.target.value);
              setSelectedPart("");
            }}
          >
            <option value="">Select Chapter</option>
            {subjectData?.chapters?.map((ch) => (
              <option key={ch.chapter_id} value={ch.chapter_id}>
                {ch.chapter_name}
              </option>
            )) ?? []}
          </select>
        )}

        {selectedChapter && parts.length > 1 && (
          <select
            value={selectedPart}
            onChange={(e) => setSelectedPart(e.target.value)}
          >
            <option value="">Select Part</option>
            {parts.map((p) => (
              <option key={p.part_id} value={p.part_id}>
                {p.part_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* ======= TABS ======= */}
      {selectedChapter && (
        <div className="tab-container">
          <button
            className={`tab ${viewType === "notes" ? "active" : ""}`}
            onClick={() => setViewType("notes")}
          >
            🧾 Notes
          </button>
          <button
            className={`tab ${viewType === "quiz" ? "active" : ""}`}
            onClick={() => setViewType("quiz")}
          >
            🧮 Quiz
          </button>
        </div>
      )}

      {/* ======= NOTES ======= */}
      {part && viewType === "notes" && (
        <div className="notes-section">
          <h2>
            {chapterData?.chapter_name} — {part.part_name}
          </h2>
          <p className="desc">{part.part_description}</p>

          {part.notes && (
            <div className="part-content">
              {/* Introduction */}
              {part.notes.introduction && (
                <>
                  <h4>📘 Introduction</h4>
                  {part.notes.introduction.definition && (
                    <p>{renderLatex(part.notes.introduction.definition)}</p>
                  )}
                  {part.notes.introduction.notation && (
                    <p>{renderLatex(part.notes.introduction.notation)}</p>
                  )}
                  {renderExamples(part.notes.introduction.examples)}
                  
                  {part.notes.introduction.non_examples && (
                    <>
                      <strong>Non-examples:</strong>
                      <ul>
                        {part.notes.introduction.non_examples.map((ex, i) => (
                          <li key={i}>{renderLatex(ex)}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </>
              )}

              {/* Representation of Sets */}
              {renderRepresentation(part.notes.representation_of_sets)}
              
              {/* Types of Sets */}
              {renderTypesOfSets(part.notes.types_of_sets)}

              {/* Venn Diagrams */}
              {part.notes.venn_diagrams && (
                <>
                  <h4>🧠 Venn Diagrams</h4>
                  <p>{renderLatex(part.notes.venn_diagrams.description)}</p>
                  {part.notes.venn_diagrams.jee_tip && (
                    <p>
                      <em>JEE Tip:</em> {renderLatex(part.notes.venn_diagrams.jee_tip)}
                    </p>
                  )}
                </>
              )}

              {/* Operations */}
              {renderOperations(part.notes.operations_on_sets)}

              {/* Laws */}
              {renderLaws(part.notes.laws_of_set_algebra)}

              {/* Inclusion-Exclusion */}
              {part.notes.principle_of_inclusion_exclusion && (
                <>
                  <h4>📊 Principle of Inclusion–Exclusion</h4>
                  {part.notes.principle_of_inclusion_exclusion.formula && (
                    <p>{renderLatex(part.notes.principle_of_inclusion_exclusion.formula)}</p>
                  )}
                  {part.notes.principle_of_inclusion_exclusion.extension && (
                    <p>{renderLatex(part.notes.principle_of_inclusion_exclusion.extension)}</p>
                  )}
                  {part.notes.principle_of_inclusion_exclusion.example && (
                    <p>
                      <em>Example:</em> {renderLatex(part.notes.principle_of_inclusion_exclusion.example)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======= QUIZ ======= */}
      {part && viewType === "quiz" && (
        <div className="quiz-section">
          <div className="quiz-select">
            <select
              value={selectedQuiz || (quizList[0]?.quiz_id || "")}
              onChange={(e) => setSelectedQuiz(e.target.value)}
            >
              {quizList.map((q) => (
                <option key={q.quiz_id} value={q.quiz_id}>
                  {q.title} ({q.level})
                </option>
              ))}
            </select>
          </div>

          {activeQuiz && (
            <div className="quiz-content">
              <h3>{activeQuiz.title}</h3>
              <p>{renderLatex(activeQuiz.description)}</p>
              <p>
                <strong>Difficulty:</strong> {activeQuiz.level} |{" "}
                <strong>Questions:</strong> {activeQuiz.question_count}
              </p>

              {activeQuiz.questions?.map((q, i) => (
                <div key={q.question_id} className="quiz-q">
                  <p>
                    <strong>
                      Q{i + 1}. {renderLatex(q.question_text)}
                    </strong>
                  </p>

                  {q.options && (
                    <ul>
                      {q.options.map((opt, j) => (
                        <li key={j}>{renderLatex(opt)}</li>
                      ))}
                    </ul>
                  )}

                  <p>
                    ✅ <strong>Answer:</strong> {renderLatex(q.correct_answer)}
                  </p>
                  <p>
                    💡 <em>{renderLatex(q.concept_explanation)}</em>
                  </p>
                  <hr />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotesViewer;