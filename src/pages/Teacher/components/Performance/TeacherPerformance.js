import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";
import { BarChart3 } from "lucide-react";

/**
 * TeacherPerformance Component
 * - Displays analytics on students’ performance per class & subject
 * - Class teacher → shows full class overview
 * - Subject teacher → shows only their subject(s)
 */
const TeacherPerformance = () => {
  const { teacher } = useTeacherAuth();
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState("all");

  const isClassTeacher = teacher?.role === "class_teacher";

  // 🔹 Realtime performance data from Firestore
  useEffect(() => {
    if (!teacher?.schoolId) return;

    const q = query(
      collection(db, "performance"),
      where("schoolId", "==", teacher.schoolId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => d.data());

      // Filter based on role
      const filtered = isClassTeacher
        ? data.filter((p) => p.classTeacherEmail === teacher.email)
        : data.filter(
            (p) =>
              p.subjectTeacherEmail === teacher.email ||
              (p.teachers || []).some((t) => t.email === teacher.email)
          );

      setPerformance(filtered);
      setLoading(false);
    });

    return () => unsub();
  }, [teacher, isClassTeacher]);

  // 🔍 Extract class list for filter
  const classes = Array.from(new Set(performance.map((p) => p.className)));

  const filteredPerformance =
    selectedClass === "all"
      ? performance
      : performance.filter((p) => p.className === selectedClass);

  if (loading) return <Loader text="Loading performance data..." />;

  return (
    <div className="teacher-performance-container">
      <header className="performance-header">
        <h2 className="gradient-text">Performance Overview</h2>
        <p>
          {isClassTeacher
            ? "Your class performance and subject averages."
            : "Subject-wise student performance metrics."}
        </p>
      </header>

      {/* Filter by class */}
      <div className="filter-bar">
        <label>Class:</label>
        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
        >
          <option value="all">All</option>
          {classes.map((cls) => (
            <option key={cls} value={cls}>
              {cls}
            </option>
          ))}
        </select>
      </div>

      {/* No Data */}
      {filteredPerformance.length === 0 ? (
        <div className="no-performance">
          <BarChart3 size={48} />
          <p>No performance data found yet.</p>
        </div>
      ) : (
        <div className="performance-grid">
          {filteredPerformance.map((p, i) => (
            <div key={i} className="performance-card glass-card">
              <h3>{p.className}</h3>
              <p>
                <strong>Subject:</strong> {p.subject}
              </p>
              <p>
                <strong>Average Score:</strong> {p.average?.toFixed(1) || "N/A"}
              </p>
              <p>
                <strong>Top Performer:</strong>{" "}
                {p.topStudent || "Not available"}
              </p>

              <div className="bar">
                <div
                  className="fill"
                  style={{
                    width: `${Math.min(p.average || 0, 100)}%`,
                  }}
                ></div>
              </div>

              <div className="meta">
                <span>
                  Students: <strong>{p.totalStudents || "N/A"}</strong>
                </span>
                <span>
                  Exams Count: <strong>{p.examCount || "N/A"}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherPerformance;
