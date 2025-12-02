import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import "./StudentProfile.css";

const safe = (v) =>
  v === null || v === undefined || v === "" || typeof v === "object"
    ? "N/A"
    : v;

export default function StudentProfile() {
  const { id } = useParams();
  const [student, setStudent] = useState(null);
  const [classInfo, setClassInfo] = useState({});
  const [submissions, setSubmissions] = useState([]);
  const [quizReports, setQuizReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);

      try {
        // Student Account
        const snap = await getDoc(doc(db, "studentAccounts", id));
        if (!snap.exists()) {
          setStudent(null);
          return;
        }

        const data = snap.data();
        setStudent({
          id: snap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.().toLocaleString() || "N/A",
        });

        const schoolId = (data.schoolId || "").toLowerCase();
        const classId = `${schoolId}_${data.className}`;

        // Class Extra Info
        const classSnap = await getDoc(
          doc(db, "classes", classId, "students", String(data.rollNumber))
        );
        classSnap.exists()
          ? setClassInfo(classSnap.data())
          : setClassInfo({});

        // Assignment Submissions
        const subQ = query(
          collection(db, "submissions"),
          where("studentId", "==", id)
        );
        const subSnap = await getDocs(subQ);
        const subs = subSnap.docs.map((d) => d.data());

        subs.sort(
          (a, b) =>
            (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0)
        );
        setSubmissions(subs);

        // Quiz Reports
        const repSnap = await getDocs(collection(db, "reports"));
        const reports = [];
        repSnap.forEach((d) => {
          const r = d.data();
          if (r.userId === id) reports.push(r);
        });

        reports.sort(
          (a, b) =>
            (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
        );
        setQuizReports(reports);
      } catch (err) {
        console.error("Profile load error:", err);
      }

      setLoading(false);
    }

    loadData();
  }, [id]);

  if (loading) return <p className="gp-loading">Loading profile...</p>;
  if (!student) return <p className="gp-loading">Student not found</p>;

  // Derived
  const quizCount = quizReports.length;
  const quizAvg =
    quizCount > 0
      ? (
          quizReports.reduce((sum, q) => sum + (q.percentage || 0), 0) /
          quizCount
        ).toFixed(1)
      : "N/A";

  const level =
    quizAvg === "N/A"
      ? "N/A"
      : quizAvg < 40
      ? "Weak"
      : quizAvg < 70
      ? "Average"
      : "Strong";

  const submissionsCount = submissions.length;

  return (
    <div className="gp-container">
      {/* HEADER ----------------------- */}
      <div className="gp-banner">
        <div className="gp-left">
          <div className="gp-player-card">
            <div className="gp-overall">{quizAvg !== "N/A" ? quizAvg : "--"}</div>
            <div className="gp-name">{safe(student.fullName)}</div>
            <div className="gp-class">Class {safe(student.className)}</div>
          </div>
        </div>

        <div className="gp-right">
          <h2 className="gp-title">PROFILE</h2>
        </div>
      </div>

      {/* PERSONAL INFO ----------------------- */}
      <div className="gp-card">
        <h3 className="gp-section-title">📌 PERSONAL INFO</h3>

        <div className="gp-row"><span>Full Name</span><b>{safe(student.fullName)}</b></div>
        <div className="gp-row"><span>Email</span><b>{safe(student.email)}</b></div>
        <div className="gp-row"><span>School ID</span><b>{safe(student.schoolId)}</b></div>
        <div className="gp-row"><span>Class</span><b>{safe(student.className)}</b></div>
        <div className="gp-row"><span>Roll No</span><b>{safe(student.rollNumber)}</b></div>
        <div className="gp-row"><span>Account Created</span><b>{safe(student.createdAt)}</b></div>
      </div>

      {/* PLAYER STATS ----------------------- */}
      <div className="gp-card gp-stats-card">
        <h3 className="gp-section-title">🎮 PLAYER STATS</h3>

        <div className="gp-stat">
          <span>Assignments Completed</span>
          <div className="gp-bar">
            <div style={{ width: submissionsCount * 10 + "%" }} className="gp-bar-fill"></div>
          </div>
          <b>{submissionsCount}</b>
        </div>

        <div className="gp-stat">
          <span>Average Quiz %</span>
          <div className="gp-bar">
            <div style={{ width: quizAvg + "%" }} className="gp-bar-fill"></div>
          </div>
          <b>{quizAvg}</b>
        </div>

        <div className={`gp-level gp-${level.toLowerCase()}`}>
          LEVEL: {level}
        </div>
      </div>

      {/* CLASS INFO -------------------------- */}
      <div className="gp-card">
        <h3 className="gp-section-title">🏫 CLASS PERFORMANCE</h3>

        <div className="gp-row"><span>Attendance</span><b>{safe(classInfo.attendance)}%</b></div>
        <div className="gp-row"><span>Behavior</span><b>{safe(classInfo.behavior)}</b></div>
        <div className="gp-row"><span>Avg Class Score</span><b>{safe(classInfo.averageScore)}</b></div>
      </div>
    </div>
  );
}
