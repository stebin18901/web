import React, { useEffect, useState } from "react";
import { doc, collection, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../../../firebase/firebaseConfig";
import {
  Plus, X, Loader2, BookOpen, Users, ListOrdered,
} from "lucide-react";
import "./ClassDetailView.css";

const DEFAULT_SUBJECTS = ["Mathematics", "Science", "English", "Social Studies", "Computer Science", "Hindi", "Malayalam"];

const ConfirmDialog = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="confirm-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="confirm-yes" onClick={onConfirm}>Yes</button>
        </div>
      </div>
    </div>
  );
};

export default function ClassDetailView({
  className,
  schoolId,
  school,
  teachers = [],
  draggedTeacher,
  setDraggedTeacher,
  selectedTeachers = [],
  setSelectedTeachers,
  onBack,
  teacher = null,
  mode = "admin",
}) {
  const [classData, setClassData] = useState(null);
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [draggedSubject, setDraggedSubject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false });
  const [studentCount, setStudentCount] = useState(null);

  useEffect(() => {
    if (!className || !schoolId) return;
    const ref = doc(db, "classes", `${schoolId}_${className}`);
    const unsub = onSnapshot(ref, (snap) => {
      setClassData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [className, schoolId]);

  useEffect(() => {
    if (!className || !schoolId) return;
    const classId = `${schoolId}_${className}`;
    const rollRef = doc(db, "classes", classId, "meta", "rollSetup");
    const studentsRef = collection(db, "classes", classId, "students");

    const unsubRoll = onSnapshot(rollRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.studentCount !== undefined) setStudentCount(data.studentCount);
      }
    });

    const unsubStudents = onSnapshot(studentsRef, (snap) => {
      if (snap.size > 0) setStudentCount(snap.size);
    });

    return () => { unsubRoll(); unsubStudents(); };
  }, [className, schoolId]);

  const upsertTeachersToClass = async (teachersToProcess) => {
    if (mode !== "admin" || !teachersToProcess.length) return;
    setLoading(true);
    try {
      const ref = doc(db, "classes", `${schoolId}_${className}`);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      let team = Array.isArray(data.team) ? [...data.team] : [];

      teachersToProcess.forEach((t) => {
        const idx = team.findIndex((item) => item.userId === t.id);
        if (idx === -1) {
          team.push({
            userId: t.id,
            name: t.name,
            email: t.email,
            subjects: [],
          });
        }
      });

      await updateDoc(ref, { team, updatedAt: new Date() });
      if (setSelectedTeachers) setSelectedTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDropTeacherOnClass = (e) => {
    e.preventDefault();
    if (mode !== "admin" || !draggedTeacher) return;

    const isPartOfSelection = selectedTeachers.some((t) => t.id === draggedTeacher.id);
    const listToAdd = isPartOfSelection ? selectedTeachers : [draggedTeacher];

    upsertTeachersToClass(listToAdd);
    setDraggedTeacher(null);
  };

  const handleDropSubjectOnTeacher = async (teacherId) => {
    if (mode !== "admin" || !draggedSubject) return;
    setLoading(true);
    try {
      const ref = doc(db, "classes", `${schoolId}_${className}`);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const team = Array.isArray(data.team) ? [...data.team] : [];
      const idx = team.findIndex((t) => t.userId === teacherId);

      if (idx !== -1) {
        const updatedSubs = new Set(team[idx].subjects || []);
        updatedSubs.add(draggedSubject);
        team[idx].subjects = [...updatedSubs];
        await updateDoc(ref, { team });
      }
    } finally {
      setDraggedSubject(null);
      setLoading(false);
    }
  };

  const handleRemoveTeacher = (teacherId) => {
    setConfirmState({
      open: true,
      message: "Remove this teacher from class?",
      onConfirm: async () => {
        const ref = doc(db, "classes", `${schoolId}_${className}`);
        const snap = await getDoc(ref);
        const team = (snap.data()?.team || []).filter((t) => t.userId !== teacherId);
        await updateDoc(ref, { team });
        setConfirmState({ open: false });
      },
      onCancel: () => setConfirmState({ open: false })
    });
  };

  const filteredTeam = mode === "teacher"
    ? (classData?.team || []).filter((t) => t.email === teacher?.email || t.email === classData?.classTeacherEmail)
    : (classData?.team || []);

  if (!classData) return <div className="class-detail-container"><Loader2 className="spin" /> Loading...</div>;

  const configuredBaseUrl = (process.env.REACT_APP_PUBLIC_BASE_URL || "").trim().replace(/\/$/, "");
  const appBaseUrl = configuredBaseUrl || window.location.origin;
  const studentFormLink = `${appBaseUrl}/school-form/${schoolId}/student`;
  const teacherFormLink = `${appBaseUrl}/class-form/${schoolId}/${className}/teacher`;

  return (
    <div className="class-detail-container">
      <div className="detail-header">
        {onBack && <button className="back-btn" onClick={onBack}>Back</button>}
        <h2><BookOpen size={20} /> {classData.className}</h2>
      </div>

      <div className="info-card">
        <p><strong>Grade:</strong> {classData.grade} | <strong>Division:</strong> {classData.division}</p>
        <p><strong>Class Teacher:</strong> {classData.classTeacherName || "-"}</p>
        <p><strong><ListOrdered size={14} /> Total Students:</strong> {studentCount ?? "..."}</p>
      </div>

      <div className="form-links-card">
        <div className="card-header">
          <h3>Class Form Links</h3>
        </div>
        <div className="form-link-row">
          <span>Student Form:</span>
          <a href={studentFormLink} target="_blank" rel="noreferrer">{studentFormLink}</a>
        </div>
        <div className="form-link-row">
          <span>Student Flow:</span>
          <em>
            Share one universal form for the whole school. Parents choose class and division inside the form, then continue to plan selection and payment.
          </em>
        </div>
        <div className="form-link-row">
          <span>Teacher Form:</span>
          <a href={teacherFormLink} target="_blank" rel="noreferrer">{teacherFormLink}</a>
        </div>
      </div>
      <div className="subjects-card">
        <div className="card-header">
          <h3>Subjects</h3>
          {mode === "admin" && (
            <button onClick={() => {
              const sub = prompt("Enter subject:");
              if (sub) setSubjects([...subjects, sub]);
            }} className="add-btn"><Plus size={14} /> Add</button>
          )}
        </div>
        <div className="subject-list">
          {subjects.map((s) => (
            <div key={s} className="subject-tag" draggable onDragStart={() => setDraggedSubject(s)}>{s}</div>
          ))}
        </div>
      </div>

      <div
        className={`team-area ${draggedTeacher ? "drag-active" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropTeacherOnClass}
      >
        <div className="card-header">
          <h3><Users size={16} /> Class Team</h3>
          {mode === "admin" && <p className="hint">Drop teacher(s) here</p>}
        </div>

        <div className="team-grid">
          {filteredTeam.map((t) => (
            <div key={t.userId} className="team-card" onDragOver={(e) => e.preventDefault()} onDrop={() => handleDropSubjectOnTeacher(t.userId)}>
              <div className="team-top">
                <div className="avatar">{t.name?.[0]}</div>
                <div className="meta"><div className="name">{t.name}</div></div>
                {mode === "admin" && <button className="remove-btn" onClick={() => handleRemoveTeacher(t.userId)}><X size={14} /></button>}
              </div>
              <div className="team-subjects">
                {t.subjects?.map((sub) => <span key={sub} className="subject-pill">{sub}</span>) || <i>No subjects</i>}
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog {...confirmState} />
      {loading && <div className="saving-banner">Updating Team...</div>}
    </div>
  );
}
