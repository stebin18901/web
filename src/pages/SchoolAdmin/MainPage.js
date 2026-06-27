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
  Megaphone,
} from "lucide-react";
import "./MainPage.css";
import Announcement from "./SchoolComponent/Announcement";

const MainPage = ({ school, onLogout }) => {
  const [currentSchool, setCurrentSchool] = React.useState(school);

  React.useEffect(() => {
    setCurrentSchool(school);
  }, [school]);

  const sidebarLinks = [
    { name: "Dashboard", path: "/school-admin/home", icon: LayoutDashboard },
    { name: "Upload Students", path: "/school-admin/upload", icon: Upload },
    { name: "Student Details", path: "/school-admin/students", icon: Users },
    { name: "Quiz Analytics", path: "/school-admin/analytics", icon: BarChart3 },
    { name: "Announcements", path: "/school-admin/announcements", icon: Megaphone },
  ];
  const commonFormLink = currentSchool?.schoolId
    ? `${window.location.origin}/school-form/${currentSchool.schoolId}/student`
    : "";

  return (
    <div className="main-layout">
      <Sidebar
        sidebarTitle={currentSchool?.schoolName || "School Admin"}
        sidebarLogo={currentSchool?.schoolLogo}
        links={sidebarLinks}
        commonFormLink={commonFormLink}
        onLogout={onLogout}
      />

      <main className="content-area">
        <div className="content-container">
          <Routes>
            <Route path="/" element={<Navigate to="home" />} />
            <Route path="home" element={<TeacherHome school={currentSchool} schoolId={currentSchool.schoolId} />} />
            <Route path="upload" element={<UploadStudents schoolId={currentSchool.schoolId} />} />
            <Route path="students" element={<StudentDetails schoolId={currentSchool.schoolId} />} />
            <Route path="analytics" element={<QuizAnalytics schoolId={currentSchool.schoolId} />} />
            <Route path="announcements" element={<Announcement schoolId={currentSchool.schoolId} />} />
            <Route path="*" element={<h2>Page Not Found</h2>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default MainPage;
