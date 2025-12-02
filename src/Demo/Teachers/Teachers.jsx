import React, { useState } from "react";
import { teachers as initial } from "../data/dummyData";

export default function Teachers() {
  const [teachers, setTeachers] = useState(initial);
  const [classes, setClasses] = useState([
    { id: 1, name: "6A", classTeacher: null },
    { id: 2, name: "6B", classTeacher: null },
  ]);

  const [newClass, setNewClass] = useState("");
  const [tName, setTName] = useState("");
  const [subject, setSubject] = useState("");

  function addTeacher() {
    if (!tName || !subject) return alert("Enter teacher name & subject");
    const id = Math.max(0, ...teachers.map((t) => t.id)) + 1;
    setTeachers([
      ...teachers,
      { id, name: tName, subject, assignedClass: "Unassigned" },
    ]);
    setTName("");
    setSubject("");
  }

  function addClass() {
    if (!newClass) return alert("Enter class/division name");
    const id = Math.max(0, ...classes.map((c) => c.id)) + 1;
    setClasses([...classes, { id, name: newClass, classTeacher: null }]);
    setNewClass("");
  }

  function onDragStart(e, teacherId) {
    e.dataTransfer.setData("teacherId", teacherId);
  }

  function onDrop(e, classId) {
    const teacherId = e.dataTransfer.getData("teacherId");
    const teacher = teachers.find((t) => t.id === Number(teacherId));
    if (!teacher) return;

    // Update classes and teachers
    setClasses((prev) =>
      prev.map((c) =>
        c.id === classId ? { ...c, classTeacher: teacher.name } : c
      )
    );
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === Number(teacherId)
          ? { ...t, assignedClass: classes.find((c) => c.id === classId)?.name }
          : t
      )
    );
  }

  const styles = {
    container: {
      display: "flex",
      gap: "20px",
      padding: "20px",
      fontFamily: "system-ui, sans-serif",
      flexWrap: "wrap",
    },
    left: {
      flex: "1 1 50%",
      background: "#f9fafb",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
    },
    right: {
      flex: "1 1 45%",
      background: "#f9fafb",
      borderRadius: "12px",
      padding: "20px",
      boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
      maxHeight: "80vh",
      overflowY: "auto",
    },
    title: { marginBottom: "10px" },
    classCard: {
      background: "white",
      borderRadius: "10px",
      padding: "16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      marginBottom: "10px",
      transition: "transform 0.2s",
    },
    teacherCard: {
      background: "white",
      borderRadius: "10px",
      padding: "12px 14px",
      marginBottom: "10px",
      boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
      cursor: "grab",
    },
    form: { display: "flex", gap: "10px", marginBottom: "15px", flexWrap: "wrap" },
    input: {
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: "6px",
      fontSize: "0.95rem",
      flex: "1 1 160px",
    },
    btn: {
      background: "linear-gradient(90deg,#2563eb,#3b82f6)",
      color: "white",
      border: "none",
      padding: "9px 16px",
      borderRadius: "6px",
      cursor: "pointer",
      fontWeight: 500,
      transition: "0.2s",
    },
    teacherAssigned: {
      background: "#ecfdf5",
      color: "#065f46",
      fontSize: "0.85rem",
      padding: "4px 10px",
      borderRadius: "20px",
      display: "inline-block",
      marginTop: "6px",
    },
    teacherUnassigned: {
      background: "#fee2e2",
      color: "#991b1b",
      fontSize: "0.85rem",
      padding: "4px 10px",
      borderRadius: "20px",
      display: "inline-block",
      marginTop: "6px",
    },
  };

  return (
    <div style={styles.container}>
      {/* LEFT - CLASSES */}
      <div style={styles.left}>
        <h2 style={styles.title}>🏫 Classes & Divisions</h2>
        <div style={styles.form}>
          <input
            style={styles.input}
            placeholder="Enter class/division"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
          />
          <button style={styles.btn} onClick={addClass}>
            ➕ Add Class
          </button>
        </div>

        {classes.map((cls) => (
          <div
            key={cls.id}
            style={styles.classCard}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, cls.id)}
          >
            <h4 style={{ margin: "0 0 6px" }}>{cls.name}</h4>
            <p style={{ margin: "0", color: "#6b7280", fontSize: "0.9rem" }}>
              Class Teacher:{" "}
              {cls.classTeacher ? (
                <strong>{cls.classTeacher}</strong>
              ) : (
                <span style={{ color: "#9ca3af" }}>Unassigned</span>
              )}
            </p>
          </div>
        ))}
      </div>

      {/* RIGHT - TEACHERS */}
      <div style={styles.right}>
        <h2 style={styles.title}>👩‍🏫 Teachers</h2>
        <div style={styles.form}>
          <input
            style={styles.input}
            placeholder="Name"
            value={tName}
            onChange={(e) => setTName(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <button style={styles.btn} onClick={addTeacher}>
            ➕ Add Teacher
          </button>
        </div>

        {teachers.map((t) => (
          <div
            key={t.id}
            draggable
            onDragStart={(e) => onDragStart(e, t.id)}
            style={styles.teacherCard}
          >
            <h4 style={{ margin: "0 0 4px" }}>{t.name}</h4>
            <p style={{ margin: "0", color: "#4b5563", fontSize: "0.9rem" }}>
              {t.subject}
            </p>
            <span
              style={
                t.assignedClass !== "Unassigned"
                  ? styles.teacherAssigned
                  : styles.teacherUnassigned
              }
            >
              {t.assignedClass !== "Unassigned"
                ? `Assigned: ${t.assignedClass}`
                : "Unassigned"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
