import React, { lazy, Suspense, useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Sidebar from "../SchoolAdmin/SchoolComponent/Sidebar";
import { useTeacherAuth } from "../../context/TeacherAuthContext";
import { db } from "../../firebase/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import "./TeacherDashboard.css";

// ✅ Lucide icons
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  BarChart3,
  Megaphone,
  CalendarCheck,
  User,
} from "lucide-react";

// ✅ Lazy-loaded pages
const TeacherClassManager = lazy(() => import("./components/Classes/TeacherClassManager"));
const TeacherHome = lazy(() => import("./components/Home/TeacherHome"));
const TeacherClasses = lazy(() => import("./components/Classes/TeacherClasses"));
const TeacherSubjects = lazy(() => import("./components/Subjects/TeacherSubjects"));
const TeacherAssignments = lazy(() => import("./components/Assignments/TeacherAssignments"));
const TeacherPerformance = lazy(() => import("./components/Performance/TeacherPerformance"));
const ClassAnnouncements = lazy(() => import("./components/Communication/ClassAnnouncements"));
const ClassAttendance = lazy(() => import("./components/Attendance/ClassAttendance"));

// ==============================
// 🔹 MAIN DASHBOARD COMPONENT
// ==============================
const TeacherDashboard = () => {
  const { teacher, logout } = useTeacherAuth();
  const [isClassTeacher, setIsClassTeacher] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeClass, setActiveClass] = useState("");
  const [classes, setClasses] = useState([]);

  // 🔹 Detect class teacher
  useEffect(() => {
    if (teacher?.role?.toLowerCase() === "class_teacher") {
      setIsClassTeacher(true);
      const list = teacher?.assignedClasses || (teacher.assignedClass ? [teacher.assignedClass] : []);
      setClasses(list);
      setActiveClass(teacher.assignedClass || list[0] || "");
    } else {
      setIsClassTeacher(false);
    }
  }, [teacher]);

  // 🔹 Handle class switch (update in Firestore)
  const handleClassSwitch = async (newClass) => {
    setActiveClass(newClass);
    try {
      const ref = doc(db, "users", teacher.uid);
      await updateDoc(ref, { assignedClass: newClass, updatedAt: new Date() });
      console.log("✅ Active class switched to:", newClass);
    } catch (err) {
      console.error("❌ Failed to update active class:", err);
    }
  };

  // ==============================
  // 🔹 SIDEBAR LINKS
  // ==============================
  const teacherLinks = [
    { name: "Dashboard", path: "/teacher-dashboard/home", icon: LayoutDashboard },
    { name: "My Subjects", path: "/teacher-dashboard/subjects", icon: BookOpen },
    { name: "Assignments", path: "/teacher-dashboard/assignments", icon: ClipboardList },
    { name: "Performance", path: "/teacher-dashboard/performance", icon: BarChart3 },
    ...(isClassTeacher
      ? [
          { divider: true },
          { name: "My Class", path: "/teacher-dashboard/classes", icon: Users },
          { name: "Attendance", path: "/teacher-dashboard/attendance", icon: CalendarCheck },
          { name: "Announcements", path: "/teacher-dashboard/announcements", icon: Megaphone },
        ]
      : []),
  ];

  const safeLinks = teacherLinks.map((l) => ({
    ...l,
    icon: l.icon || User,
  }));

  // ==============================
  // 🔹 Floating Class Switcher
  // ==============================
  const FloatingSwitcher = () => {
    if (!isClassTeacher || !classes?.length || classes.length < 2) return null;

    return (
      <div className="floating-switch">
        {classes.map((cls) => (
          <button
            key={cls}
            className={`class-btn ${activeClass === cls ? "active" : ""}`}
            onClick={() => handleClassSwitch(cls)}
          >
            {cls}
          </button>
        ))}
      </div>
    );
  };

  // ==============================
  // 🔹 MAIN RENDER
  // ==============================
  return (
    <div className="teacher-dashboard-layout">
      {/* === Sidebar === */}
      <Sidebar
        sidebarTitle={isClassTeacher ? "Class Teacher Panel" : "Teacher Panel"}
        sidebarLogo={teacher?.profilePic || null}
        links={safeLinks}
        onLogout={logout}
        onCollapseChange={setSidebarCollapsed}
      />

      {/* === Main Area === */}
      <main className={`teacher-content-area ${sidebarCollapsed ? "collapsed" : ""}`}>
        {/* 🔹 Floating class switch */}
        <FloatingSwitcher />

        <Suspense fallback={<div className="teacher-loader">Loading...</div>}>
          <Routes>
            {/* Redirect root */}
            <Route path="/" element={<Navigate to="/teacher-dashboard/home" replace />} />

            {/* Common teacher routes */}
            <Route path="home" element={<TeacherHome teacher={teacher} />} />
            <Route path="subjects" element={<TeacherSubjects teacher={teacher} />} />
            <Route path="assignments" element={<TeacherAssignments teacher={teacher} />} />
            <Route path="performance" element={<TeacherPerformance teacher={teacher} />} />

            {/* Extra for Class Teachers */}
            {isClassTeacher && (
              <>
                <Route
                  path="classes"
                  element={<TeacherClassManager teacher={{ ...teacher, assignedClass: activeClass }} />}
                />
                <Route
                  path="attendance"
                  element={<ClassAttendance teacher={{ ...teacher, assignedClass: activeClass }} />}
                />
                <Route
                  path="announcements"
                  element={<ClassAnnouncements teacher={{ ...teacher, assignedClass: activeClass }} />}
                />
              </>
            )}

            {/* Fallback */}
            <Route path="*" element={<Navigate to="home" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
};

export default TeacherDashboard;
