import React, { useEffect, useState, useRef } from "react";
import {
  doc,
  collection,
  onSnapshot,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../../../firebase/firebaseConfig";
import {
  Plus,
  Trash2,
  X,
  Loader2,
  UserPlus,
  BookOpen,
  Users,
  ListOrdered,
} from "lucide-react";
import "./ClassDetailView.css";

const DEFAULT_SUBJECTS = [
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Computer Science",
  "Hindi",
  "Malayalam",
];

const ConfirmDialog = ({ open, message, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <div className="confirm-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="confirm-yes" onClick={onConfirm}>
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};

export default function ClassDetailView({
  className,
  schoolId,
  teachers = [],
  draggedTeacher,
  setDraggedTeacher,
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
  const subjectInputRef = useRef(null);

  /* 🔹 Listen for Class Data */
  useEffect(() => {
    if (!className || !schoolId) return;
    const ref = doc(db, "classes", `${schoolId}_${className}`);
    const unsub = onSnapshot(ref, (snap) => {
      setClassData(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [className, schoolId]);

  // 🔹 Listen to Roll Setup + Students
useEffect(() => {
  if (!className || !schoolId) return;
  const classId = `${schoolId}_${className}`;
  const rollRef = doc(db, "classes", classId, "meta", "rollSetup");
  const studentsRef = collection(db, "classes", classId, "students");

  const unsubRoll = onSnapshot(rollRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data?.studentCount !== undefined)
        setStudentCount(data.studentCount);
    }
  });

  const unsubStudents = onSnapshot(studentsRef, (snap) => {
    // Fallback if roll setup missing
    if (snap.size > 0) setStudentCount(snap.size);
  });

  return () => {
    unsubRoll();
    unsubStudents();
  };
}, [className, schoolId]);


  // ===================================================
  // FUNCTIONS
  // ===================================================
  const upsertTeacherToClass = async (teacher, subjectsToAdd = []) => {
    if (mode !== "admin" || !teacher) return;
    setLoading(true);
    try {
      const ref = doc(db, "classes", `${schoolId}_${className}`);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      const team = Array.isArray(data.team) ? [...data.team] : [];
      const idx = team.findIndex((t) => t.userId === teacher.id);
      if (idx === -1) {
        team.push({
          userId: teacher.id,
          name: teacher.name,
          email: teacher.email,
          subjects: subjectsToAdd,
        });
      } else {
        const existing = new Set(team[idx].subjects || []);
        subjectsToAdd.forEach((s) => existing.add(s));
        team[idx].subjects = [...existing];
      }
      await updateDoc(ref, { team, updatedAt: new Date() });
    } finally {
      setLoading(false);
    }
  };

  const handleDropTeacherOnClass = (e) => {
    e.preventDefault();
    if (mode !== "admin" || !draggedTeacher) return;
    upsertTeacherToClass(draggedTeacher, []);
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
      const teacherObj = teachers.find((tt) => tt.id === teacherId);
      if (!teacherObj) return;

      if (idx === -1) {
        team.push({
          userId: teacherObj.id,
          name: teacherObj.name,
          email: teacherObj.email,
          subjects: [draggedSubject],
        });
      } else {
        const updatedSubs = new Set(team[idx].subjects || []);
        updatedSubs.add(draggedSubject);
        team[idx].subjects = [...updatedSubs];
      }
      await updateDoc(ref, { team });
    } finally {
      setDraggedSubject(null);
      setLoading(false);
    }
  };

  const handleAddSubject = () => {
    const sub = prompt("Enter new subject:")?.trim();
    if (sub && !subjects.includes(sub)) setSubjects([...subjects, sub]);
  };

  const handleRemoveTeacher = (teacherId) => {
    if (mode !== "admin") return;
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
    });
  };

  const filteredTeam =
    mode === "teacher"
      ? (classData?.team || []).filter(
          (t) =>
            t.email === teacher?.email ||
            t.email === classData?.classTeacherEmail
        )
      : classData?.team || [];

  const filteredSubjects =
    mode === "teacher"
      ? [
          ...new Set(
            filteredTeam.flatMap((t) =>
              t.email === teacher?.email ? t.subjects || [] : []
            )
          ),
        ]
      : subjects;

  if (!classData)
    return (
      <div className="class-detail-container">
        <Loader2 className="spin" /> Loading class details...
      </div>
    );

  return (
    <div className="class-detail-container">
      <div className="detail-header">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
        )}
        <h2>
          <BookOpen size={20} /> {classData.className}
        </h2>
      </div>

      {/* ======= CLASS INFO ======= */}
      <div className="info-card">
        <p><strong>Grade:</strong> {classData.grade}</p>
        <p><strong>Division:</strong> {classData.division}</p>
        <p><strong>Class Teacher:</strong> {classData.classTeacherName || "—"}</p>
        <p>
          <strong><ListOrdered size={14} /> Total Students:</strong>{" "}
          {studentCount === null ? "Loading..." : studentCount}
        </p>
      </div>

      {/* ======= SUBJECTS ======= */}
      <div className="subjects-card">
        <div className="card-header">
          <h3><BookOpen size={16} /> Subjects</h3>
          {mode === "admin" && (
            <button onClick={handleAddSubject} className="add-btn">
              <Plus size={14} /> Add
            </button>
          )}
        </div>
        <div className="subject-list">
          {filteredSubjects.map((s) => (
            <div
              key={s}
              className="subject-tag"
              draggable={mode === "admin"}
              onDragStart={() => setDraggedSubject(s)}
              onDragEnd={() => setDraggedSubject(null)}
            >
              {s}
              {mode === "admin" && !DEFAULT_SUBJECTS.includes(s) && (
                <button
                  className="del-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSubjects(subjects.filter((x) => x !== s));
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ======= CLASS TEAM ======= */}
      <div
        className={`team-area ${draggedTeacher ? "drag-active" : ""}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropTeacherOnClass}
      >
        <div className="card-header">
          <h3><Users size={16} /> Class Team</h3>
          {mode === "admin" && <p className="hint">Drag a teacher here</p>}
        </div>

        {filteredTeam.length === 0 ? (
          <div className="empty-team">
            <UserPlus size={18} /> No teachers assigned yet
          </div>
        ) : (
          <div className="team-grid">
            {filteredTeam.map((t) => (
              <div
                key={t.userId}
                className="team-card"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDropSubjectOnTeacher(t.userId)}
              >
                <div className="team-top">
                  <div className="avatar">{t.name?.[0]}</div>
                  <div className="meta">
                    <div className="name">{t.name}</div>
                    <div className="email">{t.email}</div>
                  </div>
                  {mode === "admin" && (
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveTeacher(t.userId)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="team-subjects">
                  {(t.subjects || []).length > 0 ? (
                    t.subjects.map((sub) => (
                      <span key={sub} className="subject-pill">
                        {sub}
                      </span>
                    ))
                  ) : (
                    <span className="no-subjects"><i>Drag subjects here</i></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog {...confirmState} />
      {loading && <div className="saving-banner">Saving...</div>}
    </div>
  );
}
