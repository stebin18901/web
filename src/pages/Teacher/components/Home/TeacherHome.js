import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";

const TeacherHome = () => {
  const { teacher } = useTeacherAuth();
  const [stats, setStats] = useState({ classes: 0, subjects: 0, students: 0 });
  const [loading, setLoading] = useState(true);
  const isClassTeacher = teacher?.role === "class_teacher";

  useEffect(() => {
    if (!teacher?.schoolId) return;
    const q = query(collection(db, "classes"), where("schoolId", "==", teacher.schoolId));
    const unsub = onSnapshot(q, (snap) => {
      let totalClasses = 0, totalSubjects = 0, totalStudents = 0;
      snap.docs.forEach((doc) => {
        const data = doc.data();
        const team = data.team || [];
        if (isClassTeacher && data.classTeacherEmail === teacher.email) {
          totalClasses++;
          totalStudents += data.totalStudents || 0;
        }
        team.forEach((t) => {
          if (t.email === teacher.email) totalSubjects += t.subjects?.length || 0;
        });
      });
      setStats({ classes: totalClasses, subjects: totalSubjects, students: totalStudents });
      setLoading(false);
    });
    return () => unsub();
  }, [teacher, isClassTeacher]);

  if (loading) return <Loader text="Loading Dashboard..." />;

  return (
    <div className="teacher-home">
      <h2 className="gradient-text">Welcome, {teacher?.name}</h2>
      <div className="teacher-stats">
        <div className="stat-card">Classes: {stats.classes}</div>
        <div className="stat-card">
          {isClassTeacher ? `Students: ${stats.students}` : `Subjects: ${stats.subjects}`}
        </div>
      </div>
    </div>
  );
};

export default TeacherHome;
