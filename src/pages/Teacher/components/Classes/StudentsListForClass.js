import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import Loader from "../Shared/Loader";
import ConfirmDialog from "../Shared/ConfirmDialog";

const StudentsListForClass = ({ classData, schoolId, teacher }) => {
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    message: "",
    onConfirm: null,
  });

  // ✅ Fetch students like admin does
  useEffect(() => {
    const fetchStudents = async () => {
      if (!schoolId || !classData?.className) return;
      try {
        setLoading(true);
        const normalizedId = schoolId.trim().toLowerCase();

        // 🔹 Step 1: Get students of this class
        const q = query(
          collection(db, "studentAccounts"),
          where("schoolId", "==", normalizedId),
          where("className", "==", classData.className)
        );

        const snap = await getDocs(q);
        const accounts = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          name: doc.data().fullName,
        }));

        // 🔹 Step 2: Get extra data from subcollection (same as admin)
        const enriched = [];
        for (const s of accounts) {
          const classId = `${normalizedId}_${s.className}`;
          const ref = doc(
            db,
            "classes",
            classId,
            "students",
            s.rollNumber?.toString() || ""
          );
          const snapExtra = await getDoc(ref);
          const extra = snapExtra.exists() ? snapExtra.data() : {};

          enriched.push({
            ...s,
            attendance: extra.attendance || 0,
            averageScore: extra.averageScore || 0,
            rollNo: s.rollNumber || "--",
            behavior: extra.behavior || "N/A",
          });
        }

        setStudents(enriched);
      } catch (err) {
        console.error("Student fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [schoolId, classData]);

  const filtered = students.filter(
    (s) =>
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNo?.toString().includes(search)
  );

  // 🔹 Promote Action
  const handlePromote = (student) => {
    setConfirmDialog({
      open: true,
      message: `Promote ${student.name} to next class?`,
      onConfirm: async () => {
        try {
          const ref = doc(db, "studentAccounts", student.id);
          await updateDoc(ref, {
            status: "promoted",
            updatedAt: new Date(),
          });
          setConfirmDialog({ open: false, message: "", onConfirm: null });
        } catch (err) {
          console.error("Error promoting student:", err);
        }
      },
    });
  };

  if (loading) return <Loader text="Loading students..." />;

  return (
    <div className="students-list-container">
      <div className="students-header">
        <h3>
          Students ({students.length}) — {classData?.className}
        </h3>
        <input
          type="text"
          placeholder="Search by name or roll no."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="empty-text">No students found.</p>
      ) : (
        <div className="students-grid">
          {filtered.map((s) => (
            <div
              key={s.id}
              className={`student-card ${
                selectedStudent?.id === s.id ? "active" : ""
              }`}
              onClick={() =>
                setSelectedStudent((prev) => (prev?.id === s.id ? null : s))
              }
            >
              <div className="student-avatar">
                {s.name?.charAt(0)?.toUpperCase() || "S"}
              </div>
              <div className="student-info">
                <h4>{s.name}</h4>
                <p>Roll: {s.rollNo}</p>
                <p>Attendance: {s.attendance}%</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="student-detail-view glass-card">
          <h4>Student Details</h4>
          <div className="detail-card">
            <p><strong>Name:</strong> {selectedStudent.name}</p>
            <p><strong>Roll No:</strong> {selectedStudent.rollNo}</p>
            <p><strong>Email:</strong> {selectedStudent.email}</p>
            <p><strong>Behavior:</strong> {selectedStudent.behavior}</p>
            <p><strong>Attendance:</strong> {selectedStudent.attendance}%</p>
            <p>
              <strong>Status:</strong>{" "}
              {selectedStudent.status || "Active"}
            </p>
          </div>
          <div className="detail-actions">
            <button
              className="btn-primary"
              onClick={() => handlePromote(selectedStudent)}
            >
              Promote
            </button>
            <button onClick={() => setSelectedStudent(null)}>Close</button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() =>
          setConfirmDialog({ open: false, message: "", onConfirm: null })
        }
      />
    </div>
  );
};

export default StudentsListForClass;
