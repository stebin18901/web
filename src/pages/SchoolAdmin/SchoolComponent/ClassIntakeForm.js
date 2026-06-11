import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import "./ClassIntakeForm.css";

const normalize = (v) => String(v || "").trim();

export default function ClassIntakeForm() {
  const { schoolId, className, type } = useParams();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState("School");

  const normalizedSchoolId = useMemo(() => normalize(schoolId).toLowerCase(), [schoolId]);
  const normalizedClassName = useMemo(() => normalize(className).toUpperCase(), [className]);
  const formType = type === "teacher" ? "teacher" : "student";

  const [studentForm, setStudentForm] = useState({
    fullName: "",
    rollNumber: "",
    pin: "",
  });

  const [teacherForm, setTeacherForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
  });
  useEffect(() => {
    const fetchSchoolName = async () => {
      if (!schoolId) return;
      try {
        const snap = await getDoc(doc(db, "schools", schoolId));
        if (snap.exists()) {
          setSchoolName(snap.data().schoolName || "School");
        }
      } catch (err) {
        setSchoolName("School");
      }
    };

    fetchSchoolName();
  }, [schoolId]);
  const ensureClassExists = async () => {
    const classId = `${schoolId}_${normalizedClassName}`;
    const classRef = doc(db, "classes", classId);
    const classSnap = await getDoc(classRef);

    if (!classSnap.exists()) {
      const grade = parseInt(normalizedClassName.match(/^\d+/)?.[0] || "0", 10);
      await setDoc(classRef, {
        schoolId,
        className: normalizedClassName,
        grade,
        division: normalizedClassName.replace(/^\d+/, "") || "A",
        createdAt: new Date(),
        source: "public_form",
      });
    }

    return classId;
  };

  const submitStudent = async (e) => {
    e.preventDefault();
    if (!studentForm.fullName || !studentForm.rollNumber || !studentForm.pin) {
      setStatus("Please fill name, roll number, and pin.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const classId = await ensureClassExists();
      const roll = normalize(studentForm.rollNumber);

      await setDoc(doc(db, "studentAccounts", `${normalizedSchoolId}_${normalizedClassName}_${roll}`), {
        fullName: normalize(studentForm.fullName),
        className: normalizedClassName,
        rollNumber: roll,
        pin: normalize(studentForm.pin),
        schoolId: normalizedSchoolId,
        createdAt: new Date(),
        source: "class_form",
      });

      await setDoc(doc(db, "classes", classId, "students", roll), {
        rollNumber: roll,
        name: normalize(studentForm.fullName),
        createdAt: new Date(),
        source: "class_form",
      }, { merge: true });

      setStatus("Student details submitted successfully.");
      setStudentForm({ fullName: "", rollNumber: "", pin: "" });
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitTeacher = async (e) => {
    e.preventDefault();
    if (!teacherForm.name || !teacherForm.email) {
      setStatus("Please fill teacher name and email.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const classId = await ensureClassExists();
      const teacherRef = await addDoc(collection(db, "users"), {
        name: normalize(teacherForm.name),
        email: normalize(teacherForm.email).toLowerCase(),
        phone: normalize(teacherForm.phone),
        subject: normalize(teacherForm.subject),
        role: "teacher",
        schoolId,
        assignedClass: normalizedClassName,
        createdAt: new Date(),
        source: "class_form",
      });

      const classRef = doc(db, "classes", classId);
      const classSnap = await getDoc(classRef);
      const currentTeam = classSnap.exists() && Array.isArray(classSnap.data().team) ? classSnap.data().team : [];
      const nextTeam = [
        ...currentTeam,
        {
          userId: teacherRef.id,
          name: normalize(teacherForm.name),
          email: normalize(teacherForm.email).toLowerCase(),
          subjects: teacherForm.subject ? [normalize(teacherForm.subject)] : [],
        },
      ];

      await setDoc(classRef, { team: nextTeam, updatedAt: new Date() }, { merge: true });

      setStatus("Teacher details submitted successfully.");
      setTeacherForm({ name: "", email: "", phone: "", subject: "" });
    } catch (err) {
      setStatus(`Submission failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="class-intake-page">
      <div className="class-intake-card">
        <h1>{formType === "student" ? "Student Details Form" : "Teacher Details Form"}</h1>
        <p>School: <strong>{schoolName}</strong> | Class: <strong>{normalizedClassName}</strong></p>

        {formType === "student" ? (
          <form onSubmit={submitStudent} className="intake-form">
            <input value={studentForm.fullName} onChange={(e) => setStudentForm((p) => ({ ...p, fullName: e.target.value }))} placeholder="Student Name" />
            <input value={studentForm.rollNumber} onChange={(e) => setStudentForm((p) => ({ ...p, rollNumber: e.target.value }))} placeholder="Roll Number" />
            <input value={studentForm.pin} onChange={(e) => setStudentForm((p) => ({ ...p, pin: e.target.value }))} placeholder="PIN" />
            <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Student"}</button>
          </form>
        ) : (
          <form onSubmit={submitTeacher} className="intake-form">
            <input value={teacherForm.name} onChange={(e) => setTeacherForm((p) => ({ ...p, name: e.target.value }))} placeholder="Teacher Name" />
            <input value={teacherForm.email} onChange={(e) => setTeacherForm((p) => ({ ...p, email: e.target.value }))} placeholder="Teacher Email" />
            <input value={teacherForm.phone} onChange={(e) => setTeacherForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone (optional)" />
            <input value={teacherForm.subject} onChange={(e) => setTeacherForm((p) => ({ ...p, subject: e.target.value }))} placeholder="Subject (optional)" />
            <button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Teacher"}</button>
          </form>
        )}

        {status && <p className="status-message">{status}</p>}
      </div>
    </div>
  );
}



