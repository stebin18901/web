import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  CheckCircle,
  XCircle,
  ClipboardList,
  Users,
} from "lucide-react";
import "./ViewSubmissions.css";

export default function ViewSubmissions({ teacher }) {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [students, setStudents] = useState([]);
  const [submissionsMap, setSubmissionsMap] = useState({});

  const schoolId = teacher?.schoolId?.trim()?.toLowerCase();

  // ---------------------------------------------------------
  // 1️⃣ LOAD ASSIGNMENTS CREATED BY TEACHER
  // ---------------------------------------------------------
  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, "assignments"));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      setAssignments(data.filter((a) => a.assignedClasses?.length));
    }
    load();
  }, []);

  // ---------------------------------------------------------
  // 2️⃣ LOAD STUDENTS + SUBMISSIONS FOR SELECTED ASSIGNMENT
  // ---------------------------------------------------------
  async function loadStudentsForAssignment(a) {
    setSelected(a);

    if (!schoolId) {
      console.warn("Teacher schoolId missing");
      return;
    }

    const targetClasses = Array.isArray(a.assignedClasses)
      ? a.assignedClasses
      : [];

    if (targetClasses.length === 0) {
      setStudents([]);
      return;
    }

    // Load all students for each class
    let loadedStudents = [];

    for (const cls of targetClasses) {
      const q = query(
        collection(db, "studentAccounts"),
        where("schoolId", "==", schoolId),
        where("className", "==", cls)
      );

      const snap = await getDocs(q);
      snap.forEach((doc) => {
        const d = doc.data();
        loadedStudents.push({
          id: doc.id,
          name: d.fullName,
          roll: d.rollNumber,
          className: d.className,
        });
      });
    }

    setStudents(loadedStudents);

    // ---------------------------------------------------------
    // 🔥 LOAD SUBMISSIONS FOR THIS ASSIGNMENT
    // ---------------------------------------------------------
    const q2 = query(
      collection(db, "submissions"),
      where("assignmentId", "==", a.id)
    );

    const snap2 = await getDocs(q2);
    const map = {};

    snap2.forEach((doc) => {
      const d = doc.data();
      map[d.studentId] = {
        score: d.score ?? null,
        totalMarks: d.totalMarks ?? null,
        percentage: d.percentage ?? null,
        submittedAt: d.submittedAt,
      };
    });

    setSubmissionsMap(map);
  }

  return (
    <div className="view-submissions">

      {/* ---------------- TITLE ---------------- */}
      <header className="vs-header">
        <ClipboardList size={20} />
        <h3>Assignment Submissions</h3>
      </header>

      {/* ---------------- ASSIGNMENT BUTTONS ---------------- */}
      <div className="vs-assignment-row">
        {assignments.map((a) => (
          <button
            key={a.id}
            className={`vs-assignment-btn ${
              selected?.id === a.id ? "active" : ""
            }`}
            onClick={() => loadStudentsForAssignment(a)}
          >
            {a.title}
          </button>
        ))}
      </div>

      {/* ---------------- STUDENT STATUS LIST ---------------- */}
      {selected && (
        <div className="vs-students-box">
          <div className="vs-students-header">
            <Users size={18} />
            <h4>{selected.assignedClasses.join(", ")} — Students</h4>
          </div>

          {!students.length && (
            <p className="vs-empty">No students found for this assignment.</p>
          )}

          {students.map((s) => {
            const sub = submissionsMap[s.id];
            const submitted = !!sub;

            return (
              <div key={s.id} className="vs-student-row">
                <div className="vs-student-info">
                  <h5>{s.name}</h5>
                  <small>
                    Class: {s.className} | Roll: {s.roll}
                  </small>
                </div>

                <div className="vs-status">
                  {submitted ? (
                    <div className="vs-score-box">
                      <CheckCircle size={22} color="green" />

                      {/* SCORE */}
                      {sub?.score !== null ? (
                        <span className="vs-score">
                          {sub.score}/{sub.totalMarks}{" "}
                          <span className="vs-percent">
                            ({sub.percentage}%)
                          </span>
                        </span>
                      ) : (
                        <span className="vs-pending-score">
                          Submitted — Awaiting evaluation
                        </span>
                      )}
                    </div>
                  ) : (
                    <XCircle size={22} color="red" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
