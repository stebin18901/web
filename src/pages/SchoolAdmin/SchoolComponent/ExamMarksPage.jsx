import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./AcademicManagement.css";
import ExamSetupPanel from "./ExamSetupPanel";
import MarksEntryTable from "./MarksEntryTable";
import BulkMarksPaste from "./BulkMarksPaste";
import MarksSummaryCards from "./MarksSummaryCards";
import StudentMarksHistory from "./StudentMarksHistory";
import { syncExamNotifications } from "./parentNotificationUtils";
import {
  buildExamDocId,
  calculateMarksRecord,
  getMarksSummary,
  getRoleLabel,
  loadStudentsForClass,
  normalizeClassName,
  normalizeSchoolId,
  normalizeSection,
  resolveSchoolClasses,
  resolveTeacherAcademicScope,
  splitClassAndDivision,
} from "./academicUtils";

const buildSubjectPreferenceKey = ({ schoolId, className, section }) =>
  `hepsy_exam_subject_pref:${normalizeSchoolId(schoolId)}:${normalizeClassName(className)}:${normalizeSection(section || "general")}`;

const readSubjectPreference = (key) => {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      subjects: Array.isArray(parsed?.subjects) ? parsed.subjects.filter(Boolean) : [],
      availableSubjects: Array.isArray(parsed?.availableSubjects) ? parsed.availableSubjects.filter(Boolean) : [],
      maxMarks: parsed?.maxMarks && typeof parsed.maxMarks === "object" ? parsed.maxMarks : {},
    };
  } catch (error) {
    console.warn("Unable to read exam subject preference:", error);
    return null;
  }
};

const writeSubjectPreference = (key, value) => {
  if (!key || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to store exam subject preference:", error);
  }
};

