import React, { useEffect, useState } from "react";
import { useTeacherAuth } from "../../../../context/TeacherAuthContext";
import Loader from "../Shared/Loader";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

// ✅ Import same admin components
import ClassDetailView from "../../../SchoolAdmin/SchoolComponent/Teacher_Home/ClassTeacherManager/ClassDetailView";
import TeacherList from "../../../SchoolAdmin/SchoolComponent/Teacher_Home/ClassTeacherManager/TeacherList";
import StudentRollSetup from "./StudentRollSetup";

import "./TeacherClasses.css";

const TeacherClasses = () => {
  const { teacher } = useTeacherAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [draggedTeacher, setDraggedTeacher] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRollSetup, setShowRollSetup] = useState(true);

  const isClassTeacher = teacher?.role === "class_teacher";
  const activeClass = teacher?.assignedClass || ""; // 🔹 the class currently selected in floating switch

  // 🔹 Fetch all classes of this teacher (handles multi-class)
  useEffect(() => {
    if (!teacher?.schoolId) return;

    const q = query(
      collection(db, "classes"),
      where("schoolId", "==", teacher.schoolId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // if class teacher, filter only their classes
      const filtered = isClassTeacher
        ? all.filter((c) => teacher?.assignedClasses?.includes(c.className))
        : all;
      setClasses(filtered);
      setLoading(false);
    });

    return () => unsub();
  }, [teacher, isClassTeacher]);

  // 🔹 Fetch all teachers for same school (for class team)
  useEffect(() => {
    if (!teacher?.schoolId) return;
    const q = query(collection(db, "users"), where("schoolId", "==", teacher.schoolId));
    const unsub = onSnapshot(q, (snap) => {
      setTeachers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [teacher]);

  if (loading) return <Loader text="Loading class data..." />;

  // 🔹 CLASS TEACHER VIEW
  if (isClassTeacher) {
    const currentClass = classes.find((c) => c.className === activeClass);

    if (!currentClass) {
      return (
        <div className="teacher-class-detail">
          <h2 className="gradient-text">My Class</h2>
          <p>No class assigned yet or invalid selection.</p>
        </div>
      );
    }

    return (
      <div className="teacher-class-detail">
        <h2 className="gradient-text">My Class ({currentClass.className})</h2>

        {/* 🔹 Roll Setup Section with Minimize Feature */}
        <div className="roll-setup-container glass-card">
          <div className="roll-setup-header">
            <h3>Student Roll Setup</h3>
            <button
              className="toggle-btn"
              onClick={() => setShowRollSetup((prev) => !prev)}
            >
              {showRollSetup ? "− Minimize" : "+ Expand"}
            </button>
          </div>

          <div
            className={`roll-setup-content ${
              showRollSetup ? "open" : "collapsed"
            }`}
          >
            {showRollSetup && (
              <StudentRollSetup
                schoolId={teacher.schoolId}
                className={currentClass.className}
              />
            )}
          </div>
        </div>

        {/* 🔹 Layout for Class Detail + Teacher List */}
        <div className="teacher-class-layout">
          <div className="class-detail-section glass-card">
            <ClassDetailView
              className={currentClass.className}
              schoolId={teacher.schoolId}
              teacher={teacher}
              teachers={teachers}
              draggedTeacher={draggedTeacher}
              setDraggedTeacher={setDraggedTeacher}
              mode="admin"
            />
          </div>

          <div className="teacher-list-section glass-card">
            <TeacherList
              teachers={teachers}
              selectedTeacher={selectedTeacher}
              setSelectedTeacher={setSelectedTeacher}
              draggedTeacher={draggedTeacher}
              setDraggedTeacher={setDraggedTeacher}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              title="Available Teachers"
            />
          </div>
        </div>
      </div>
    );
  }

  // 🔹 NORMAL SUBJECT TEACHER VIEW
  return (
    <div className="teacher-class-detail">
      <h2 className="gradient-text">My Classes</h2>
      <p>These are the classes where you teach subjects.</p>

      <div className="class-list-container">
        {classes.length === 0 ? (
          <p>No assigned classes found.</p>
        ) : (
          <div className="class-list-grid">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className={`class-card ${
                  selectedClass?.id === cls.id ? "active" : ""
                }`}
                onClick={() => setSelectedClass(cls)}
              >
                <div className="class-name">{cls.className}</div>
                <div className="class-info">
                  <span>Grade {cls.grade}</span>
                  <span>Division {cls.division}</span>
                </div>
                {cls.classTeacherName && (
                  <div className="class-teacher">
                    <small>Class Teacher: {cls.classTeacherName}</small>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedClass && (
        <div className="selected-class-view">
          <h3>Viewing {selectedClass.className}</h3>
          <ClassDetailView
            schoolId={teacher.schoolId}
            className={selectedClass.className}
            teacher={teacher}
            mode="teacher"
          />
        </div>
      )}
    </div>
  );
};

export default TeacherClasses;
