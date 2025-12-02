import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";
import "./TeacherSubjects.css"

/**
 * TeacherSubjects Component
 * - Shows all subjects assigned to the teacher
 * - Allows filtering by class
 * - Displays student counts (optional if available)
 */
const TeacherSubjects = () => {
  const { teacher } = useTeacherAuth();
  const [subjects, setSubjects] = useState([]);
  const [selectedClass, setSelectedClass] = useState("all");
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);

  // 🧠 Load subjects for teacher
  useEffect(() => {
    if (!teacher?.email || !teacher?.schoolId) return;

    const q = query(
      collection(db, "classes"),
      where("schoolId", "==", teacher.schoolId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const classList = [];
      const subs = [];

      snap.docs.forEach((doc) => {
        const data = doc.data();
        const team = data.team || [];

        team.forEach((t) => {
          if (t.email === teacher.email) {
            subs.push({
              className: data.className,
              grade: data.grade,
              division: data.division,
              subjects: t.subjects || [],
              totalStudents: data.totalStudents || 0,
            });

            classList.push({
              className: data.className,
              label: `Grade ${data.grade}${data.division}`,
            });
          }
        });
      });

      setClasses(classList);
      setSubjects(subs);
      setLoading(false);
    });

    return () => unsub();
  }, [teacher]);

  if (loading) return <Loader text="Loading your subjects..." />;

  // 🔍 Filter subjects by class
  const filteredSubjects =
    selectedClass === "all"
      ? subjects
      : subjects.filter((s) => s.className === selectedClass);

  return (
    <div className="teacher-subjects-container">
      <header className="subject-header">
        <h2>📘 My Subjects</h2>
        <p>View all classes and subjects assigned to you.</p>
      </header>

      <div className="filter-bar">
        <label>Filter:</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="all">All Classes</option>
          {classes.map((cls) => (
            <option key={cls.className} value={cls.className}>
              {cls.label}
            </option>
          ))}
        </select>
      </div>

      {filteredSubjects.length === 0 ? (
        <div className="no-subjects">
          <p>No subjects assigned yet.</p>
        </div>
      ) : (
        <div className="subject-grid">
          {filteredSubjects.map((s, i) => (
            <div key={i} className="subject-card">
              <h3>{s.className}</h3>
              <p>
                <strong>Grade:</strong> {s.grade} &nbsp;
                <strong>Div:</strong> {s.division}
              </p>

              <ul className="subject-list">
                {s.subjects.map((sub, idx) => (
                  <li key={idx}>{sub}</li>
                ))}
              </ul>

              <p className="student-count">
                👩‍🎓 {s.totalStudents || "N/A"} students
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherSubjects;