const ExamMarksPage = ({ schoolId, mode = "school_admin", teacher = null, actorName = "School Admin" }) => {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [savedExams, setSavedExams] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState("");
  const [activeTab, setActiveTab] = useState("manual");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    academicYear: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
    examType: "Unit Test",
    examName: "",
    className: "",
    section: "",
    subjects: [],
    maxMarks: {},
  });
  const [availableSubjects, setAvailableSubjects] = useState(["Mathematics", "Science", "English", "Social", "General Knowledge"]);
  const [subjectDraft, setSubjectDraft] = useState("");
  const [subjectRemovalTarget, setSubjectRemovalTarget] = useState("");
  const activeSubjectPreferenceKeyRef = useRef("");
  const restoringSubjectPreferenceRef = useRef(false);

  useEffect(() => {
    const loadScope = async () => {
      setLoading(true);
      try {
        if (mode === "teacher" && teacher) {
          const scope = await resolveTeacherAcademicScope(teacher);
          setClasses(scope.classes);
          setForm((prev) => ({
            ...prev,
            className: prev.className || scope.classes[0]?.className || "",
            section: prev.section || scope.classes[0]?.section || "",
            subjects: prev.subjects.length ? prev.subjects : scope.canManageAllSubjects ? prev.subjects : scope.subjects,
          }));
          if (!scope.canManageAllSubjects && scope.subjects.length) {
            setAvailableSubjects(scope.subjects);
          }
        } else {
          const schoolClasses = await resolveSchoolClasses(schoolId);
          setClasses(schoolClasses);
          setForm((prev) => ({
            ...prev,
            className: prev.className || schoolClasses[0]?.className || "",
            section: prev.section || schoolClasses[0]?.section || "",
          }));
        }
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load exam setup." });
      } finally {
        setLoading(false);
      }
    };
    loadScope();
  }, [mode, schoolId, teacher]);

  useEffect(() => {
    if (!form.className) {
      setForm((prev) => (prev.section ? { ...prev, section: "" } : prev));
      return;
    }

    const matchedClass = classes.find((entry) => entry.className === form.className);
    const derivedSection = matchedClass?.section || "";
    setForm((prev) => (prev.section === derivedSection ? prev : { ...prev, section: derivedSection }));
  }, [classes, form.className]);

  useEffect(() => {
    if (!schoolId || !form.className) return;

    const preferenceKey = buildSubjectPreferenceKey({
      schoolId,
      className: form.className,
      section: form.section,
    });

    activeSubjectPreferenceKeyRef.current = preferenceKey;
    const preference = readSubjectPreference(preferenceKey);
    if (!preference?.subjects?.length && !preference?.availableSubjects?.length) return;

    restoringSubjectPreferenceRef.current = true;
    setAvailableSubjects((prev) =>
      Array.from(new Set([...prev, ...(preference.availableSubjects || []), ...(preference.subjects || [])])).filter(Boolean)
    );
    setForm((prev) => {
      const resolvedSubjects = preference.subjects?.length ? preference.subjects : prev.subjects;
      const resolvedMaxMarks = resolvedSubjects.reduce((accumulator, subject) => {
        const storedValue = preference.maxMarks?.[subject];
        const currentValue = prev.maxMarks?.[subject];
        accumulator[subject] =
          storedValue === 0 || storedValue
            ? storedValue
            : currentValue === 0 || currentValue
              ? currentValue
              : 100;
        return accumulator;
      }, {});

      return {
        ...prev,
        subjects: resolvedSubjects,
        maxMarks: resolvedMaxMarks,
      };
    });

    const resetTimer = window.setTimeout(() => {
      restoringSubjectPreferenceRef.current = false;
    }, 0);

    return () => window.clearTimeout(resetTimer);
  }, [form.className, form.section, schoolId]);

  useEffect(() => {
    if (!activeSubjectPreferenceKeyRef.current || restoringSubjectPreferenceRef.current || !form.className) return;

    const trackedSubjects = Array.from(new Set([...availableSubjects, ...form.subjects])).filter(Boolean);
    writeSubjectPreference(activeSubjectPreferenceKeyRef.current, {
      subjects: form.subjects,
      availableSubjects: trackedSubjects,
      maxMarks: trackedSubjects.reduce((accumulator, subject) => {
        const value = form.maxMarks?.[subject];
        if (value === 0 || value) accumulator[subject] = value;
        return accumulator;
      }, {}),
      updatedAt: new Date().toISOString(),
    });
  }, [availableSubjects, form.className, form.maxMarks, form.subjects]);

  useEffect(() => {
    const loadStudents = async () => {
      if (!form.className) {
        setStudents([]);
        setRecords([]);
        return;
      }
      setLoading(true);
      try {
        const nextStudents = await loadStudentsForClass({ schoolId, className: form.className, section: form.section });
        const classParts = splitClassAndDivision(form.className);
        const resolvedClassKey =
          normalizeSection(form.section) && classParts.grade && classParts.division !== normalizeSection(form.section)
            ? `${classParts.grade}${normalizeSection(form.section)}`
            : normalizeClassName(form.className);
        setStudents(nextStudents);
        setRecords(
          nextStudents.map((student) =>
            calculateMarksRecord(
              {
                studentId: `${normalizeSchoolId(schoolId)}_${resolvedClassKey}_${String(student.rollNumber || "").trim()}`.toLowerCase(),
                rollNumber: student.rollNumber,
                fullName: student.fullName,
                className: student.className || form.className,
                section: student.section || form.section,
                phone: student.phone || "",
                email: student.email || "",
                marksBySubject: {},
                remarks: "",
              },
              form.subjects,
              form.maxMarks
            )
          )
        );
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load students for marks entry." });
      } finally {
        setLoading(false);
      }
    };
    loadStudents();
  }, [form.className, form.section, form.subjects, form.maxMarks, schoolId]);

  useEffect(() => {
    const loadSavedExams = async () => {
      if (!schoolId) return;
      const snap = await getDocs(collection(db, "schools", normalizeSchoolId(schoolId), "examMarks"));
      setSavedExams(snap.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    };
    loadSavedExams();
  }, [schoolId, saving]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedSubjects = form.subjects;
  const selectedMaxMarks = form.maxMarks;
  const subjectKey = useMemo(() => form.subjects.join("|"), [form.subjects]);
  const maxMarksKey = useMemo(() => JSON.stringify(form.maxMarks || {}), [form.maxMarks]);

  useEffect(() => {
    const hydrateSavedExam = async () => {
      const examName = form.examType === "Custom Exam" ? form.examName || "Custom Exam" : form.examName || form.examType;
      if (!schoolId || !form.className || !selectedSubjects.length || !examName) return;

      setHydrating(true);
      try {
        const examId = buildExamDocId({
          academicYear: form.academicYear,
          examType: form.examType,
          examName,
          className: form.className,
          section: form.section,
        });
        const examRef = doc(db, "schools", normalizeSchoolId(schoolId), "examMarks", examId);
        const snap = await getDoc(examRef);
        if (!snap.exists()) return;

        const saved = snap.data() || {};
        const savedSubjects = Array.isArray(saved.subjects) && saved.subjects.length ? saved.subjects : selectedSubjects;
        const savedMaxMarks = saved.maxMarks || selectedMaxMarks;
        setAvailableSubjects((prev) =>
          Array.from(new Set([...prev, ...savedSubjects])).filter(Boolean)
        );

        setForm((prev) => ({
          ...prev,
          subjects: savedSubjects,
          maxMarks: savedMaxMarks,
        }));
        setRecords((saved.records || []).map((record) => calculateMarksRecord(record, savedSubjects, savedMaxMarks)));
      } catch (error) {
        setToast({ type: "error", message: error.message || "Unable to load saved exam marks." });
      } finally {
        setHydrating(false);
      }
    };

    hydrateSavedExam();
  }, [form.academicYear, form.className, form.examName, form.examType, form.section, maxMarksKey, schoolId, selectedMaxMarks, selectedSubjects, subjectKey]);

  const summary = useMemo(() => getMarksSummary(records, form.subjects, form.maxMarks), [records, form.maxMarks, form.subjects]);

  const updateForm = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const normalizeSubjectLabel = (value) =>
    String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());

  const toggleSubject = (subject) => {
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((item) => item !== subject)
        : [...prev.subjects, subject],
      maxMarks: prev.maxMarks[subject] !== undefined ? prev.maxMarks : { ...prev.maxMarks, [subject]: 100 },
    }));
  };

  const updateMaxMarks = (subject, value) => {
    setForm((prev) => ({ ...prev, maxMarks: { ...prev.maxMarks, [subject]: value } }));
  };

  const addSubject = () => {
    const nextSubject = normalizeSubjectLabel(subjectDraft);
    if (!nextSubject) {
      setToast({ type: "error", message: "Enter a subject name before adding it." });
      return;
    }

    setAvailableSubjects((prev) => (prev.includes(nextSubject) ? prev : [...prev, nextSubject]));
    setForm((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(nextSubject) ? prev.subjects : [...prev.subjects, nextSubject],
      maxMarks: prev.maxMarks[nextSubject] !== undefined ? prev.maxMarks : { ...prev.maxMarks, [nextSubject]: 100 },
    }));
    setSubjectDraft("");
  };

  const handleSaveSubjectPreferences = () => {
    if (!schoolId || !form.className) {
      setToast({ type: "error", message: "Choose a class before saving subjects." });
      return;
    }

    const preferenceKey = buildSubjectPreferenceKey({
      schoolId,
      className: form.className,
      section: form.section,
    });

    const trackedSubjects = Array.from(new Set([...availableSubjects, ...form.subjects])).filter(Boolean);
    writeSubjectPreference(preferenceKey, {
      subjects: form.subjects,
      availableSubjects: trackedSubjects,
      maxMarks: trackedSubjects.reduce((accumulator, subject) => {
        const value = form.maxMarks?.[subject];
        if (value === 0 || value) accumulator[subject] = value;
        return accumulator;
      }, {}),
      updatedAt: new Date().toISOString(),
    });

    activeSubjectPreferenceKeyRef.current = preferenceKey;
    setToast({ type: "success", message: `Saved subjects for ${form.className}${form.section ? ` ${form.section}` : ""}.` });
  };

  const removeSubject = (subject) => {
    setAvailableSubjects((prev) => prev.filter((item) => item !== subject));
    setForm((prev) => {
      const nextMaxMarks = { ...prev.maxMarks };
      delete nextMaxMarks[subject];
      return {
        ...prev,
        subjects: prev.subjects.filter((item) => item !== subject),
        maxMarks: nextMaxMarks,
      };
    });
    setSubjectRemovalTarget("");
  };

  const requestSubjectRemoval = (subject) => {
    setSubjectRemovalTarget(subject);
  };

  const updateRecord = (studentId, field, value, isRemark = false) => {
    setRecords((prev) =>
      prev.map((record) => {
        if (record.studentId !== studentId) return record;
        const nextRecord = isRemark
          ? { ...record, remarks: value }
          : {
              ...record,
              marksBySubject: {
                ...record.marksBySubject,
                [field]: value,
              },
            };
        return calculateMarksRecord(nextRecord, form.subjects, form.maxMarks);
      })
    );
  };

  const applyBulkRows = (rows) => {
    setRecords((prev) =>
      prev.map((record) => {
        const matchedRow = rows.find((row) => String(row[0] || "").trim() === String(record.rollNumber || "").trim());
        if (!matchedRow) return record;
        const marksBySubject = {};
        form.subjects.forEach((subject, index) => {
          marksBySubject[subject] = matchedRow[index + 2] ?? "";
        });
        return calculateMarksRecord(
          {
            ...record,
            marksBySubject,
          },
          form.subjects,
          form.maxMarks
        );
      })
    );
  };

  const handleSave = async () => {
    if (!form.className || !form.subjects.length) {
      setToast({ type: "error", message: "Select class and at least one subject before saving." });
      return;
    }
    if (records.some((record) => record.hasError)) {
      setToast({ type: "error", message: "Fix invalid marks before saving." });
      return;
    }
    setSaving(true);
    try {
      const examName = form.examType === "Custom Exam" ? form.examName || "Custom Exam" : form.examName || form.examType;
      const examId = buildExamDocId({
        academicYear: form.academicYear,
        examType: form.examType,
        examName,
        className: form.className,
        section: form.section,
      });
      const payload = {
        schoolId: normalizeSchoolId(schoolId),
        examName,
        examType: form.examType,
        academicYear: form.academicYear,
        className: form.className,
        section: form.section,
        subjects: form.subjects,
        maxMarks: form.maxMarks,
        records,
        summary,
        createdBy: actorName,
        createdByRole: getRoleLabel(mode === "teacher" ? teacher?.role : "school_admin"),
        updatedAt: serverTimestamp(),
      };
      await setDoc(doc(db, "schools", normalizeSchoolId(schoolId), "examMarks", examId), payload, { merge: true });
      await syncExamNotifications({
        schoolId,
        examId,
        examName,
        academicYear: form.academicYear,
        className: form.className,
        section: form.section,
        records,
      });
      setToast({ type: "success", message: "Exam marks saved successfully." });
    } catch (error) {
      setToast({ type: "error", message: error.message || "Unable to save exam marks." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="academic-page">
      <section className="academic-hero">
        <div>
          <p className="academic-kicker">Academic Layer</p>
          <h1>Exam Marks</h1>
          <p>Enter, review, and update school exam marks in a simple spreadsheet-friendly workflow.</p>
        </div>
        <div className="academic-hero-badge">
          <span>Access</span>
          <strong>{mode === "teacher" ? getRoleLabel(teacher?.role) : "School Admin"}</strong>
        </div>
      </section>

      <ExamSetupPanel
        classes={classes}
        availableSubjects={availableSubjects}
        form={form}
        onChange={updateForm}
        onToggleSubject={toggleSubject}
        onMaxMarksChange={updateMaxMarks}
        onAddSubject={addSubject}
        onRemoveSubject={requestSubjectRemoval}
        onSaveSubjects={handleSaveSubjectPreferences}
        subjectDraft={subjectDraft}
        onSubjectDraftChange={setSubjectDraft}
        canManageSubjects={mode !== "teacher" || teacher?.role === "school_admin"}
      />

      <MarksSummaryCards summary={summary} />

      <div className="academic-tabs">
        <button type="button" className={activeTab === "manual" ? "active" : ""} onClick={() => setActiveTab("manual")}>
          Manual Entry
        </button>
        <button type="button" className={activeTab === "bulk" ? "active" : ""} onClick={() => setActiveTab("bulk")}>
          Bulk Paste
        </button>
        <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setActiveTab("history")}>
          Student History
        </button>
      </div>

      {loading || hydrating ? (
        <div className="academic-state">Loading exam marks workspace...</div>
      ) : activeTab === "manual" ? (
        <MarksEntryTable subjects={form.subjects} rows={records} maxMarks={form.maxMarks} onCellChange={updateRecord} />
      ) : activeTab === "bulk" ? (
        <BulkMarksPaste subjects={form.subjects} onApply={applyBulkRows} />
      ) : (
        <StudentMarksHistory
          exams={savedExams}
          selectedStudentId={selectedHistoryStudentId}
          onStudentChange={setSelectedHistoryStudentId}
          students={students}
        />
      )}

      <section className="academic-card">
        <div className="academic-card-head">
          <div>
            <h3>Saved Exams</h3>
            <p>Saved records are edit-ready because the same class/year/exam combination reuses the same exam document.</p>
          </div>
        </div>
        <div className="academic-table-wrap">
          <table className="academic-table">
            <thead>
              <tr>
                <th>Exam</th>
                <th>Year</th>
                <th>Class</th>
                <th>Section</th>
                <th>Subjects</th>
                <th>Average</th>
              </tr>
            </thead>
            <tbody>
              {savedExams.length ? (
                savedExams.map((exam) => (
                  <tr key={exam.id}>
                    <td>{exam.examName || exam.examType}</td>
                    <td>{exam.academicYear}</td>
                    <td>{exam.className}</td>
                    <td>{exam.section || "-"}</td>
                    <td>{(exam.subjects || []).join(", ")}</td>
                    <td>{exam.summary?.classAverage || 0}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6">No exam marks saved yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="academic-sticky-bar">
        <div>
          <strong>{records.length} student records ready</strong>
          <p>Inline validation prevents marks above max marks before saving.</p>
        </div>
        <button type="button" className="academic-btn" onClick={handleSave} disabled={saving || !records.length}>
          {saving ? "Saving..." : "Save Exam Marks"}
        </button>
      </div>

      {subjectRemovalTarget ? (
        <div className="academic-modal-overlay" onClick={() => setSubjectRemovalTarget("")}>
          <div className="academic-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Remove subject from this class setup?</h4>
            <p>
              <strong>{subjectRemovalTarget}</strong> will be removed from the available subject list and current exam setup
              for {form.className}
              {form.section ? ` ${form.section}` : ""}.
            </p>
            <div className="academic-modal-actions">
              <button type="button" className="academic-btn-secondary" onClick={() => setSubjectRemovalTarget("")}>
                Cancel
              </button>
              <button type="button" className="academic-btn-danger" onClick={() => removeSubject(subjectRemovalTarget)}>
                Remove Subject
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className={`academic-toast tone-${toast.type === "error" ? "danger" : "success"}`}>{toast.message}</div> : null}
    </div>
  );
};

export default ExamMarksPage;
