// src/pages/SchoolAdmin/MainPage.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import UploadStudents from "./SchoolComponent/UploadStudents";
import StudentDetails from "./SchoolComponent/StudentDetails";
import QuizAnalytics from "./SchoolComponent/QuizAnalytics";
import TeacherHome from "./SchoolComponent/TeacherHome";
import Sidebar from "./SchoolComponent/Sidebar";
import {
  LayoutDashboard,
  Upload,
  Users,
  BarChart3,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import "./MainPage.css";
import Announcement from "./SchoolComponent/Announcement";

const MainPage = ({ school, onLogout }) => {
  const sidebarLinks = [
    { name: "Dashboard", path: "/school-admin/home", icon: LayoutDashboard },
    { name: "Upload Students", path: "/school-admin/upload", icon: Upload },
    { name: "Student Details", path: "/school-admin/students", icon: Users },
    { name: "Quiz Analytics", path: "/school-admin/analytics", icon: BarChart3 },
    { name: "Announcements", path: "/school-admin/announcements", icon: Megaphone },
  ];

  return (
    <div className="main-layout">
      <Sidebar
        sidebarTitle={school?.schoolName || "School Admin"}
        sidebarLogo={school?.schoolLogo}
        links={sidebarLinks}
        onLogout={onLogout}
      />

      <main className="content-area">
        <div className="content-container">
          <Routes>
            <Route path="/" element={<Navigate to="home" />} />
            <Route path="home" element={<TeacherHome schoolId={school.schoolId} />} />
            <Route path="upload" element={<UploadStudents schoolId={school.schoolId} />} />
            <Route path="students" element={<StudentDetails schoolId={school.schoolId} />} />
            <Route path="analytics" element={<QuizAnalytics schoolId={school.schoolId} />} />
            <Route path="announcements" element={<Announcement schoolId={school.schoolId} />} />
            <Route path="*" element={<h2>Page Not Found</h2>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default MainPage;
