import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import "./TeacherStudentManager.css";

const TeacherStudentManager = ({ teacher }) => {
  const [students, setStudents] = useState([]);
  const [newStudent, setNewStudent] = useState({ name: "", studentId: "", password: "" });
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const schoolId = teacher?.schoolId?.trim().toLowerCase() || "";
  const assignedClass = teacher?.assignedClass?.trim() || "";

  // 🧭 Fetch students whenever switched class changes
  useEffect(() => {
    if (schoolId && assignedClass) fetchStudents();
  }, [schoolId, assignedClass]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const normalizedId = schoolId.trim().toLowerCase();
      const classId = `${normalizedId}_${assignedClass}`;
      const studentsRef = collection(db, "classes", classId, "students");
      const studentAccRef = collection(db, "studentAccounts");

      const [studentsSnap, accountsSnap] = await Promise.all([
        getDocs(studentsRef),
        getDocs(studentAccRef),
      ]);

      const classStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const accounts = accountsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Merge by rollNumber/studentId
      const merged = accounts
        .filter(
          (s) =>
            s.schoolId?.trim().toLowerCase() === normalizedId &&
            s.className === assignedClass
        )
        .map((s) => {
          const match = classStudents.find(
            (c) =>
              c.studentId?.toString().trim() === s.rollNumber?.toString().trim()
          );
          return {
            ...s,
            attendance: match?.attendance || 0,
            averageScore: match?.averageScore || 0,
            behavior: match?.behavior || "N/A",
          };
        });

      setStudents(merged);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoading(false);
    }
  };

  // 🧾 Add / Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newStudent.name || !newStudent.studentId || !newStudent.password)
      return alert("All fields required");

    try {
      setLoading(true);
      const normalizedId = schoolId.trim().toLowerCase();
      const classId = `${normalizedId}_${assignedClass}`;
      const roll = newStudent.studentId.trim();

      // Fetch school's plan config
      const schoolSnap = await getDoc(doc(db, "schools", normalizedId));
      const schoolData = schoolSnap.exists() ? schoolSnap.data() : {};
      const selectedPlanId = schoolData.selectedPlanId || "";
      const selectedPlanName = schoolData.selectedPlanName || "";
      const planAmount = Number(schoolData.planAmount || 0);

      const accountData = {
        fullName: newStudent.name.trim(),
        rollNumber: roll,
        className: assignedClass,
        schoolId: normalizedId,
        password: newStudent.password,
        email: `${roll}@${normalizedId}.edu`,
        role: "student",
        updatedAt: new Date().toISOString(),
        selectedPlanId,
        selectedPlanName,
        planAmount,
        paymentStatus: planAmount ? "pending" : "none",
        registrationStatus: planAmount ? "pending_payment" : "free",
        isPaid: false,
      };

      const accRef = doc(db, "studentAccounts", roll);
      const classRef = doc(db, "classes", classId, "students", roll);

      if (editId) {
        await updateDoc(accRef, accountData);
        await updateDoc(classRef, {
          name: newStudent.name.trim(),
          studentId: roll,
          password: newStudent.password,
        });
        alert("✅ Student updated");
      } else {
        await setDoc(accRef, accountData);
        await setDoc(classRef, {
          name: newStudent.name.trim(),
          studentId: roll,
          password: newStudent.password,
          attendance: 0,
          averageScore: 0,
          behavior: "New",
          createdAt: new Date().toISOString(),
        });
        alert("✅ Student added");
      }

      setNewStudent({ name: "", studentId: "", password: "" });
      setEditId(null);
      fetchStudents();
    } catch (err) {
      console.error(err);
      alert("Error saving student");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student) => {
    setNewStudent({
      name: student.fullName || student.name,
      studentId: student.rollNumber || student.studentId,
      password: student.password || "",
    });
    setEditId(student.id);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this student?")) return;
    try {
      const normalizedId = schoolId.trim().toLowerCase();
      const classId = `${normalizedId}_${assignedClass}`;
      await deleteDoc(doc(db, "studentAccounts", id));
      await deleteDoc(doc(db, "classes", classId, "students", id));
      alert("🗑️ Student deleted");
      fetchStudents();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber?.toString().toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="student-manager">
      <h2>Manage Students — {assignedClass || "No Class Selected"}</h2>

      {/* === Add/Edit Form === */}
      <form onSubmit={handleSubmit} className="student-form">
        <input
          type="text"
          placeholder="Student Name"
          value={newStudent.name}
          onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Student Roll / ID"
          value={newStudent.studentId}
          onChange={(e) =>
            setNewStudent({ ...newStudent, studentId: e.target.value })
          }
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={newStudent.password}
          onChange={(e) =>
            setNewStudent({ ...newStudent, password: e.target.value })
          }
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : editId ? "Update Student" : "Add Student"}
        </button>
      </form>

      {/* === Search === */}
      <div className="search-bar">
        <input
          type="text"
          placeholder="Search students..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* === Table === */}
      <div className="student-list">
        {loading ? (
          <p>Loading...</p>
        ) : filtered.length === 0 ? (
          <p>No students found.</p>
        ) : (
          <table className="student-table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>Name</th>
                <th>Behavior</th>
                <th>Avg Score</th>
                <th>Attendance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>{s.rollNumber || s.studentId}</td>
                  <td>{s.fullName || s.name}</td>
                  <td>{s.behavior}</td>
                  <td>{s.averageScore || 0}%</td>
                  <td>{s.attendance || 0}%</td>
                  <td>
                    <button className="edit-btn" onClick={() => handleEdit(s)}>Edit</button>
                    <button className="delete-btn" onClick={() => handleDelete(s.rollNumber || s.studentId)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TeacherStudentManager;
