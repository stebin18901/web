import React from "react";
import { EXAM_TYPES, getAcademicYearOptions } from "./academicUtils";
import { Plus, Trash2 } from "lucide-react";

const ExamSetupPanel = ({
  classes = [],
  availableSubjects = [],
  form,
  onChange,
  onToggleSubject,
  onMaxMarksChange,
  onAddSubject,
  onRemoveSubject,
  onSaveSubjects,
  subjectDraft = "",
  onSubjectDraftChange,
  canManageSubjects = true,
}) => {
  return (
    <section className="academic-card">
      <div className="academic-card-head">
        <div>
          <h3>Exam Setup</h3>
          <p>Choose the exam, class roster, subjects, and maximum marks before entering scores.</p>
        </div>
      </div>

      <div className="academic-filter-grid">
        <div className="academic-field">
          <label>Academic Year</label>
          <select className="academic-select" value={form.academicYear} onChange={(e) => onChange("academicYear", e.target.value)}>
            {getAcademicYearOptions().map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
        <div className="academic-field">
          <label>Exam Type</label>
          <select className="academic-select" value={form.examType} onChange={(e) => onChange("examType", e.target.value)}>
            {EXAM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="academic-field">
          <label>Custom Name</label>
          <input className="academic-input" value={form.examName} onChange={(e) => onChange("examName", e.target.value)} placeholder="Optional custom exam name" />
        </div>
        <div className="academic-field">
          <label>Class</label>
          <select className="academic-select" value={form.className} onChange={(e) => onChange("className", e.target.value)}>
            <option value="">Select class</option>
            {Array.from(new Set(classes.map((entry) => entry.className))).map((className) => (
              <option key={className} value={className}>{className}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="academic-card" style={{ padding: "1rem", marginTop: "1rem" }}>
        <div className="academic-card-head">
          <div>
            <h4>Subjects</h4>
            <p>Select subjects, add custom ones, delete unused ones, and leave student marks blank when a subject is not entered yet.</p>
          </div>
        </div>
        {canManageSubjects ? (
          <div className="academic-subject-toolbar">
            <input
              className="academic-input"
              value={subjectDraft}
              onChange={(e) => onSubjectDraftChange?.(e.target.value)}
              placeholder="Add a new subject"
            />
            <button type="button" className="academic-btn-secondary" onClick={onAddSubject}>
              <Plus size={16} />
              Add Subject
            </button>
            <button type="button" className="academic-btn" onClick={onSaveSubjects}>
              Save Subjects
            </button>
          </div>
        ) : null}
        <div className="academic-summary-grid">
          {availableSubjects.map((subject) => {
            const selected = form.subjects.includes(subject);
            return (
              <div key={subject} className="academic-summary-card">
                <div className="academic-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="academic-subject-actions">
                    <button
                      type="button"
                      className={selected ? "academic-btn-secondary" : "academic-btn-ghost"}
                      onClick={() => onToggleSubject(subject)}
                    >
                      {subject}
                    </button>
                    {canManageSubjects ? (
                      <button
                        type="button"
                        className="academic-icon-btn academic-icon-btn-danger"
                        onClick={() => onRemoveSubject?.(subject)}
                        title={`Delete ${subject}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                  <input
                    className="academic-input"
                    style={{ maxWidth: 110 }}
                    type="number"
                    min="0"
                    value={form.maxMarks[subject] || ""}
                    onChange={(e) => onMaxMarksChange(subject, e.target.value)}
                    placeholder="Max marks"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ExamSetupPanel;
