import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import Loader from "../Shared/Loader";

const StudentPerformanceTracker = ({ classData, schoolId }) => {
  const [students, setStudents] = useState([]);
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // ✅ Fetch students in class
  useEffect(() => {
    const fetchStudents = async () => {
      if (!schoolId || !classData?.className) return;
      const q = query(
        collection(db, "students"),
        where("schoolId", "==", schoolId),
        where("className", "==", classData.className)
      );
      const snap = await getDocs(q);
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    fetchStudents();
  }, [schoolId, classData]);

  // ✅ Fetch performance data
  useEffect(() => {
    const fetchPerformance = async () => {
      if (!schoolId || !classData?.className) return;
      const q = query(
        collection(db, "results"),
        where("schoolId", "==", schoolId),
        where("className", "==", classData.className),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      setPerformance(snap.docs.map((d) => d.data()));
      setLoading(false);
    };

    fetchPerformance();
  }, [schoolId, classData]);

  // ✅ Calculate stats for each student
  const calculateStudentStats = (studentId) => {
    const studentResults = performance.filter((p) => p.studentId === studentId);
    if (studentResults.length === 0) return { avg: 0, attempts: 0 };
    const total = studentResults.reduce((sum, r) => sum + (r.score || 0), 0);
    const avg = total / studentResults.length;
    return { avg: Math.round(avg), attempts: studentResults.length };
  };

  // ✅ Class-wide stats
  const classAverage =
    performance.length > 0
      ? Math.round(
          performance.reduce((sum, r) => sum + (r.score || 0), 0) /
            performance.length
        )
      : 0;

  if (loading) return <Loader text="Loading performance..." />;

  return (
    <div className="performance-container">
      <div className="performance-header">
        <h3>Performance Tracker - {classData.className}</h3>
        <p>Class Average: {classAverage}%</p>
      </div>

      <div className="performance-grid">
        {students.length === 0 ? (
          <p>No students found.</p>
        ) : (
          students.map((s) => {
            const stats = calculateStudentStats(s.id);
            return (
              <div
                key={s.id}
                className={`student-card ${
                  selectedStudent?.id === s.id ? "active" : ""
                }`}
                onClick={() => setSelectedStudent(s)}
              >
                <div className="student-name">{s.name}</div>
                <div className="student-meta">
                  Avg: {stats.avg}% | Tests: {stats.attempts}
                </div>
              </div>
            );
          })
        )}
      </div>

      {selectedStudent && (
        <div className="student-detail">
          <h4>{selectedStudent.name} - Detailed Performance</h4>
          <div className="performance-table">
            <div className="row header">
              <span>Quiz</span>
              <span>Subject</span>
              <span>Score</span>
              <span>Date</span>
            </div>
            {performance
              .filter((p) => p.studentId === selectedStudent.id)
              .map((r, i) => (
                <div className="row" key={i}>
                  <span>{r.quizTitle}</span>
                  <span>{r.subject}</span>
                  <span>{r.score}%</span>
                  <span>
                    {r.createdAt?.toDate
                      ? r.createdAt.toDate().toLocaleDateString()
                      : ""}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentPerformanceTracker;
